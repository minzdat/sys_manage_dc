#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_wifi.h"

#include "button.h"
#include "button_ctrl.h"
#include "app_config.h"

static const char *TAG = "BUTTON_TAG";

// Định nghĩa GPIO cho 2 nút, điều chỉnh theo phần cứng
#define BUTTON_PROVISION_GPIO GPIO_NUM_0

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
