#include "led_status.h"
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "led_strip.h"
#include "sdkconfig.h"

static const char *TAG = "led_status";

/* Event group để quản lý trạng thái LED */
static EventGroupHandle_t led_event_group = NULL;
static uint32_t current_status = 0;

#ifdef CONFIG_BLINK_LED_STRIP
static led_strip_handle_t led_strip;

/* Hàm bật LED cho LED Strip */
static void led_on(void)
{
    /* Set pixel 0 với giá trị RGB (16,16,16) và refresh LED strip */
    led_strip_set_pixel(led_strip, 0, 16, 16, 16);
    led_strip_refresh(led_strip);
}

/* Hàm tắt LED cho LED Strip */
static void led_off(void)
{
    led_strip_clear(led_strip);
}

/* Cấu hình LED addressable */
static void led_configure(void)
{
    ESP_LOGI(TAG, "led_status: Addressable LED configuration!");
    led_strip_config_t strip_config = {
        .strip_gpio_num = BLINK_GPIO,
        .max_leds = 1,
    };
#if CONFIG_BLINK_LED_STRIP_BACKEND_RMT
    led_strip_rmt_config_t rmt_config = {
        .resolution_hz = 10 * 1000 * 1000, // 10MHz
        .flags.with_dma = false,
    };
    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip));
#elif CONFIG_BLINK_LED_STRIP_BACKEND_SPI
    led_strip_spi_config_t spi_config = {
        .spi_bus = SPI2_HOST,
        .flags.with_dma = true,
    };
    ESP_ERROR_CHECK(led_strip_new_spi_device(&strip_config, &spi_config, &led_strip));
#else
#error "unsupported LED strip backend"
#endif
    led_strip_clear(led_strip);
}

#elif CONFIG_BLINK_LED_GPIO
/* Hàm bật LED cho GPIO */
static void led_on(void)
{
    gpio_set_level(BLINK_GPIO, 1);
}

/* Hàm tắt LED cho GPIO */
static void led_off(void)
{
    gpio_set_level(BLINK_GPIO, 0);
}

/* Cấu hình LED qua GPIO */
static void led_configure(void)
{
    ESP_LOGI(TAG, "led_status: GPIO LED Configuration!");
    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);
}

#else
#error "unsupported LED type"
#endif

#ifdef CONFIG_BLINK_LED_STRIP
static void led_set_color(uint8_t red, uint8_t green, uint8_t blue)
{
    led_strip_set_pixel(led_strip, 0, red, green, blue);
    led_strip_refresh(led_strip);
}
#elif CONFIG_BLINK_LED_GPIO
// For GPIO, you might not have color control; you could map the LED on/off state or implement a different function.
static void led_set_color(uint8_t red, uint8_t green, uint8_t blue)
{
    // Turn the LED on if any color is non-zero; off otherwise.
    if (red || green || blue) {
        gpio_set_level(BLINK_GPIO, 1);
    } else {
        gpio_set_level(BLINK_GPIO, 0);
    }
}
#else
#error "unsupported LED type"
#endif

/* Hàm trả về điểm ưu tiên cao nhất của mask trạng thái LED.
   Lưu ý: sử dụng các giá trị ưu tiên giống như buzzer_status để đảm bảo tính nhất quán */
static int get_status_priority(uint32_t bits)
{
    int priority = -1;
    if (bits & LED_STATUS_RFID_DETECTED_BIT)
        priority = (PRIORITY_RFID_DETECTED > priority) ? PRIORITY_RFID_DETECTED : priority;
    if (bits & LED_STATUS_PROVISIONING_BIT)
        priority = (PRIORITY_PROVISIONING > priority) ? PRIORITY_PROVISIONING : priority;
    if (bits & LED_STATUS_STATION_PROVISIONING_BIT)
        priority = (PRIORITY_STATION_PROVISIONING > priority) ? PRIORITY_STATION_PROVISIONING : priority;
    if (bits & LED_STATUS_DISCONNECTED_WIFI_BIT)
        priority = (PRIORITY_DISCONNECTED_WIFI > priority) ? PRIORITY_DISCONNECTED_WIFI : priority;
    if (bits & LED_STATUS_NORMAL_BIT)
        priority = (PRIORITY_NORMAL > priority) ? PRIORITY_NORMAL : priority;
    if (bits & LED_STATUS_INIT_DEVICE)
        priority = (PRIORITY_INIT_DEVICE > priority) ? PRIORITY_INIT_DEVICE : priority;
    return priority;
}

