#ifndef INTERNAL_RTC_H
#define INTERNAL_RTC_H

#include <time.h>
#include <sys/time.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Khởi tạo RTC nội bộ.
 *
 * Hàm này dùng để thực hiện các cấu hình ban đầu cho RTC. Bạn có thể bổ sung
 * các thiết lập múi giờ hoặc đồng bộ thời gian từ nguồn bên ngoài nếu cần.
 */
void internal_rtc_init(void);

/**
 * @brief Thiết lập thời gian cho RTC.
 *
 * @param timeinfo Con trỏ đến cấu trúc tm chứa thời gian cần thiết lập.
 * @return 0 nếu thành công, -1 nếu có lỗi.
 */
int internal_rtc_set_time(const struct tm *timeinfo);

/**
 * @brief Lấy thời gian hiện tại từ RTC.
 *
 * @param timeinfo Con trỏ đến cấu trúc tm mà hàm sẽ điền thời gian hiện tại.
 * @return 0 nếu thành công, -1 nếu có lỗi.
 */
int internal_rtc_get_time(struct tm *timeinfo);

#ifdef __cplusplus
}
#endif

#endif // INTERNAL_RTC_H
