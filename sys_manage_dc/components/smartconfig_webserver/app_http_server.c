#include "app_http_server.h"
#include <esp_wifi.h>
#include <esp_event.h>
#include <esp_log.h>
#include <esp_system.h>
#include <sys/param.h>
#include "esp_netif.h"
#include <esp_http_server.h>
#include <string.h>
#include "cJSON.h"
#include "storage_spiffs.h"

/* A simple that demonstrates how to create GET and POST
 * handlers for the web server.
 */
extern const uint8_t index_html_start[] asm("_binary_webserver_html_start");
extern const uint8_t index_html_end[] asm("_binary_webserver_html_end");

static const char *TAG = "app_http_server";
static httpd_handle_t server = NULL;

static http_post_handle_t http_post_cb = NULL;

// Handler trả về danh sách SSID dạng JSON
static esp_err_t http_ssids_handler(httpd_req_t *req) {
    char *json_data = NULL;
    cJSON *root = cJSON_CreateObject();
    cJSON *ssid_array = cJSON_AddArrayToObject(root, "ssids");

    // Đọc SSID từ SPIFFS hoặc scan trực tiếp
    char buffer[512];
    if(storage_spiffs_read_file("/spiffs/ssid_list.json", buffer, sizeof(buffer)) == ESP_OK) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, buffer, strlen(buffer));
        return ESP_OK;
    }

    // Fallback nếu không đọc được file
    cJSON_AddItemToArray(ssid_array, cJSON_CreateString("WiFi_Network_1"));
    cJSON_AddItemToArray(ssid_array, cJSON_CreateString("WiFi_Network_2"));
    
    json_data = cJSON_PrintUnformatted(root);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_data, strlen(json_data));
    
    cJSON_Delete(root);
    free(json_data);
    return ESP_OK;
}

// Cấu hình route mới
static const httpd_uri_t http_ssids = {
    .uri = "/ssids",
    .method = HTTP_GET,
    .handler = http_ssids_handler,
    .user_ctx = NULL
};

/* An HTTP GET handler */
static esp_err_t http_get_handler(httpd_req_t *req)
{
    char *buf;
    size_t buf_len;

    /* Send response with custom headers and body set as the
     * string passed in user context*/
    httpd_resp_set_type(req, "text/html");
    const char *resp_str = (const char *)index_html_start;
    httpd_resp_send(req, resp_str, index_html_end - index_html_start);
    return ESP_OK;
}

static const httpd_uri_t http_get = {
    .uri = "/get",
    .method = HTTP_GET,
    .handler = http_get_handler,
    /* Let's pass response string in user
     * context to demonstrate it's usage */
    .user_ctx = "Hello World!"};

/* An HTTP POST handler */
static esp_err_t http_post_handler(httpd_req_t *req)
{
    char buf[100];
    int ret, data_len = req->content_len;

    /* Read the data for the request */
    httpd_req_recv(req, buf, data_len);
    /* Log data received */
    ESP_LOGI(TAG, "Data recv: %.*s", data_len, buf);
    http_post_cb(buf, data_len);
    // End response
    httpd_resp_send_chunk(req, NULL, 0);
    return ESP_OK;
}

static const httpd_uri_t http_post = {
    .uri = "/post",
    .method = HTTP_POST,
    .handler = http_post_handler,
    .user_ctx = NULL};

void start_webserver(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.lru_purge_enable = true;

    // Start the httpd server
    ESP_LOGI(TAG, "Starting server on port: '%d'", config.server_port);
    if (httpd_start(&server, &config) == ESP_OK)
    {
        // Set URI handlers
        ESP_LOGI(TAG, "Registering URI handlers");
        httpd_register_uri_handler(server, &http_get);
        httpd_register_uri_handler(server, &http_post);
        httpd_register_uri_handler(server, &http_ssids); 
    }
}

void stop_webserver(void)
{
    httpd_stop(server);
}

void http_post_set_callback(void *cb)
{
    if (cb)
    {
        http_post_cb = cb;
    }
}