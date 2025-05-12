#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_timer.h" 

#include "button.h"
#include "button_ctrl.h"
#include "app_config.h"
#include "rfid_rc522.h"
#include "buzzer_status.h"

static const char *TAG = "BUTTON_TAG";

static int press_count = 0;
static bool counting = false;
static esp_timer_handle_t count_timer;

// Định nghĩa GPIO cho 2 nút, điều chỉnh theo phần cứng
#define BUTTON_PROVISION_GPIO GPIO_NUM_0

// Gọi hành động tương ứng dựa trên số lần nhấn
static void handle_rfid_action(int count) {
    switch (count) {
        case 1:
            action_rfid_card = RFID_ACTION_READ_SPECIFIED;
            ESP_LOGI(TAG, "RFID_ACTION_READ_SPECIFIED");
            buzzer_status_set(BUZZER_STATUS_SET_MODE_DEVICE_BIT);
            break;
        case 2:
            action_rfid_card = RFID_ACTION_REGIST_SER;
            ESP_LOGI(TAG, "RFID_ACTION_REGIST_SER");
            buzzer_status_set(BUZZER_STATUS_SET_MODE_DEVICE_BIT);
            break;
        case 3:
            action_rfid_card = RFID_ACTION_DELETE_SPECIFIED;
            ESP_LOGI(TAG, "RFID_ACTION_DELETE_SPECIFIED");
            buzzer_status_set(BUZZER_STATUS_SET_MODE_DEVICE_BIT);
            break;
        case 4:
            action_rfid_card = RFID_ACTION_READ_ALL;
            ESP_LOGI(TAG, "RFID_ACTION_READ_ALL");
            buzzer_status_set(BUZZER_STATUS_SET_MODE_DEVICE_BIT);
            break;
        default:
            ESP_LOGW(TAG, "Unhandled press count: %d", count);
            break;
    }
}

static void count_timer_callback(void* arg) {
    ESP_LOGI(TAG, "Button pressed %d times in 1 second", press_count);
    handle_rfid_action(press_count); 
    press_count = 0;
    counting = false;
}

// Hàm callback xử lý sự kiện của nút
static void button_handler(button_t *btn, button_state_t state) {
    if (btn->gpio == BUTTON_PROVISION_GPIO) {
        switch(state) {
            case BUTTON_PRESSED:
                ESP_LOGI(TAG, "Button provisioning pressed");
                break;
            case BUTTON_RELEASED:
                ESP_LOGI(TAG, "Button provisioning released");
                break;
            case BUTTON_CLICKED:
                // Đếm số lần nhấn
                press_count++;
                if (!counting) {
                    counting = true;

                    if (count_timer == NULL) {
                        const esp_timer_create_args_t timer_args = {
                            .callback = &count_timer_callback,
                            .name = "button_count_timer"
                        };
                        ESP_ERROR_CHECK(esp_timer_create(&timer_args, &count_timer));
                    }

                    // Start timer 1s
                    esp_timer_start_once(count_timer, 1000000);  // 1,000,000 µs = 1s
                }
                
                ESP_LOGI(TAG, "Button provisioning clicked");
                break;
            case BUTTON_PRESSED_LONG:
                ESP_LOGI(TAG, "Button provisioning long pressed");

                // Nếu đang ở chế độ Provisioning (AP), không cho phép vào reprovisioning
                if (!in_provisioning_mode) {
                    ESP_LOGW(TAG, "Currently in provisioning mode; reprovisioning is locked");
                    break;
                }

                if (s_wifi_event_reprovision_group != NULL) {
                    ESP_LOGI(TAG, "Event_reprovision_group exists");
                    // Kiểm tra xem bit đã được set chưa
                    EventBits_t bits = xEventGroupGetBits(s_wifi_event_reprovision_group);
                    if ((bits & REPROVISION_TRIGGER_BIT) == 0) {
                        ESP_LOGI(TAG, "Set reprovision trigger bit");
                        xEventGroupSetBits(s_wifi_event_reprovision_group, REPROVISION_TRIGGER_BIT);
                    } else {
                        ESP_LOGI(TAG, "Reprovision trigger bit is already set");
                    }
                } else {
                    ESP_LOGE(TAG, "Event group s_wifi_event_reprovision_group is NULL!");
                }
                
                break;
            default:
                ESP_LOGW(TAG, "Unknown button state");
                break;
        }
    }
    else {
        ESP_LOGE(TAG, "Unknown button");
    }
}

// Khai báo biến cho button
static button_t button_provison = {
    .gpio = BUTTON_PROVISION_GPIO,
    .internal_pull = true,      // Sử dụng internal pull-up/pull-down
    .pressed_level = 0,         // Mức logic khi nhấn (0 nếu dùng pull-up)
    .autorepeat = false,        // Bật/tắt chế độ autorepeat
    .callback = button_handler, // Gán hàm callback xử lý sự kiện
    .ctx = NULL,
};

void button_component_init(void) {
    if (button_init(&button_provison) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize button provison");
    }
}
