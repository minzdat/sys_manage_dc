#include <stdio.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <sys/time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_http_client.h"
#include "esp_mac.h"
#include "esp_wifi.h"
#include "esp_timer.h"
#include "driver/temp_sensor.h"
#include "cJSON.h"
#include "esp_crt_bundle.h"

#include "smartconfig_webserver.h"
#include "button_ctrl.h"
#include "led_status.h"
#include "rfid_rc522.h"
#include "buzzer_status.h"
#include "firebase_config.h"
#include "firebase_wrapper.h"
#include "storage_spiffs.h"
#include "sntp_service.h"
#include "internal_rtc.h"
#include "sys_device.h"
#include "com_firestore.h"

// Các macro định nghĩa
#define SYNC_TIMER_PERIOD_US                (300000000)         // 5 phút

static const char *TAG = "MAIN_TAG";

char *g_deviceId = NULL;
char g_lastBootTime[TIME_STR_SIZE] = {0};
char g_resetReason[64] = {0};

// Callback của timer đồng bộ thời gian
void sync_timer_callback(void *arg) 
{
    ESP_LOGI(TAG, "Timer callback triggered, synchronizing time...");
    
    // Lấy chuỗi thời gian hiện tại (ISO 8601)
    char *time_str = get_current_time_str();
    if (time_str == NULL) {
        ESP_LOGE(TAG, "Failed to get current time string");
        return;
    }
    
    ESP_LOGI(TAG, "Current Time String: %s", time_str);
    
    // Chuyển đổi chuỗi thời gian sang struct tm
    struct tm tm_time = {0};
    if (strptime(time_str, "%Y-%m-%dT%H:%M:%S", &tm_time) == NULL) {
        ESP_LOGE(TAG, "Time conversion failed");
        free(time_str);
        return;
    }
    
    // Gọi hàm cập nhật thời gian trên RTC nội bộ
    if (internal_rtc_set_time(&tm_time) == 0) {
        ESP_LOGI(TAG, "Internal RTC updated successfully");
    } else {
        ESP_LOGE(TAG, "Internal RTC update failed");
    }
    
    free(time_str);
}

// Khởi tạo timer đồng bộ thời gian
void sync_timer_init(void) 
{
    esp_timer_create_args_t timer_args = {
        .callback = &sync_timer_callback,
        .arg = NULL,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "sync_timer"
    };

    esp_timer_handle_t sync_timer;
    esp_err_t ret = esp_timer_create(&timer_args, &sync_timer);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create timer: %s", esp_err_to_name(ret));
        return;
    }
    ret = esp_timer_start_periodic(sync_timer, SYNC_TIMER_PERIOD_US);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start timer: %s", esp_err_to_name(ret));
    }
}

// Hàm khởi tạo ứng dụng
void app_main(void)
{
    // Lấy nguyên nhân reset của hệ thống
    const char *reset_reason = sys_get_reset_reason_str();
    ESP_LOGW(TAG, "Reset Reason: %s", reset_reason);
    strncpy(g_resetReason, reset_reason, sizeof(g_resetReason)-1);
    g_resetReason[sizeof(g_resetReason)-1] = '\0';

    // Khởi tạo NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Khởi tạo SPIFFS
    if (storage_spiffs_init() != ESP_OK) {
        ESP_LOGE(TAG, "SPIFFS initialization failed");
    }
    
    // Khởi tạo phần cứng/phần mềm
    buzzer_status_start();
    led_status_start();
    button_component_init();
    init_rfid();

    // Webserver chờ kết nối WiFi
    smartconfig_webserver_init();

    ret = sntp_service_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SNTP initialization failed: %s", esp_err_to_name(ret));
    } else {
        ESP_LOGI(TAG, "SNTP initialization successful, time synchronized");
        // Lấy thời gian ban đầu dưới dạng chuỗi ISO 8601
        char *time_str = get_current_time_str();
        if (time_str != NULL) {
            // Lưu trữ chuỗi thời gian vào biến toàn cục
            strncpy(g_lastBootTime, time_str, TIME_STR_SIZE - 1);
            g_lastBootTime[TIME_STR_SIZE - 1] = '\0';  // Đảm bảo kết thúc chuỗi

            // Chuyển đổi chuỗi sang struct tm để cập nhật RTC
            struct tm tm_time = {0};
            if (strptime(time_str, "%Y-%m-%dT%H:%M:%S", &tm_time) != NULL) {
                if (internal_rtc_set_time(&tm_time) == 0) {
                    ESP_LOGI(TAG, "Initial RTC update successful");
                    ESP_LOGI(TAG, "Last Boot Time stored: %s", g_lastBootTime);
                } else {
                    ESP_LOGE(TAG, "Initial RTC update failed");
                }
            } else {
                ESP_LOGE(TAG, "Initial time conversion failed");
            }
            free(time_str);
        } else {
            ESP_LOGE(TAG, "Failed to obtain current time string");
        }
    }

    // Khởi tạo RTC nội bộ thông qua timer
    sync_timer_init();

    // Lấy thông tin MAC làm Device ID
    g_deviceId = sys_device_get_mac_str();
    if (!g_deviceId) {
        ESP_LOGE(TAG, "Failed to get MAC address");
    }
    ESP_LOGI(TAG, "MAC: %s", g_deviceId);

    // Khởi tạo Firebase và định danh thiết bị
    vTaskDelay(500 / portTICK_PERIOD_MS);
    firebase_init();

    // Tạo task cập nhật thông tin thiết bị
    xTaskCreate(update_info_device_task, "update_info_device_task", 1024 * 8, NULL, 5, NULL);
    xTaskCreate(rfid_pet_registration_task, "rfid_pet_registration_task", 1024 * 8, NULL, 5, NULL);
}
