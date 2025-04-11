#ifndef SNTP_SERVICE_H
#define SNTP_SERVICE_H

#include "esp_err.h"

// Định nghĩa hằng số cho cấu hình
#define HCM_TIMEZONE                        "UTC-7"                                 // Cài đặt múi giờ cho Hồ Chí Minh (theo chuẩn POSIX, "UTC-7" sẽ tính đúng giờ UTC+7)
#define TIME_YEAR_THRESHOLD                 (2023 - 1900)                           // Kiểm tra năm đã được đồng bộ (struct tm: năm tính từ 1900)
#define SNTP_RETRY_COUNT                    15                                      // Số lần thử tối đa
#define SNTP_WAIT_INTERVAL_MS               (2000 / portTICK_PERIOD_MS)             // Khoảng thời gian chờ giữa các lần thử
#define TIME_STR_SIZE                       64                                      // Kích thước chuỗi thời gian

esp_err_t sntp_service_init(void);
char* get_current_time_str(void);

#endif