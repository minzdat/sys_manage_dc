#ifndef LED_STATUS_H
#define LED_STATUS_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BLINK_GPIO CONFIG_BLINK_GPIO

/* Định nghĩa điểm ưu tiên cho các trạng thái buzzer */
#define PRIORITY_PROVISIONING          4
#define PRIORITY_STATION_PROVISIONING  4
#define PRIORITY_DISCONNECTED_WIFI     4
#define PRIORITY_RFID_DETECTED         2
#define PRIORITY_NORMAL                5
#define PRIORITY_INIT_DEVICE           0

/* Các bit trạng thái LED */
#define LED_STATUS_NORMAL_BIT                   (1 << 0)
#define LED_STATUS_DISCONNECTED_WIFI_BIT        (1 << 1)
#define LED_STATUS_PROVISIONING_BIT             (1 << 2)
#define LED_STATUS_STATION_PROVISIONING_BIT     (1 << 3)
#define LED_STATUS_INIT_DEVICE                  (1 << 4)
#define LED_STATUS_RFID_DETECTED_BIT            (1 << 5)

/**
 * @brief Khởi tạo component led_status.
 */
void led_status_init(void);

/**
 * @brief Bắt đầu task quản lý trạng thái LED.
 */
void led_status_start(void);

/**
 * @brief Cập nhật trạng thái LED.
 *
 * @param status Một trong các giá trị: LED_STATUS_NORMAL_BIT, LED_STATUS_DISCONNECTED_WIFI_BIT, LED_STATUS_PROVISIONING_BIT.
 */
void led_status_set(uint32_t status);

#ifdef __cplusplus
}
#endif

#endif /* LED_STATUS_H */
