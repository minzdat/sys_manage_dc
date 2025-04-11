#include "com_firestore.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "cJSON.h"
#include <ctype.h>

// Các header từ Firestore và hệ thống
#include "firebase_config.h"
#include "firebase_wrapper.h"
#include "sys_device.h"
#include "internal_rtc.h"
#include "sntp_service.h"

static const char *TAG = "COM_FIRESTORE";

// Các biến toàn cục dùng cho việc cập nhật thiết bị.
extern char g_lastBootTime[TIME_STR_SIZE];  
extern char *g_deviceId;
extern char g_resetReason[64];

// Queue để nhận sự kiện RFID
QueueHandle_t rfid_event_queue = NULL;

// Hàm chuyển đổi uptime sang định dạng ISO 8601 (P...T...)
char* calculate_uptime_device(time_t boot, time_t current)
{
    static char iso8601_str[32];
    uint32_t diff = (uint32_t)(current - boot);
    uint32_t days    = diff / 86400;
    uint32_t hours   = (diff % 86400) / 3600;
    uint32_t minutes = (diff % 3600) / 60;
    uint32_t seconds = diff % 60;

    snprintf(iso8601_str, sizeof(iso8601_str), "P%luDT%02luH%02luM%02luS",
             (unsigned long)days, (unsigned long)hours,
             (unsigned long)minutes, (unsigned long)seconds);
    return iso8601_str;
}

// Hàm chuyển đổi MAC thành chuỗi không dấu và chữ thường
void normalize_mac_address(const char *mac_in, char *mac_out, size_t out_size)
{
    size_t j = 0;
    for (size_t i = 0; mac_in[i] != '\0' && j < (out_size - 1); i++) {
        if (mac_in[i] != ':') {
            mac_out[j++] = (char)tolower(mac_in[i]);
        }
    }
    mac_out[j] = '\0';
}

void update_info_device_task(void *pvParameters)
{
    firestore_handle_t firestore = firestore_create(FIRESTORE_PROJECT_ID);
    if (!firestore) {
        ESP_LOGE(TAG, "Failed to create Firestore handle");
        vTaskDelete(NULL);
        return;
    }
    
    // Chuẩn bị chuỗi normalized MAC từ g_deviceId
    char norm_device_id[32] = {0};
    normalize_mac_address(g_deviceId, norm_device_id, sizeof(norm_device_id));

    // Tạo tên document theo định dạng "device_<normalized_mac>"
    char document_name[40] = {0};
    snprintf(document_name, sizeof(document_name), "device_%s", norm_device_id);
    
    cJSON *device_data = NULL;
    float temperature;
    int8_t rssi; 
    struct tm tm_update;    
    int result;
    char update_time[TIME_STR_SIZE] = {0}; 
    time_t now = 0, boot_time = 0;
    char *uptime = NULL;
    struct tm tm_boot;

    // Chuyển đổi chuỗi g_lastBootTime sang struct tm
    if (strptime(g_lastBootTime, "%Y-%m-%dT%H:%M:%S", &tm_boot) == NULL) {
        ESP_LOGW(TAG, "Failed to parse boot time string");
    } else {
        boot_time = mktime(&tm_boot);
    }

    while (1) {
        device_data = cJSON_CreateObject();
        if (!device_data) {
            ESP_LOGE(TAG, "Failed to create JSON object");
        } else {
            temperature = sys_device_get_temperature();
            rssi = sys_device_get_wifi_rssi();

            if (internal_rtc_get_time(&tm_update) == 0) {
                now = mktime(&tm_update); 
                if (strftime(update_time, sizeof(update_time), "%Y-%m-%dT%H:%M:%S", &tm_update) == 0) {
                    ESP_LOGW(TAG, "strftime failed");
                    strncpy(update_time, "unknown", sizeof(update_time));
                }
            } else {
                time(&now);
                strncpy(update_time, "unknown", sizeof(update_time));
            }
            uptime = calculate_uptime_device(boot_time, now);

            cJSON_AddStringToObject(device_data, "firmwareVersion", FIRMWARE_VERSION);
            cJSON_AddStringToObject(device_data, "uid", norm_device_id);
            cJSON_AddStringToObject(device_data, "rfidModuleType", MODULE_RFID_TYPE);
            cJSON_AddStringToObject(device_data, "acceptedCards", ACCEPTED_CARD_TYPE);
            cJSON_AddStringToObject(device_data, "lastBootTime", g_lastBootTime);
            cJSON_AddNumberToObject(device_data, "temperatureCelsius", temperature);
            cJSON_AddNumberToObject(device_data, "rssi", rssi);
            cJSON_AddStringToObject(device_data, "lastUpdateTime", update_time);
            cJSON_AddStringToObject(device_data, "uptime", uptime);
            cJSON_AddStringToObject(device_data, "startupInfo", g_resetReason);
        }

        // Kiểm tra sự tồn tại của document trên Firestore
        cJSON *existing_doc = firestore_get_document(firestore, "rfidReaderDevices", document_name);
        if (!existing_doc) {
            result = firestore_create_document(firestore, "rfidReaderDevices", document_name, device_data);
            if (result == 0) {
                ESP_LOGI(TAG, "Device registered successfully on Firestore");
            } else {
                ESP_LOGE(TAG, "Device registration failed, result = %d", result);
            }
        } else {
            cJSON_Delete(existing_doc);
            result = firestore_update_document(firestore, "rfidReaderDevices", document_name, device_data);
            if (result == 0) {
                ESP_LOGI(TAG, "Device data updated: temperature=%.2f °C, rssi=%d, update_time=%s, uptime=%s", 
                    temperature, rssi, update_time, uptime);
            } else {
                ESP_LOGE(TAG, "Failed to update device data, result = %d", result);
            }
        }
        cJSON_Delete(device_data);
        vTaskDelay(TIME_UPDATE_INFO_DEVICE / portTICK_PERIOD_MS);
    }

    firestore_destroy(firestore);
    vTaskDelete(NULL);
}

