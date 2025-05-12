#include "app_config.h"

#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
// #include "esp_wpa2.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_smartconfig.h"

#include "lwip/err.h" 
#include "lwip/sys.h"

#include "app_http_server.h"
#include "qrcode.h"
#include "scan_wifi.h"
#include "led_status.h"
#include "buzzer_status.h"
#include "storage_spiffs.h"

static char * TAG = "CONFIG_WIFI";

#ifndef MACSTR
#define MACSTR "%02x:%02x:%02x:%02x:%02x:%02x"
#endif

#ifndef MAC2STR
#define MAC2STR(a) ((a)[0]), ((a)[1]), ((a)[2]), ((a)[3]), ((a)[4]), ((a)[5])
#endif

// provision_type_t provision_type = PROVISION_SMARTCONFIG; // smart config ok rồi
provision_type_t provision_type = PROVISION_ACCESSPOINT; 

EventGroupHandle_t s_wifi_event_reprovision_group = NULL;
static EventGroupHandle_t s_wifi_event_group;
static const int WIFI_CONNECTED_BIT = BIT0;
static const int ESPTOUCH_DONE_BIT = BIT1;
static const int HTTP_CONFIG_DONE = BIT2;

static char ssid_array[DEFAULT_SCAN_LIST_SIZE][MAX_SSID_LENGTH + 1];

// Khai báo biến flag toàn cục
volatile bool in_provisioning_mode = false;

static void safe_disconnect_wifi(void) {
    esp_err_t err = esp_wifi_disconnect();
    if (err == ESP_ERR_WIFI_NOT_CONNECT) {
        ESP_LOGI(TAG, "No current connection, no need to disconnect");
    } else if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error while disconnecting: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "Disconnected successfully");
    }
}

static void safe_connect_wifi(void) {
    esp_err_t err = esp_wifi_connect();
    if (err == ESP_ERR_WIFI_CONN) {
        ESP_LOGI(TAG, "Already connected, no need to connect again");
    } else if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error when calling connect: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "Connected successfully");
    }
}

static void event_handler(void* arg, esp_event_base_t event_base, 
                                int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        ESP_LOGW(TAG, "WiFi start");
        safe_connect_wifi(); // Kết nối WiFi safe
    } 
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_CONNECTED) {
        ESP_LOGI(TAG, "WiFi connected (event handler)");

        led_status_set(LED_STATUS_NORMAL_BIT);
        buzzer_status_set(BUZZER_STATUS_NORMAL_BIT);

        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGE(TAG, "WiFi disconnected");

        led_status_set(LED_STATUS_DISCONNECTED_WIFI_BIT);
        buzzer_status_set(BUZZER_STATUS_DISCONNECTED_WIFI_BIT);

        safe_connect_wifi(); // Kết WiFi safe

        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ESP_LOGW(TAG, "WiFi got IP");

        led_status_set(LED_STATUS_NORMAL_BIT);
        buzzer_status_set(BUZZER_STATUS_NORMAL_BIT);
        
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "got ip:" IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } 

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STACONNECTED) {
        ESP_LOGW(TAG, "Station connected");

        led_status_set(LED_STATUS_STATION_PROVISIONING_BIT);
        buzzer_status_set(BUZZER_STATUS_STATION_PROVISIONING_BIT);

        wifi_event_ap_staconnected_t* event = (wifi_event_ap_staconnected_t*) event_data;
        ESP_LOGI(TAG, "station " MACSTR " join, AID=%d",
                MAC2STR(event->mac), event->aid);

        // Tạo QR code cho ứng dụng provisioning
        generate_provisioning_qr_code();
        
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STADISCONNECTED) {
        ESP_LOGW(TAG, "Station disconnected");
        wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
        ESP_LOGI(TAG, "station " MACSTR " leave, AID=%d",
                MAC2STR(event->mac), event->aid);
    }    
    
    else if (event_base == SC_EVENT && event_id == SC_EVENT_SCAN_DONE) {
        ESP_LOGI(TAG, "Scan done");
    } else if (event_base == SC_EVENT && event_id == SC_EVENT_FOUND_CHANNEL) {
        ESP_LOGI(TAG, "Found channel");
    } else if (event_base == SC_EVENT && event_id == SC_EVENT_GOT_SSID_PSWD) {
        ESP_LOGI(TAG, "Got SSID and password");

        smartconfig_event_got_ssid_pswd_t *evt = (smartconfig_event_got_ssid_pswd_t *)event_data;
        wifi_config_t wifi_config;
        uint8_t ssid[33] = { 0 };
        uint8_t password[65] = { 0 };

        bzero(&wifi_config, sizeof(wifi_config_t));
        memcpy(wifi_config.sta.ssid, evt->ssid, sizeof(wifi_config.sta.ssid));
        memcpy(wifi_config.sta.password, evt->password, sizeof(wifi_config.sta.password));
        wifi_config.sta.bssid_set = evt->bssid_set;
        if (wifi_config.sta.bssid_set == true) {
            memcpy(wifi_config.sta.bssid, evt->bssid, sizeof(wifi_config.sta.bssid));
        }

        memcpy(ssid, evt->ssid, sizeof(evt->ssid));
        memcpy(password, evt->password, sizeof(evt->password));
        ESP_LOGI(TAG, "SSID:%s", ssid);
        ESP_LOGI(TAG, "PASSWORD:%s", password);

        safe_disconnect_wifi();             // Ngắt kết nối WiFi safe hiện tại
        ESP_ERROR_CHECK( esp_wifi_set_config(WIFI_IF_STA, &wifi_config) );
        safe_connect_wifi();                // Kết nối WiFi safe mới   

    } else if (event_base == SC_EVENT && event_id == SC_EVENT_SEND_ACK_DONE) {
        ESP_LOGI(TAG, "ACK sent");
        xEventGroupSetBits(s_wifi_event_group, ESPTOUCH_DONE_BIT);
    }
}

