#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_spiffs.h"
#include "esp_http_client.h"
#include "cJSON.h"

#include "smartconfig_webserver.h"
#include "button_ctrl.h"
#include "led_status.h"
#include "rfid_rc522.h"
#include "esp_crt_bundle.h"
#include "buzzer_status.h"
#include "firebase_wrapper.h"

// void init_spiffs(void)
// {
//     esp_vfs_spiffs_conf_t conf = {
//         .base_path = "/spiffs",
//         .partition_label = "spiffs", // Hoặc tên label tương ứng với partition table
//         .max_files = 5,
//         .format_if_mount_failed = true
//     };    

//     esp_err_t ret = esp_vfs_spiffs_register(&conf);
//     if (ret != ESP_OK) {
//         printf("Failed to mount SPIFFS (%d)\n", ret);
//     }
// }

// void save_json_file(const char *filename, const char *json_str)
// {
//     FILE *f = fopen(filename, "w");
//     if (f == NULL) {
//         printf("Failed to open file for writing\n");
//         return;
//     }
//     fprintf(f, "%s", json_str);
//     fclose(f);
//     printf("JSON file written: %s\n", filename);
// }

// void update_json_from_ssid_array(void)
// {
//     // Tạo đối tượng JSON gốc
//     cJSON *root = cJSON_CreateObject();
//     // Tạo mảng JSON chứa SSIDs
//     cJSON *ssid_list = cJSON_CreateArray();

//     for (int i = 0; i < DEFAULT_SCAN_LIST_SIZE; i++) {
//         if (strlen(ssid_array[i]) > 0) {
//             cJSON_AddItemToArray(ssid_list, cJSON_CreateString(ssid_array[i]));
//         }
//     }

//     // Thêm mảng SSIDs vào đối tượng root với key "ssids"
//     cJSON_AddItemToObject(root, "ssids", ssid_list);

//     // Chuyển đối tượng JSON thành chuỗi
//     char *json_str = cJSON_Print(root);
//     printf("Generated JSON:\n%s\n", json_str);

//     // Ghi chuỗi JSON vào file trên SPIFFS
//     save_json_file("/spiffs/ssid.json", json_str);

//     // Giải phóng bộ nhớ đã cấp phát cho JSON
//     cJSON_Delete(root);
//     free(json_str);
// }

void app_main(void)
{
    // Khởi tạo NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // // Khởi tạo SPIFFS để ghi file JSON
    // init_spiffs();

    // // Chuyển mảng ssid thành file JSON và ghi vào SPIFFS
    // update_json_from_ssid_array();
    
    // Khởi tạo component buzzer
    buzzer_status_start();

    // Khởi tạo component LED
    led_status_start();

    // Khởi tạo component button
    button_component_init();

    // Khởi tạo RFID
    init_rfid();

    // Khởi tạo webserver
    smartconfig_webserver_init();

    // Khởi tạo Firebase
    vTaskDelay(200 / portTICK_PERIOD_MS);
    firebase_wrapper();
}