// Hàm khởi tạo task đăng ký thú cưng
void rfid_pet_registration_task(void *pvParameters)
{
    firestore_handle_t firestore = firestore_create(FIRESTORE_PROJECT_ID);
    if (!firestore) {
        ESP_LOGE(TAG, "Failed to create Firestore handle");
        vTaskDelete(NULL);
        return;
    }
    rfid_event_queue = xQueueCreate(10, sizeof(rfid_event_t));

    if (rfid_event_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create RFID event queue");
    } else {
        ESP_LOGI(TAG, "RFID event queue created successfully");
    }
    rfid_event_t rfid_event;
    while (1) {
        // Nhận sự kiện RFID từ queue
        if (xQueueReceive(rfid_event_queue, &rfid_event, portMAX_DELAY) == pdTRUE) {
            ESP_LOGI(TAG, "RFID event received: UID = %s, ReaderID = %s", rfid_event.uid, rfid_event.rfidReaderId);

            // Tạo JSON cho dữ liệu thú cưng
            cJSON *petData = cJSON_CreateObject();
            if (!petData) {
                ESP_LOGE(TAG, "Failed to create JSON object for pet data");
                continue;
            }

            cJSON_AddStringToObject(petData, "ownerId", "");  
            cJSON_AddStringToObject(petData, "name", "");
            cJSON_AddStringToObject(petData, "species", "");                 
            cJSON_AddStringToObject(petData, "breed", "");
            cJSON_AddNumberToObject(petData, "age", 0);
            cJSON_AddStringToObject(petData, "gender", "");
            cJSON_AddStringToObject(petData, "chipCard", ACCEPTED_CARD_TYPE);
            cJSON_AddStringToObject(petData, "uid", rfid_event.uid);

            // Lưu ID đầu đọc RFID từ sự kiện
            char norm_rfid_reader_id[32] = {0};
            normalize_mac_address( rfid_event.rfidReaderId, norm_rfid_reader_id, sizeof(norm_rfid_reader_id));
            cJSON_AddStringToObject(petData, "rfidReaderId", norm_rfid_reader_id);

            cJSON_AddStringToObject(petData, "status", "Registering");

            char update_time_regist[TIME_STR_SIZE] = {0}; 
            struct tm tm_update_regist;    
            if (internal_rtc_get_time(&tm_update_regist) == 0) {
                if (strftime(update_time_regist, sizeof(update_time_regist), "%Y-%m-%dT%H:%M:%S", &tm_update_regist) == 0) {
                    ESP_LOGW(TAG, "strftime failed");
                    strncpy(update_time_regist, "unknown", sizeof(update_time_regist));
                }
            } else {
                strncpy(update_time_regist, "unknown", sizeof(update_time_regist));
            }

            // Lưu thời gian cập nhật
            cJSON_AddStringToObject(petData, "createdAt", update_time_regist);
            cJSON_AddStringToObject(petData, "updatedAt", update_time_regist);

            // Tạo tên document theo định dạng "pet_<uid>"
            char document_name[80] = {0};
            snprintf(document_name, sizeof(document_name), "pet_%s", rfid_event.uid);

            int result = 0;
            // Kiểm tra sự tồn tại của document trên Firestore
            cJSON *existing_doc = firestore_get_document(firestore, "pets", document_name);
            if (!existing_doc) {
                // Nếu document không tồn tại, tạo mới
                result = firestore_create_document(firestore, "pets", document_name, petData);
                if (result == 0) {
                    ESP_LOGI(TAG, "Pet registration successful for UID: %s", rfid_event.uid);

                    // =========================================================
                    // Tạo Document cho Subcollection "Violations"
                    // =========================================================
                    cJSON *violationData = cJSON_CreateObject();
                    if (violationData) {
                        cJSON_AddStringToObject(violationData, "violationType", "None");
                        cJSON_AddStringToObject(violationData, "description", "None");
                        cJSON_AddStringToObject(violationData, "date", update_time_regist);
                        cJSON_AddStringToObject(violationData, "status", "Processing");
                        cJSON_AddStringToObject(violationData, "createdAt", update_time_regist);

                        // Đường dẫn tới subcollection "violations" nằm trong document pet
                        char violationPath[150] = {0};
                        snprintf(violationPath, sizeof(violationPath), "pets/%s/violations", document_name);

                        int violation_result = firestore_create_document(firestore, violationPath, "violation_001", violationData);
                        if (violation_result == 0) {
                            ESP_LOGI(TAG, "Subcollection 'violations' document created successfully for pet UID: %s", rfid_event.uid);
                        } else {
                            ESP_LOGE(TAG, "Failed to create document in subcollection 'violations', error code = %d", violation_result);
                        }
                        cJSON_Delete(violationData);
                    } else {
                        ESP_LOGE(TAG, "Failed to create JSON object for violation data");
                    }
                    
                } else {
                    ESP_LOGE(TAG, "Pet registration failed, error code = %d", result);
                }
            } else {
                // Nếu document đã tồn tại, bỏ qua lượt đăng ký này.
                ESP_LOGW(TAG, "Pet already registered for UID: %s, skipping registration.", rfid_event.uid);
                cJSON_Delete(existing_doc);
            }
            cJSON_Delete(petData);
        }
    }

    firestore_destroy(firestore);
    vTaskDelete(NULL);
}