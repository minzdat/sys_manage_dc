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
#define BLINK_GPIO CONFIG_BLINK_GPIO

/* Event group để quản lý trạng thái LED */
static EventGroupHandle_t led_event_group = NULL;

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
    ESP_LOGI(TAG, "led_status: Cấu hình LED addressable!");
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
    ESP_LOGI(TAG, "led_status: Cấu hình LED GPIO!");
    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);
}

#else
#error "unsupported LED type"
#endif

/* Task quản lý trạng thái LED */
static void led_status_task(void *pvParameter)
{
    /* Các khoảng delay: poll chung, delay bật và tắt khi blink */
    const TickType_t poll_delay      = pdMS_TO_TICKS(500);
    const TickType_t blink_on_delay  = pdMS_TO_TICKS(300);
    const TickType_t blink_off_delay = pdMS_TO_TICKS(300);

    while (1) {
        /* Lấy trạng thái hiện tại từ event group */
        EventBits_t bits = xEventGroupGetBits(led_event_group);

        if (bits & LED_STATUS_PROVISIONING_BIT) {
            /* Trạng thái provisioning: LED chớp nháy */
            led_on();
            vTaskDelay(blink_on_delay);
            /* Kiểm tra lại nếu trạng thái thay đổi trong lúc delay */
            bits = xEventGroupGetBits(led_event_group);
            if (!(bits & LED_STATUS_PROVISIONING_BIT)) {
                continue;
            }
            led_off();
            vTaskDelay(blink_off_delay);
        } else if (bits & LED_STATUS_DISCONNECTED_WIFI_BIT) {
            /* Trạng thái disconnect: LED tắt */
            led_off();
            vTaskDelay(poll_delay);
        } else if (bits & LED_STATUS_NORMAL_BIT) {
            /* Trạng thái normal: LED sáng */
            led_on();
            vTaskDelay(poll_delay);
        } else {
            /* Mặc định nếu không có trạng thái nào được set: tắt LED */
            led_off();
            vTaskDelay(poll_delay);
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
                         LED_STATUS_NORMAL_BIT | LED_STATUS_DISCONNECTED_WIFI_BIT | LED_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(led_event_group, LED_STATUS_DISCONNECTED_WIFI_BIT);
}

/* Bắt đầu task quản lý trạng thái LED */
void led_status_start(void)
{
    led_status_init();

    xTaskCreate(led_status_task, "led_status_task", 2048, NULL, 5, NULL);
}

/* Hàm cập nhật trạng thái LED.
   Khi gọi hàm này, các bit trạng thái cũ sẽ bị xóa và chỉ set trạng thái mới.
 */
void led_status_set(uint32_t status)
{
    xEventGroupClearBits(led_event_group,
                         LED_STATUS_NORMAL_BIT | LED_STATUS_DISCONNECTED_WIFI_BIT | LED_STATUS_PROVISIONING_BIT);
    xEventGroupSetBits(led_event_group, status);
}
