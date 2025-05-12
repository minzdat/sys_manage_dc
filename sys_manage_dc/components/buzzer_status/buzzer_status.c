#include "buzzer_status.h"
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "buzzer_status";

/* Event group để quản lý trạng thái của buzzer */
static EventGroupHandle_t buzzer_event_group = NULL;
static uint32_t current_status = 0;

static void buzzer_on(void)
{
    gpio_set_level(BUZZER_GPIO, 1);
}

static void buzzer_off(void)
{
    gpio_set_level(BUZZER_GPIO, 0);
}

static void buzzer_configure(void)
{
    ESP_LOGI(TAG, "buzzer_status: Cấu hình buzzer GPIO!");
    gpio_reset_pin(BUZZER_GPIO);
    gpio_set_direction(BUZZER_GPIO, GPIO_MODE_OUTPUT);
    buzzer_off();
}

/* Hàm trả về điểm ưu tiên cao nhất trong mask trạng thái */
static int get_status_priority(uint32_t bits)
{
    int priority = -1;
    if (bits & BUZZER_STATUS_RFID_DETECTED_BIT)
        priority = (PRIORITY_RFID_DETECTED > priority) ? PRIORITY_RFID_DETECTED : priority;
    if (bits & BUZZER_STATUS_SET_MODE_DEVICE_BIT)
        priority = (PRIORITY_SET_MODE_DEVICE > priority) ? PRIORITY_SET_MODE_DEVICE : priority;
    if (bits & BUZZER_STATUS_PROVISIONING_BIT)
        priority = (PRIORITY_PROVISIONING > priority) ? PRIORITY_PROVISIONING : priority;
    if (bits & BUZZER_STATUS_STATION_PROVISIONING_BIT)
        priority = (PRIORITY_STATION_PROVISIONING > priority) ? PRIORITY_STATION_PROVISIONING : priority;
    if (bits & BUZZER_STATUS_DISCONNECTED_WIFI_BIT)
        priority = (PRIORITY_DISCONNECTED_WIFI > priority) ? PRIORITY_DISCONNECTED_WIFI : priority;
    if (bits & BUZZER_STATUS_NORMAL_BIT)
        priority = (PRIORITY_NORMAL > priority) ? PRIORITY_NORMAL : priority;
    if (bits & BUZZER_STATUS_INIT_DEVICE)
        priority = (PRIORITY_INIT_DEVICE > priority) ? PRIORITY_INIT_DEVICE : priority;
    return priority;
}

/* Task quản lý trạng thái buzzer với các pattern bíp khác nhau */
static void buzzer_status_task(void *pvParameter)
{
    const TickType_t disconnect_wifi_delay             = pdMS_TO_TICKS(5000);
    const TickType_t poll_delay                        = pdMS_TO_TICKS(100);
    const TickType_t beep_on_delay                     = pdMS_TO_TICKS(300);
    const TickType_t beep_off_delay                    = pdMS_TO_TICKS(300);
    const TickType_t beep_on_detect_rfid_delay         = pdMS_TO_TICKS(100);
    const TickType_t beep_off_detect_rfid_delay        = pdMS_TO_TICKS(100);

    /* Mask các bit trạng thái quan tâm */
    const EventBits_t wait_bits_mask = BUZZER_STATUS_RFID_DETECTED_BIT |
                                         BUZZER_STATUS_SET_MODE_DEVICE_BIT |
                                         BUZZER_STATUS_PROVISIONING_BIT |
                                         BUZZER_STATUS_STATION_PROVISIONING_BIT |
                                         BUZZER_STATUS_DISCONNECTED_WIFI_BIT |
                                         BUZZER_STATUS_NORMAL_BIT |
                                         BUZZER_STATUS_INIT_DEVICE;

    while (1) {
         /*
         * Chờ một trong các bit trong wait_bits_mask được set.
         * pdTRUE: clear các bit khi trả về, do đó mỗi bit chỉ được xử lý 1 lần.
         * pdFALSE: không chờ đồng thời (không cần đợi tất cả các bit cùng lúc).
         */
        EventBits_t bits = xEventGroupWaitBits(buzzer_event_group,
            wait_bits_mask,
            pdTRUE,  // clear on exit: đảm bảo chỉ thực hiện 1 lần mỗi lần set
            pdFALSE, // không cần chờ hết tất cả các bit
            portMAX_DELAY);

        if (bits & BUZZER_STATUS_RFID_DETECTED_BIT) {
            ESP_LOGI(TAG, "RFID detected, beep on");
            buzzer_on();
            vTaskDelay(beep_on_detect_rfid_delay);
            buzzer_off();
            vTaskDelay(beep_off_detect_rfid_delay);
            continue;
        } else if (bits & BUZZER_STATUS_SET_MODE_DEVICE_BIT) {
            ESP_LOGI(TAG, "Set mode device, beep pattern");
            buzzer_on();
            vTaskDelay(beep_on_detect_rfid_delay);
            buzzer_off();
            vTaskDelay(beep_off_detect_rfid_delay);
            buzzer_on();
            vTaskDelay(beep_on_detect_rfid_delay);
            buzzer_off();
            vTaskDelay(beep_off_detect_rfid_delay);
            continue;
        } else if (bits & BUZZER_STATUS_PROVISIONING_BIT) {
            ESP_LOGI(TAG, "Provisioning mode, beep on");
            buzzer_on();
            vTaskDelay(beep_on_delay);
            buzzer_off();
            vTaskDelay(beep_off_delay);
            // Nếu current_status vẫn chứa bit provisioning, ta tự động set lại bit để tiếp tục chu kỳ beep
            if (current_status & BUZZER_STATUS_PROVISIONING_BIT) {
                xEventGroupSetBits(buzzer_event_group, BUZZER_STATUS_PROVISIONING_BIT);
            }
        } else if (bits & BUZZER_STATUS_STATION_PROVISIONING_BIT) {
            ESP_LOGI(TAG, "Station provisioning mode, beep on");
            buzzer_on();
            vTaskDelay(beep_on_delay);
            buzzer_off();
            vTaskDelay(beep_off_delay);
            if (current_status & BUZZER_STATUS_STATION_PROVISIONING_BIT) {
                xEventGroupSetBits(buzzer_event_group, BUZZER_STATUS_STATION_PROVISIONING_BIT);
            }
        } else if (bits & BUZZER_STATUS_DISCONNECTED_WIFI_BIT) {
            ESP_LOGI(TAG, "Disconnected from WiFi, beep on");
            buzzer_on();
            vTaskDelay(disconnect_wifi_delay);
            buzzer_off();
            vTaskDelay(poll_delay);
        } else if (bits & BUZZER_STATUS_NORMAL_BIT) {
            ESP_LOGI(TAG, "Normal mode, beep off");
            buzzer_off();
            vTaskDelay(poll_delay);
        } else if (bits & BUZZER_STATUS_INIT_DEVICE) {
            ESP_LOGI(TAG, "Initializing device, beep off");
            buzzer_off();
            vTaskDelay(poll_delay);
        }
        else {
            buzzer_off();
            ESP_LOGI(TAG, "Unknown state, beep off");
            vTaskDelay(poll_delay);
        }
    }
}

