#include "sntp_service.h"
#include "esp_sntp.h"
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "lwip/ip_addr.h"
#include <time.h>
#include <sys/time.h>

static const char *TAG = "sntp_service";

// Hàm thiết lập múi giờ cho Hồ Chí Minh
static void set_hcm_timezone(void) {
    setenv("TZ", HCM_TIMEZONE, 1);
    tzset();
}

esp_err_t sntp_service_init(void) {
    time_t now = 0;
    struct tm timeinfo = {0};
    
    // Lấy thời gian hiện tại
    time(&now);
    localtime_r(&now, &timeinfo);

    // Nếu thời gian đã được cài đặt (năm >= 2023), chỉ cần cài đặt múi giờ và trả về
    if (timeinfo.tm_year >= TIME_YEAR_THRESHOLD) {
        ESP_LOGI(TAG, "Time is already set");
        set_hcm_timezone();
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing SNTP service...");
    
    // Cấu hình SNTP với máy chủ NTP
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("vn.pool.ntp.org");
    config.sync_cb = NULL; // Có thể bổ sung callback nếu cần thông báo sau khi đồng bộ

    // Khởi tạo SNTP
    esp_err_t ret = esp_netif_sntp_init(&config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SNTP initialization error: %s", esp_err_to_name(ret));
        return ret;
    }

    // Bắt đầu dịch vụ SNTP
    esp_netif_sntp_start();

    // Đồng bộ thời gian với số lần thử quy định
    int retry = 0;
    while (esp_netif_sntp_sync_wait(SNTP_WAIT_INTERVAL_MS) == ESP_ERR_TIMEOUT && ++retry < SNTP_RETRY_COUNT) {
        ESP_LOGW(TAG, "Waiting for SNTP sync... (%d/%d)", retry, SNTP_RETRY_COUNT);
    }

    if (retry >= SNTP_RETRY_COUNT) {
        ESP_LOGE(TAG, "Failed to synchronize time after %d attempts", SNTP_RETRY_COUNT);
        esp_netif_sntp_deinit();
        return ESP_ERR_TIMEOUT;
    }

    // Sau khi đồng bộ thành công, cài đặt múi giờ cho HCM
    set_hcm_timezone();

    // Dừng dịch vụ SNTP vì đã hoàn thành việc đồng bộ
    esp_netif_sntp_deinit();

    // Log thời gian hiện tại theo múi giờ HCM
    time(&now);
    localtime_r(&now, &timeinfo);
    ESP_LOGI(TAG, "Current time in HCM: %02d:%02d:%02d %02d/%02d/%04d",
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec,
             timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year + 1900);

    return ESP_OK;
}

// Hàm lấy chuỗi thời gian hiện tại theo định dạng ISO 8601
char* get_current_time_str(void) {
    time_t now;
    struct tm timeinfo;
    char *time_str = malloc(TIME_STR_SIZE);
    if (!time_str) {
        ESP_LOGE(TAG, "Memory allocation failed for time string");
        return NULL;
    }

    time(&now);
    localtime_r(&now, &timeinfo);
    if (strftime(time_str, TIME_STR_SIZE, "%Y-%m-%dT%H:%M:%S", &timeinfo) == 0) {
        ESP_LOGE(TAG, "strftime failed");
        free(time_str);
        return NULL;
    }
    return time_str;
}