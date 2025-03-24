#ifndef LED_STATUS_H
#define LED_STATUS_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Các bit trạng thái LED */
#define LED_STATUS_NORMAL_BIT                   (1 << 0)
#define LED_STATUS_DISCONNECTED_WIFI_BIT        (1 << 1)
#define LED_STATUS_PROVISIONING_BIT             (1 << 2)

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
