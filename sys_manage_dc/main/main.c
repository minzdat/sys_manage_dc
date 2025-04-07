#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_http_client.h"

#include "smartconfig_webserver.h"
#include "button_ctrl.h"
#include "led_status.h"
#include "rfid_rc522.h"
#include "esp_crt_bundle.h"
#include "buzzer_status.h"
#include "firebase_wrapper.h"
#include "storage_spiffs.h"

static const char *TAG = "MAIN_TAG";

void app_main(void)
{
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
        storage_spiffs_init();
    }
    
    // Khởi tạo component buzzer
    buzzer_status_start();

    // Khởi tạo component LED
    led_status_start();

    // Khởi tạo component button
    button_component_init();

    // Khởi tạo RFID
    init_rfid();

    // Khởi tạo webserver
    smartconfig_webserver_init();

    // Khởi tạo Firebase
    vTaskDelay(500 / portTICK_PERIOD_MS);
    firebase_wrapper();
}