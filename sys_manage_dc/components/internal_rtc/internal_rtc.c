#include "internal_rtc.h"
#include <stdio.h>
#include <stdlib.h>
#include "esp_system.h"
#include "esp_err.h"

/*
 * Hàm khởi tạo RTC nội bộ.
 * Ở ví dụ này, hàm này chỉ thực hiện việc in ra thông báo khởi tạo.
 * Bạn có thể mở rộng để thiết lập múi giờ, đồng bộ NTP, v.v.
 */
void internal_rtc_init(void)
{
    // Ví dụ: thiết lập múi giờ (bạn có thể thay đổi múi giờ phù hợp)
    // setenv("TZ", "CST-7", 1);
    // tzset();
    printf("Internal RTC Initialized.\n");
}

/*
 * Hàm thiết lập thời gian dựa trên cấu trúc tm thông qua settimeofday.
 */
int internal_rtc_set_time(const struct tm *timeinfo)
{
    if (timeinfo == NULL) {
        return -1;
    }
    struct timeval tv;
    // Chuyển đổi struct tm thành epoch time (s)
    tv.tv_sec = mktime((struct tm *)timeinfo);
    tv.tv_usec = 0;
    if (settimeofday(&tv, NULL) != 0) {
        printf("Error: settimeofday failed\n");
        return -1;
    }
    return 0;
}

/*
 * Hàm lấy thời gian hiện tại từ hệ thống thông qua gettimeofday,
 * chuyển về cấu trúc tm thông qua localtime.
 */
int internal_rtc_get_time(struct tm *timeinfo)
{
    if (timeinfo == NULL) {
        return -1;
    }
    time_t now;
    time(&now);
    struct tm *temp = localtime(&now);
    if (temp == NULL) {
        printf("Error: localtime failed\n");
        return -1;
    }
    *timeinfo = *temp;
    return 0;
}
