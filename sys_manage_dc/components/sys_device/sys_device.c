#include "sys_device.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_mac.h"
#include "driver/temp_sensor.h"

// Tag dùng cho log
static const char *TAG = "SYS_DEVICE";

/**
 * @brief Lấy địa chỉ MAC của WiFi Station dạng chuỗi.
 */
char* sys_device_get_mac_str(void)
{
    // Sử dụng bộ nhớ tĩnh vì hàm không cần cấp phát động
    static char buffer[MAC_STR_LEN];
    uint8_t mac[6];
    
    if (esp_read_mac(mac, ESP_MAC_WIFI_STA) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read MAC address");
        return NULL;
    }
    
    snprintf(buffer, MAC_STR_LEN, "%02X:%02X:%02X:%02X:%02X:%02X", 
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return buffer;
}

/**
 * @brief Đọc nhiệt độ từ cảm biến của ESP32-S3.
 */
float sys_device_get_temperature(void)
{
    float celsius = 0.0;
    esp_err_t ret;
    
    // Cấu hình cảm biến nhiệt với các tham số cần thiết
    temp_sensor_config_t tsens_config = {
        .dac_offset = TSENS_DAC_L2, // Chọn mức DAC phù hợp
        .clk_div = 2                // Giá trị chia xung clock
    };

    ret = temp_sensor_set_config(tsens_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set temp sensor config");
        return NAN;
    }

    ret = temp_sensor_start();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start temp sensor");
        return NAN;
    }

    ret = temp_sensor_read_celsius(&celsius);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read temp sensor");
        celsius = NAN;
    }
    
    temp_sensor_stop();
    return celsius;
}

/**
 * @brief Lấy cường độ tín hiệu WiFi (RSSI).
 */
int8_t sys_device_get_wifi_rssi(void)
{
    wifi_ap_record_t ap_info;
    
    if (esp_wifi_sta_get_ap_info(&ap_info) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get WiFi AP info");
        return 0;  // Trả về giá trị mặc định nếu có lỗi
    }
    
    return ap_info.rssi;
}

esp_reset_reason_t sys_get_reset_reason(void)
{
    // Lấy nguyên nhân reset thông qua API của ESP-IDF
    return esp_reset_reason();
}

const char* sys_get_reset_reason_str(void)
{
    esp_reset_reason_t reason = sys_get_reset_reason();
    
    switch (reason) {
        case ESP_RST_UNKNOWN:
            return "ESP_RST_UNKNOWN";           // Reset reason cannot be determined
        case ESP_RST_POWERON:
            return "ESP_RST_POWERON";           // Power on reset
        case ESP_RST_EXT:
            return "ESP_RST_EXT";               // Reset by external pin
        case ESP_RST_SW:
            return "ESP_RST_SW";                // Software reset via esp_restart
        case ESP_RST_PANIC:
            return "ESP_RST_PANIC";             // Reset due to exception/panic
        case ESP_RST_INT_WDT:
            return "ESP_RST_INT_WDT";           // Reset due to interrupt watchdog
        case ESP_RST_TASK_WDT:
            return "ESP_RST_TASK_WDT";          // Reset due to task watchdog
        case ESP_RST_WDT:
            return "ESP_RST_WDT";               // Reset due to other watchdogs
        case ESP_RST_DEEPSLEEP:
            return "ESP_RST_DEEPSLEEP";         // Reset after exiting deep sleep mode
        case ESP_RST_BROWNOUT:
            return "ESP_RST_BROWNOUT";          // Brownout reset
        case ESP_RST_SDIO:
            return "ESP_RST_SDIO";              // Reset over SDIO
        case ESP_RST_USB:
            return "Reset by USB peripheral";   // Reset by USB peripheral
        case ESP_RST_JTAG:
            return "ESP_RST_JTAG";              // Reset by JTAG
        case ESP_RST_EFUSE:
            return "ESP_RST_EFUSE";             // Reset due to efuse error
        case ESP_RST_PWR_GLITCH:
            return "ESP_RST_PWR_GLITCH";        // Reset due to power glitch detected
        case ESP_RST_CPU_LOCKUP:
            return "ESP_RST_CPU_LOCKUP";        // Reset due to CPU lock up (double exception)
        default:
            return "Unknown reset reason";      // Unknown reset reason
    }
}