/* Task quản lý trạng thái LED */
static void led_status_task(void *pvParameter)
{
    /* Các khoảng delay: poll chung, delay bật và tắt khi blink */
    const TickType_t poll_delay                             = pdMS_TO_TICKS(500);
    const TickType_t blink_on_delay                         = pdMS_TO_TICKS(300);
    const TickType_t blink_off_delay                        = pdMS_TO_TICKS(300);
    const TickType_t blink_on_detect_rfid_delay             = pdMS_TO_TICKS(200);
    const TickType_t blink_off_detect_rfid_delay            = pdMS_TO_TICKS(100);

    /* Các bit trạng thái cần quan tâm */
    const EventBits_t wait_bits_mask = LED_STATUS_RFID_DETECTED_BIT |
                                         LED_STATUS_PROVISIONING_BIT |
                                         LED_STATUS_STATION_PROVISIONING_BIT |
                                         LED_STATUS_DISCONNECTED_WIFI_BIT |
                                         LED_STATUS_NORMAL_BIT |
                                         LED_STATUS_INIT_DEVICE;

    while (1) {
        /*
        * Chờ một trong các bit trạng thái được set. Khi trả về, các bit được clear tự động.
        */
        EventBits_t bits = xEventGroupWaitBits(led_event_group,
                                               wait_bits_mask,
                                               pdTRUE,  // clear on exit: mỗi bit xử lý 1 lần
                                               pdFALSE, // không cần chờ tất cả các bit cùng lúc
                                               portMAX_DELAY);

        if (bits & LED_STATUS_RFID_DETECTED_BIT) {
            // Trạng thái RFID: chớp tắt LED màu xanh lá chỉ 1 lần
            led_set_color(0, 0, 0);                         // Tắt LED
            vTaskDelay(blink_on_detect_rfid_delay);
            led_set_color(0, 255, 0);                       // Bật LED màu xanh lá
            vTaskDelay(blink_off_detect_rfid_delay);
            continue;                                       // Tiếp tục vòng lặp để xử lý các trạng thái khác nếu có
        } else if (bits & LED_STATUS_PROVISIONING_BIT) {
            ESP_LOGI(TAG, "Provisioning mode, blink LED");
            led_set_color(0, 0, 255);                       // bật LED màu xanh dương
            vTaskDelay(blink_on_delay);
            led_set_color(0, 0, 0);                         // tắt LED
            vTaskDelay(blink_off_delay);
            // Nếu trạng thái provisioning vẫn còn, tự động set lại bit để tiếp tục blink
            if (current_status & LED_STATUS_PROVISIONING_BIT) {
                xEventGroupSetBits(led_event_group, LED_STATUS_PROVISIONING_BIT);
            }
        } else if (bits & LED_STATUS_STATION_PROVISIONING_BIT) {
            ESP_LOGI(TAG, "Station provisioning mode, blink LED");
            led_set_color(255, 255, 0);                     // bật LED màu vang
            vTaskDelay(blink_on_delay);
            led_set_color(0, 0, 0);                         // tắt LED
            vTaskDelay(blink_off_delay);
            if (current_status & LED_STATUS_STATION_PROVISIONING_BIT) {
                xEventGroupSetBits(led_event_group, LED_STATUS_STATION_PROVISIONING_BIT);
            }
        } else if (bits & LED_STATUS_DISCONNECTED_WIFI_BIT) {
            ESP_LOGI(TAG, "Disconnected from WiFi, LED on");
            led_set_color(255, 0, 0);
            vTaskDelay(poll_delay);
        } else if (bits & LED_STATUS_NORMAL_BIT) {
            ESP_LOGI(TAG, "Normal mode, LED off");
            led_set_color(0, 255, 0);
            vTaskDelay(poll_delay);
        } else if (bits & LED_STATUS_INIT_DEVICE) {
            ESP_LOGI(TAG, "Initializing device, LED off");
            led_set_color(0, 0, 0);
            vTaskDelay(poll_delay);
        }
        else {
            // Không có trạng thái: tắt LED
            // led_set_color(0, 0, 0);
            // vTaskDelay(poll_delay);
        }
    }
}

