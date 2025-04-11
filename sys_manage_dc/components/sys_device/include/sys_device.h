#ifndef SYS_DEVICE_H
#define SYS_DEVICE_H

#include <stdint.h>
#include <math.h>
#include "esp_err.h"
#include "esp_system.h"

// Độ dài chuỗi MAC: "XX:XX:XX:XX:XX:XX" + '\0'
#define MAC_STR_LEN 18

/**
 * @brief Lấy địa chỉ MAC của WiFi Station dạng chuỗi.
 *
 * @return Chuỗi MAC dạng tĩnh hoặc NULL nếu thất bại.
 */
char* sys_device_get_mac_str(void);

/**
 * @brief Đọc nhiệt độ từ cảm biến của ESP32-S3.
 *
 * @return Nhiệt độ tính theo độ C, hoặc NAN nếu có lỗi.
 */
float sys_device_get_temperature(void);

/**
 * @brief Lấy cường độ tín hiệu WiFi (RSSI).
 *
 * @return Giá trị RSSI hoặc 0 nếu có lỗi.
 */
int8_t sys_device_get_wifi_rssi(void);

/**
 * @brief Lấy nguyên nhân reset của hệ thống.
 *
 * @return esp_reset_reason_t giá trị enum của nguyên nhân reset.
 */
esp_reset_reason_t sys_get_reset_reason(void);

/**
 * @brief Lấy chuỗi mô tả nguyên nhân reset của hệ thống.
 *
 * @return const char* chuỗi mô tả.
 */
const char* sys_get_reset_reason_str(void);

#endif // SYS_DEVICE_H
