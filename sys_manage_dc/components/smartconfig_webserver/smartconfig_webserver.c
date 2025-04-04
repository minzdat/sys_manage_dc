#include "smartconfig_webserver.h"

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "lwip/err.h"
#include "lwip/sys.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "lwip/dns.h" 

#include "app_config.h" // Giả sử file này chứa cấu hình của bạn

static const char *TAG = "SMARTCONFIG_WEBSERVER";

void smartconfig_webserver_init(void)
{
    ESP_LOGI(TAG, "[APP] Startup..");
    ESP_LOGI(TAG, "[APP] Free memory: %lu bytes", (unsigned long)esp_get_free_heap_size());
    ESP_LOGI(TAG, "[APP] IDF version: %s", esp_get_idf_version());

    // ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Hủy default STA netif nếu đã tồn tại để tránh duplicate key khi tạo lại trong wifi_scan
    esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (sta_netif != NULL) {
        esp_netif_destroy(sta_netif);
    }
    // Không khai báo lại, chỉ gán giá trị mới
    sta_netif = esp_netif_create_default_wifi_sta();
    assert(sta_netif);
        
    app_config();
    // Chắc chắn đã connect wifi rồi
}