bool is_provisioned(void)
{
    bool provisioned = false;
    // esp_netif_create_default_wifi_sta();
    // esp_netif_create_default_wifi_ap();
    
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    wifi_config_t wifi_config;
    esp_wifi_get_config(WIFI_IF_STA, &wifi_config); // get wifi

    ESP_LOGI(TAG, "wifi_config.sta.ssid[0]: 0x%02x", wifi_config.sta.ssid[0]);
    if (wifi_config.sta.ssid[0] != 0x00) // kiểm tra xem có wifi hay k
    {
        provisioned = true;
    }

    // Đánh dấu đang ở chế độ provisioning
    in_provisioning_mode = provisioned;

    return provisioned;
}

void ap_start(void)
{
    // Hủy default STA netif nếu đã tồn tại để tránh duplicate key khi tạo lại trong wifi_scan
    esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (sta_netif != NULL) {
        esp_netif_destroy(sta_netif);
    }
    // Kiểm tra và hủy interface AP cũ nếu đã tồn tại
    esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    if (ap_netif != NULL) {
        esp_netif_destroy(ap_netif);
    }

    // Tạo mới interface WiFi AP
    ap_netif = esp_netif_create_default_wifi_ap();
    assert(ap_netif);

    wifi_config_t wifi_config = {
        .ap = {
            .ssid = "wifi_config",
            .ssid_len = strlen((char*)"wifi_config"),
            .channel = 1,
            .password = "12345678",                     // mật khẩu ngắn quá thì cũng bị reset
            .max_connection = 4,                        // được 4 đứa kết nối vào
            .authmode = WIFI_AUTH_WPA_WPA2_PSK
        },
    };
    if (wifi_config.ap.password[0] == 0) {
        wifi_config.ap.authmode = WIFI_AUTH_OPEN;
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Log SSID và Password
    ESP_LOGW("AP_START", "Connect to the access point '%s' to configure WiFi for the device.", wifi_config.ap.ssid);
    ESP_LOGI(TAG, "SSID: %s", wifi_config.ap.ssid);
    ESP_LOGI(TAG, "Password: %s", wifi_config.ap.password);
}
char ssid[33] = { 0 };
char password[65] = { 0 };

void http_post_data_callback (char *buf, int len) {
    // Ensure null-termination
    if (len >= sizeof(ssid) + sizeof(password)) {
        ESP_LOGE(TAG, "POST data too long");
        return;
    }
    buf[len] = '\0'; // Null-terminate the received data

    // Parse ssid and password from "ssid=...&password=..."
    char *ssid_ptr = strstr(buf, "ssid=");
    char *pass_ptr = strstr(buf, "password=");

    if (ssid_ptr) {
        ssid_ptr += 5; // Move past "ssid="
        char *end = strchr(ssid_ptr, '&');
        if (end) *end = '\0';
        strlcpy(ssid, ssid_ptr, sizeof(ssid));
        ESP_LOGI(TAG, "SSID: %s", ssid);
    }

    if (pass_ptr) {
        pass_ptr += 9; // Move past "password="
        strlcpy(password, pass_ptr, sizeof(password));
        ESP_LOGI(TAG, "Password: %s", password);
    }

    xEventGroupSetBits(s_wifi_event_group, HTTP_CONFIG_DONE);
}

// Hàm helper: Quét WiFi, tạo JSON và lưu vào SPIFFS
static esp_err_t save_ssid_list_to_spiffs(void) {
    // Quét WiFi
    wifi_scan(ssid_array);
    if (ssid_array[0][0] == '\0') {
        ESP_LOGE(TAG, "No WiFi networks found");
        return ESP_FAIL;
    }

    // Tính toán kích thước buffer
    const int json_overhead = 30;
    int buffer_size = DEFAULT_SCAN_LIST_SIZE * (MAX_SSID_LENGTH + 5) + json_overhead;
    char *buffer = malloc(buffer_size);
    if (!buffer) {
        ESP_LOGE(TAG, "Memory allocation failed");
        return ESP_ERR_NO_MEM;
    }
    memset(buffer, 0, buffer_size);

    // Tạo JSON
    strcat(buffer, "{\"ssids\":[");
    bool first_entry = true;
    for (int i = 0; i < DEFAULT_SCAN_LIST_SIZE; i++) {
        if (ssid_array[i][0] != '\0') {
            if (!first_entry) strcat(buffer, ",");
            snprintf(buffer + strlen(buffer), buffer_size - strlen(buffer), 
                    "\"%s\"", ssid_array[i]);
            first_entry = false;
        }
    }
    strcat(buffer, "]}");

    // Ghi vào SPIFFS
    esp_err_t ret = storage_spiffs_write_file("/spiffs/ssid_list.json", buffer);
    free(buffer);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write JSON: %s", esp_err_to_name(ret));
        return ret;
    }

    return ESP_OK;
}