/* Khởi tạo component: cấu hình buzzer và tạo event group */
void buzzer_status_init(void)
{
    buzzer_configure();

    if (buzzer_event_group == NULL) {
        buzzer_event_group = xEventGroupCreate();
    }

    xEventGroupClearBits(buzzer_event_group,
        BUZZER_STATUS_STATION_PROVISIONING_BIT | BUZZER_STATUS_RFID_DETECTED_BIT | BUZZER_STATUS_SET_MODE_DEVICE_BIT | 
        BUZZER_STATUS_INIT_DEVICE | BUZZER_STATUS_NORMAL_BIT | BUZZER_STATUS_DISCONNECTED_WIFI_BIT | 
        BUZZER_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(buzzer_event_group, BUZZER_STATUS_INIT_DEVICE);
    current_status = BUZZER_STATUS_INIT_DEVICE;
}

/* Hàm cập nhật trạng thái buzzer với cơ chế ưu tiên,
   ngoại lệ: nếu trạng thái hiện tại hoặc trạng thái mới chứa bit NORMAL,
   thì không so sánh mức ưu tiên mà cập nhật luôn.
*/
void buzzer_status_set(uint32_t status)
{
    /* Sử dụng biến tĩnh để lưu trạng thái đã set */
    static uint32_t last_status = -1;

    ESP_LOGI(TAG, "Current state saved: %u", (unsigned int)last_status);

    // Bỏ qua cập nhật nếu trạng thái mới giống trạng thái cũ, 
    // và không phải là trạng thái cần xử lý mỗi lần (RFID/SET_MODE)
    if ((last_status == status) && ((status != BUZZER_STATUS_RFID_DETECTED_BIT) && (status != BUZZER_STATUS_SET_MODE_DEVICE_BIT))) {
        ESP_LOGW(TAG, "Status %u is duplicate, skip update", (unsigned int)status);
        return;
    }

    // Nếu trạng thái hiện tại hoặc trạng thái mới chứa bit NORMAL,
    // bỏ qua cơ chế so sánh mức ưu tiên và cập nhật luôn.
    if ((last_status & BUZZER_STATUS_NORMAL_BIT) || (status & BUZZER_STATUS_NORMAL_BIT)) {
        ESP_LOGI(TAG, "Update state NORMAL, skipping priority comparison");
        xEventGroupClearBits(buzzer_event_group,
            BUZZER_STATUS_STATION_PROVISIONING_BIT | BUZZER_STATUS_RFID_DETECTED_BIT | BUZZER_STATUS_SET_MODE_DEVICE_BIT | 
            BUZZER_STATUS_INIT_DEVICE | BUZZER_STATUS_NORMAL_BIT | BUZZER_STATUS_DISCONNECTED_WIFI_BIT | 
            BUZZER_STATUS_PROVISIONING_BIT);
        xEventGroupSetBits(buzzer_event_group, status);
        
        current_status = status;
        last_status = status;
        ESP_LOGI(TAG, "Update status buzzer: %u", (unsigned int)status);
        return;
    }

    // Nếu không có bit NORMAL, thực hiện so sánh mức ưu tiên như cũ
    int current_priority = get_status_priority(last_status);
    int new_priority = get_status_priority(status);

    if (new_priority < current_priority) {
        ESP_LOGW(TAG, "Do not set new state due to lower priority: new=%d, last_status=%d", new_priority, current_priority);
        return;
    }

    xEventGroupClearBits(buzzer_event_group,
        BUZZER_STATUS_STATION_PROVISIONING_BIT | BUZZER_STATUS_RFID_DETECTED_BIT | BUZZER_STATUS_SET_MODE_DEVICE_BIT |
        BUZZER_STATUS_INIT_DEVICE | BUZZER_STATUS_NORMAL_BIT | BUZZER_STATUS_DISCONNECTED_WIFI_BIT | 
        BUZZER_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(buzzer_event_group, status);

    current_status = status;
    last_status = status;
    ESP_LOGI(TAG, "Update status buzzer: %u", (unsigned int)status);
}

/* Bắt đầu task quản lý trạng thái buzzer */
void buzzer_status_start(void)
{
    buzzer_status_init();
    xTaskCreate(buzzer_status_task, "buzzer_status_task", 1024 * 4, NULL, 5, NULL);
}