/* Khởi tạo component: cấu hình LED và tạo event group */
void led_status_init(void)
{
    led_configure();

    if (led_event_group == NULL) {
        led_event_group = xEventGroupCreate();
    }

    /* Set trạng thái mặc định là normal */
    xEventGroupClearBits(led_event_group,
                        LED_STATUS_STATION_PROVISIONING_BIT | LED_STATUS_RFID_DETECTED_BIT | LED_STATUS_INIT_DEVICE | LED_STATUS_NORMAL_BIT | LED_STATUS_DISCONNECTED_WIFI_BIT | LED_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(led_event_group, LED_STATUS_INIT_DEVICE);
    current_status = LED_STATUS_INIT_DEVICE;
}

/* Hàm cập nhật trạng thái LED với cơ chế ưu tiên tương tự buzzer_status.
   - Nếu trạng thái mới giống trạng thái hiện tại (ngoại trừ RFID) thì bỏ qua cập nhật.
   - Nếu trạng thái hiện tại hoặc trạng thái mới có bit NORMAL, thì cập nhật luôn.
   - Ngược lại, so sánh mức ưu tiên và chỉ cập nhật khi trạng thái mới có ưu tiên cao hơn.
*/
void led_status_set(uint32_t status)
{
    static uint32_t last_status = -1;

    ESP_LOGI(TAG, "Current LED state saved: %u", (unsigned int)last_status);

    // Nếu trạng thái mới giống với trạng thái đã lưu, bỏ qua (ngoại trừ RFID)
    if ((last_status == status) && (status != LED_STATUS_RFID_DETECTED_BIT)) {
        ESP_LOGW(TAG, "Status %u is set, skip updates", (unsigned int)status);
        return;
    }

    // Nếu trạng thái hiện tại hoặc mới chứa NORMAL, cập nhật luôn
    if ((last_status & LED_STATUS_NORMAL_BIT) || (status & LED_STATUS_NORMAL_BIT)) {
        ESP_LOGI(TAG, "Update state NORMAL, skipping priority comparison");
        xEventGroupClearBits(led_event_group,
            LED_STATUS_STATION_PROVISIONING_BIT | LED_STATUS_RFID_DETECTED_BIT | LED_STATUS_INIT_DEVICE |
            LED_STATUS_NORMAL_BIT | LED_STATUS_DISCONNECTED_WIFI_BIT | LED_STATUS_PROVISIONING_BIT);
        xEventGroupSetBits(led_event_group, status);
        current_status = status;
        last_status = status;
        ESP_LOGI(TAG, "Update LED status: %u", (unsigned int)status);
        return;
    }

    int current_priority = get_status_priority(last_status);
    int new_priority = get_status_priority(status);

    if (new_priority < current_priority) {
        ESP_LOGW(TAG, "Do not update new status because of lower priority: new=%d, current=%d", new_priority, current_priority);
        return;
    }

    xEventGroupClearBits(led_event_group,
        LED_STATUS_STATION_PROVISIONING_BIT | LED_STATUS_RFID_DETECTED_BIT | LED_STATUS_INIT_DEVICE |
        LED_STATUS_NORMAL_BIT | LED_STATUS_DISCONNECTED_WIFI_BIT | LED_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(led_event_group, status);

    current_status = status;
    last_status = status;
    ESP_LOGI(TAG, "Update LED status: %u", (unsigned int)status);
}

/* Bắt đầu task quản lý trạng thái LED */
void led_status_start(void)
{
    led_status_init();
    xTaskCreate(led_status_task, "led_status_task", 1024 * 4, NULL, 5, NULL);
}