// Hàm helper: Khởi động AP và Webserver để provisioning
static void start_provisioning_ap(void) {
    led_status_set(LED_STATUS_PROVISIONING_BIT);
    buzzer_status_set(BUZZER_STATUS_PROVISIONING_BIT);

    // Lưu danh sách SSID vào SPIFFS
    if (save_ssid_list_to_spiffs() != ESP_OK) return;

    // Khởi động AP và Webserver
    ap_start();
    start_webserver();
    http_post_set_callback(http_post_data_callback);
}

// Hàm helper: Kết nối đến WiFi mới sau khi nhận cấu hình
static void connect_to_new_wifi(void) {
    // Dọn dẹp interface mạng
    esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    if (ap_netif) esp_netif_destroy(ap_netif);

    esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (sta_netif) esp_netif_destroy(sta_netif);

    // Tạo interface STA mới
    sta_netif = esp_netif_create_default_wifi_sta();
    assert(sta_netif);

    // Cấu hình WiFi
    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, password, sizeof(wifi_config.sta.password));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
}

void app_config(void)
{
    // Khởi tạo re_provision_task
    xTaskCreate(re_provision_task, "re_prov_task", 1024 * 4, NULL, 5, NULL);

    // Dang ký các sự kiện WiFi
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(SC_EVENT, ESP_EVENT_ANY_ID, &event_handler, NULL));

    s_wifi_event_group = xEventGroupCreate();

    bool provisioned = is_provisioned();
    if (!provisioned)
    {
        ESP_LOGI(TAG, "Starting provisioning via Access Point");
        start_provisioning_ap();
        xEventGroupWaitBits(s_wifi_event_group, HTTP_CONFIG_DONE, false, true, portMAX_DELAY);
        stop_webserver();
        connect_to_new_wifi();
        in_provisioning_mode = true;
    }
    else
    {
        wifi_config_t wifi_config;
        ESP_ERROR_CHECK(esp_wifi_get_config(WIFI_IF_STA, &wifi_config));
        ESP_LOGI(TAG, "Provisioned");
        ESP_LOGI(TAG, "Provisioned WiFi SSID: %s", wifi_config.sta.ssid);
        ESP_LOGI(TAG, "Provisioned WiFi Password: %s", wifi_config.sta.password);

        ESP_ERROR_CHECK(esp_wifi_start());

        // Thực hiện reconnect
        safe_disconnect_wifi();     // Ngắt kết nối WiFi safe hiện tại  
        safe_connect_wifi();        // Kết nối WiFi safe mới   
    }
    xEventGroupWaitBits(s_wifi_event_group , WIFI_CONNECTED_BIT, false, true, portMAX_DELAY); 
    ESP_LOGI(TAG, "wifi connected");
}

void re_provision_task(void *pvParameters) 
{
    s_wifi_event_reprovision_group = xEventGroupCreate();
    while(1) { 
        xEventGroupWaitBits(s_wifi_event_reprovision_group, REPROVISION_TRIGGER_BIT, true, true, portMAX_DELAY);
        
        // Dọn dẹp cấu hình cũ
        ESP_ERROR_CHECK(esp_wifi_stop());
        wifi_config_t empty_config = {0};
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &empty_config));

        // Reprovisioning
        ESP_LOGI(TAG, "Starting reprovisioning via Access Point");
        start_provisioning_ap();
        xEventGroupWaitBits(s_wifi_event_group, HTTP_CONFIG_DONE, false, true, portMAX_DELAY);
        stop_webserver();
        connect_to_new_wifi();
       
        // Đợi kết nối thành công
        xEventGroupWaitBits(s_wifi_event_group, WIFI_CONNECTED_BIT, false, true, portMAX_DELAY);
        ESP_LOGI("REPROV_TASK", "Reprovisioning complete, WiFi connected");
    }
}