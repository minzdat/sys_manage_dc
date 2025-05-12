#ifndef BUZZER_STATUS_H
#define BUZZER_STATUS_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#ifdef __cplusplus
extern "C" {
#endif


#define BUZZER_GPIO GPIO_NUM_4

/* Định nghĩa điểm ưu tiên cho các trạng thái buzzer */
#define PRIORITY_PROVISIONING          4
#define PRIORITY_STATION_PROVISIONING  4
#define PRIORITY_DISCONNECTED_WIFI     4
#define PRIORITY_RFID_DETECTED         2
#define PRIORITY_SET_MODE_DEVICE       2
#define PRIORITY_NORMAL                5
#define PRIORITY_INIT_DEVICE           0

/* Định nghĩa các bit trạng thái cho buzzer */
#define BUZZER_STATUS_NORMAL_BIT               (1 << 0)
#define BUZZER_STATUS_DISCONNECTED_WIFI_BIT    (1 << 1)
#define BUZZER_STATUS_PROVISIONING_BIT         (1 << 2)
#define BUZZER_STATUS_STATION_PROVISIONING_BIT (1 << 3)
#define BUZZER_STATUS_INIT_DEVICE              (1 << 4)
#define BUZZER_STATUS_RFID_DETECTED_BIT        (1 << 5)
#define BUZZER_STATUS_SET_MODE_DEVICE_BIT      (1 << 6)

/**
 * @brief Khởi tạo component buzzer_status.
 */
void buzzer_status_init(void);

/**
 * @brief Bắt đầu task quản lý trạng thái buzzer.
 */
void buzzer_status_start(void);

/**
 * @brief Cập nhật trạng thái buzzer.
 *
 * @param status Một trong các giá trị: BUZZER_STATUS_NORMAL_BIT, BUZZER_STATUS_DISCONNECTED_WIFI_BIT, BUZZER_STATUS_PROVISIONING_BIT,…
 */
void buzzer_status_set(uint32_t status);

#ifdef __cplusplus
}
#endif

#endif /* BUZZER_STATUS_H */
