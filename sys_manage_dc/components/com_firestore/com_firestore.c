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
#include "rfid_rc522.h"

static const char *TAG = "COM_FIRESTORE";

// Các biến toàn cục dùng cho việc cập nhật thiết bị.
extern char g_lastBootTime[TIME_STR_SIZE];  
extern char *g_deviceId;
extern char g_resetReason[64];

// Queue để nhận sự kiện RFID
QueueHandle_t rfid_event_queue = NULL;
QueueHandle_t rfid_response_queue = NULL;
QueueHandle_t rfid_delete_response_queue = NULL;
SemaphoreHandle_t rfid_write_done_sema = NULL;

// Hàm gửi tên thú cưng qua hàng đợi RFID
static esp_err_t send_rfid_data_by_status(firestore_handle_t firestore, const cJSON *existing_doc, const char *document_name) 
{
    if (!existing_doc) {
        ESP_LOGE(TAG, "Invalid document pointer");
        return ESP_ERR_INVALID_ARG;
    }

    // Hiển thị toàn bộ JSON document để debug
    // char *json_string = cJSON_Print(existing_doc);
    // if (json_string) {
    //     ESP_LOGI(TAG, "Document JSON:\n%s", json_string);
    //     free(json_string);
    // }

    rfid_response_t response = {0};
    response.success = true;

    // Đọc trường status
    const cJSON *status = cJSON_GetObjectItemCaseSensitive(existing_doc, "status");
    const cJSON *status_value = status ? cJSON_GetObjectItem(status, "stringValue") : NULL;

    if (!cJSON_IsString(status_value)) {
        ESP_LOGW(TAG, "Missing or invalid status");
        strncpy(response.status, "Invalid", sizeof(response.status) - 1);
    } else {
        strncpy(response.status, status_value->valuestring, sizeof(response.status) - 1);
    }

    // Nếu status là "Writing", trích xuất thêm dữ liệu
    if (strcmp(response.status, "Writing") == 0) {

        // In ra Owner ID nếu có
        const cJSON *owner = cJSON_GetObjectItemCaseSensitive(existing_doc, "ownerId");
        const cJSON *owner_value = owner ? cJSON_GetObjectItem(owner, "stringValue") : NULL;
        if (!cJSON_IsString(owner_value)) {
            ESP_LOGE(TAG, "Missing or invalid ownerId");
            return ESP_ERR_INVALID_ARG;
        }
        const char *ownerId = owner_value->valuestring;
        cJSON *owner_doc = firestore_get_document(firestore, "owners", ownerId);
        if (!owner_doc) {
            ESP_LOGE(TAG, "Failed to get owner document");
            return ESP_ERR_NOT_FOUND;
        }

        // Hiển thị toàn bộ JSON document để debug
        // char *json_owner_string = cJSON_Print(owner_doc);
        // if (json_owner_string) {
        //     ESP_LOGI(TAG, "Document JSON:\n%s", json_owner_string);
        //     free(json_owner_string);
        // }

        const cJSON *fullname_obj = cJSON_GetObjectItemCaseSensitive(owner_doc, "fullName");
        const cJSON *fullname_val = fullname_obj ? cJSON_GetObjectItem(fullname_obj, "stringValue") : NULL;
        if (cJSON_IsString(fullname_val)) {
            strncpy(response.data.fullName, fullname_val->valuestring, sizeof(response.data.fullName) - 1);
        } else {
            ESP_LOGW(TAG, "Missing/invalid owner fullName");
        }

        const cJSON *phone_obj = cJSON_GetObjectItemCaseSensitive(owner_doc, "phone");
        const cJSON *phone_val = phone_obj ? cJSON_GetObjectItem(phone_obj, "stringValue") : NULL;
        if (cJSON_IsString(phone_val)) {
            strncpy(response.data.phone, phone_val->valuestring, sizeof(response.data.phone) - 1);
        } else {
            ESP_LOGW(TAG, "Missing/invalid owner phone");
        }

        cJSON_Delete(owner_doc);
    
        struct {
            const char *field;
            char *dest;
            size_t size;
        } fields[] = {
            {"name", response.data.name, sizeof(response.data.name)},
            {"breed", response.data.breed, sizeof(response.data.breed)},
            {"gender", response.data.gender, sizeof(response.data.gender)},
            // {"healthStatus", response.data.healthStatus, sizeof(response.data.healthStatus)},
            // {"vaccinationStatus", response.data.vaccinationStatus, sizeof(response.data.vaccinationStatus)},
            // {"violationStatus", response.data.violationStatus, sizeof(response.data.violationStatus)},
            {"ownerId", response.data.ownerId, sizeof(response.data.ownerId)},
        };

        for (int i = 0; i < sizeof(fields) / sizeof(fields[0]); ++i) {
            const cJSON *obj = cJSON_GetObjectItemCaseSensitive(existing_doc, fields[i].field);
            const cJSON *val = obj ? cJSON_GetObjectItem(obj, "stringValue") : NULL;
            if (cJSON_IsString(val)) {
                strncpy(fields[i].dest, val->valuestring, fields[i].size - 1);
            } else {
                ESP_LOGW(TAG, "Missing/invalid string: %s", fields[i].field);
            }
        }

        // Tuổi dạng double
        const cJSON *age = cJSON_GetObjectItemCaseSensitive(existing_doc, "age");
        const cJSON *age_val = age ? cJSON_GetObjectItem(age, "integerValue") : NULL;

        if (cJSON_IsString(age_val)) {
            char* endptr;
            response.data.age = strtod(age_val->valuestring, &endptr);
            if (*endptr != '\0') {
                ESP_LOGW(TAG, "Invalid age format: %s", age_val->valuestring);
                response.data.age = 0.0;
            }
        } else {
            ESP_LOGW(TAG, "Missing/invalid age");
            response.data.age = 0.0;
        }
    }

    // Luôn gửi dữ liệu vào hàng đợi
    BaseType_t q_result = xQueueSend(rfid_response_queue, &response, pdMS_TO_TICKS(5000));
    if (q_result != pdTRUE) {
        ESP_LOGE(TAG, "Queue send failed");
        return ESP_ERR_TIMEOUT;
    }

    ESP_LOGI(TAG, "RFID response sent - Status: %s", response.status);

    // Chỉ chờ semaphore nếu status là "Writing"
    if (strcmp(response.status, "Writing") == 0) {
        // Chờ semaphore từ phía ghi thẻ
        if (xSemaphoreTake(rfid_write_done_sema, pdMS_TO_TICKS(5000)) == pdTRUE) {
            ESP_LOGI(TAG, "RFID write done signal received");

            // Tạo JSON để cập nhật status thành "Active"
            cJSON *update_data = cJSON_CreateObject();
            cJSON_AddStringToObject(update_data, "status", "Active");

            // Gọi API cập nhật Firestore
            int result = firestore_update_document(firestore, "pets", document_name, update_data);
            if (result == 0) {
                ESP_LOGI(TAG, "Firestore updated successfully");
            } else {
                ESP_LOGE(TAG, "Update Firestore error: %d", result);
            }

            // Giải phóng tài nguyên
            cJSON_Delete(update_data);
        } else {
            ESP_LOGW(TAG, "Timeout waiting for write completion");
            return ESP_ERR_TIMEOUT;
        }
    }

    return ESP_OK;
}

// Hàm chuyển đổi uptime sang định dạng ISO 8601 (P...T...)
void calculate_uptime_device(time_t boot, time_t current, char *out_buf, size_t buf_size)
{
    uint32_t diff = (uint32_t)(current - boot);
    uint32_t days = diff / 86400;
    uint32_t hours = (diff % 86400) / 3600;
    uint32_t minutes = (diff % 3600) / 60;
    uint32_t seconds = diff % 60;

    snprintf(out_buf, buf_size, "P%luDT%02luH%02luM%02luS",
             (unsigned long)days, (unsigned long)hours,
             (unsigned long)minutes, (unsigned long)seconds);
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

    // Chuẩn hóa g_deviceId thành chuỗi MAC
    char norm_device_id[32] = {0};
    normalize_mac_address(g_deviceId, norm_device_id, sizeof(norm_device_id));

    // Tên document = "device_<normalized_mac>"
    char document_name[40] = {0};
    snprintf(document_name, sizeof(document_name), "device_%s", norm_device_id);

    float temperature;
    int8_t rssi;
    time_t now = 0, boot_time = 0;
    char update_time[TIME_STR_SIZE] = {0};
    struct tm tm_update, tm_boot;

    static bool device_registered = false;
    static bool boot_info_updated = false;

    // Phân tích g_lastBootTime thành thời gian thực
    if (strptime(g_lastBootTime, "%Y-%m-%dT%H:%M:%S", &tm_boot)) {
        boot_time = mktime(&tm_boot);
    } else {
        ESP_LOGW(TAG, "Failed to parse boot time string");
        time(&boot_time);
    }

    while (1) {
        temperature = sys_device_get_temperature();
        rssi = sys_device_get_wifi_rssi();

        // Lấy thời gian hiện tại
        if (internal_rtc_get_time(&tm_update) == 0) {
            now = mktime(&tm_update);
            if (strftime(update_time, sizeof(update_time), "%Y-%m-%dT%H:%M:%S", &tm_update) == 0) {
                strncpy(update_time, "unknown", sizeof(update_time));
            }
        } else {
            time(&now);
            strncpy(update_time, "unknown", sizeof(update_time));
        }

        char uptime[32] = {0};
        calculate_uptime_device(boot_time, now, uptime, sizeof(uptime));

        if (!device_registered) {
            // Kiểm tra xem document có tồn tại chưa
            cJSON *existing_doc = firestore_get_document(firestore, "rfidReaderDevices", document_name);
            if (!existing_doc) {
                // Tạo dữ liệu khởi tạo thiết bị
                cJSON *init_data = cJSON_CreateObject();
                if (init_data) {
                    cJSON_AddStringToObject(init_data, "firmwareVersion", FIRMWARE_VERSION);
                    cJSON_AddStringToObject(init_data, "rfidModelType", MODULE_RFID_TYPE);
                    cJSON_AddStringToObject(init_data, "acceptedCards", ACCEPTED_CARD_TYPE);
                    cJSON_AddStringToObject(init_data, "lastBootTime", g_lastBootTime);
                    cJSON_AddStringToObject(init_data, "startupInfo", g_resetReason);
                    cJSON_AddStringToObject(init_data, "status", "Active"); 
                    cJSON_AddNumberToObject(init_data, "temperatureCelsius", temperature);
                    cJSON_AddNumberToObject(init_data, "rssi", rssi);
                    cJSON_AddStringToObject(init_data, "lastUpdateTime", update_time);
                    cJSON_AddStringToObject(init_data, "uptime", uptime);
                    cJSON_AddStringToObject(init_data, "createAt", g_lastBootTime);

                    int result = firestore_create_document(firestore, "rfidReaderDevices", document_name, init_data);
                    if (result == 0) {
                        ESP_LOGI(TAG, "Device registered successfully");
                        device_registered = true;
                        boot_info_updated = true;
                    } else {
                        ESP_LOGE(TAG, "Device registration failed, result = %d", result);
                    }

                    cJSON_Delete(init_data);
                }
            } else {
                device_registered = true;
                cJSON_Delete(existing_doc);
            }
        } 
        // Nếu đã đăng ký và chưa cập nhật boot info sau reset, thì update
        if (device_registered && !boot_info_updated) {
            cJSON *boot_update = cJSON_CreateObject();
            if (boot_update) {
                cJSON_AddStringToObject(boot_update, "lastBootTime", g_lastBootTime);
                cJSON_AddStringToObject(boot_update, "startupInfo", g_resetReason);

                int result = firestore_update_document(firestore, "rfidReaderDevices", document_name, boot_update);
                if (result == 0) {
                    ESP_LOGI(TAG, "Boot info updated after device reset");
                    boot_info_updated = true;
                } else {
                    ESP_LOGE(TAG, "Failed to update boot info, result = %d", result);
                }

                cJSON_Delete(boot_update);
            }
        }
        
        // Cập nhật thông tin định kỳ
        if (device_registered) {
            // Chỉ cập nhật thông tin thay đổi thường xuyên
            cJSON *update_data = cJSON_CreateObject();
            if (update_data) {
                cJSON_AddNumberToObject(update_data, "temperatureCelsius", temperature);
                cJSON_AddNumberToObject(update_data, "rssi", rssi);
                cJSON_AddStringToObject(update_data, "lastUpdateTime", update_time);
                cJSON_AddStringToObject(update_data, "uptime", uptime);

                int result = firestore_update_document(firestore, "rfidReaderDevices", document_name, update_data);
                if (result == 0) {
                    ESP_LOGI(TAG, "Device updated: temp=%.2f, rssi=%d, time=%s, uptime=%s", temperature, rssi, update_time, uptime);
                } else {
                    ESP_LOGE(TAG, "Device update failed, result = %d", result);
                }

                cJSON_Delete(update_data);
            }
        }

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

    rfid_response_queue = xQueueCreate(10, sizeof(rfid_response_t));
    if (rfid_response_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create RFID event queue");
    } else {
        ESP_LOGI(TAG, "RFID response queue created successfully");
    }

    rfid_delete_response_queue = xQueueCreate(10, sizeof(rfid_response_t));
    if (rfid_delete_response_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create RFID event queue");
    } else {
        ESP_LOGI(TAG, "RFID delete response queue created successfully");
    }
    
    rfid_event_t rfid_event;

    while (1) {
        // Nhận sự kiện RFID từ queue
        if (xQueueReceive(rfid_event_queue, &rfid_event, portMAX_DELAY) == pdTRUE) {
            if ((rfid_event.action & RFID_ACTION_REGIST_SER) == RFID_ACTION_REGIST_SER) {
                ESP_LOGI(TAG, "RFID event received: UID = %s, ReaderID = %s", rfid_event.uid, rfid_event.rfidReaderId);

                // Tạo JSON cho dữ liệu thú cưng
                cJSON *petData = cJSON_CreateObject();
                if (!petData) {
                    ESP_LOGE(TAG, "Failed to create JSON object for pet data");
                    continue;
                }

                cJSON_AddStringToObject(petData, "name", "");
                cJSON_AddNumberToObject(petData, "age", 0);
                cJSON_AddStringToObject(petData, "species", "");                 
                cJSON_AddStringToObject(petData, "breed", "");
                cJSON_AddStringToObject(petData, "gender", "");
                cJSON_AddStringToObject(petData, "ownerId", "");  

                // Lưu ID đầu đọc RFID từ sự kiện
                char norm_rfid_reader_id[32] = {0};
                normalize_mac_address( rfid_event.rfidReaderId, norm_rfid_reader_id, sizeof(norm_rfid_reader_id));

                char rfid_reader_id_store[40] = {0};
                snprintf(rfid_reader_id_store, sizeof(rfid_reader_id_store), "device_%s", norm_rfid_reader_id);

                cJSON_AddStringToObject(petData, "rfidReaderId", rfid_reader_id_store);

                cJSON_AddStringToObject(petData, "chipCard", ACCEPTED_CARD_TYPE);
                cJSON_AddStringToObject(petData, "status", "Processing");

                // Lưu thời gian cập nhật
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
                cJSON_AddStringToObject(petData, "createdAt", update_time_regist);
                cJSON_AddStringToObject(petData, "lastUpdateTime", update_time_regist);

                // Chuẩn hóa g_deviceId thành chuỗi MAC
                char norm_device_id[32] = {0};
                normalize_mac_address(g_deviceId, norm_device_id, sizeof(norm_device_id));

                // Tên document = "device_<normalized_mac>"
                char account_modified[40] = {0};
                snprintf(account_modified, sizeof(account_modified), "device_%s", norm_device_id);

                cJSON_AddStringToObject(petData, "lastModifiedBy", "");
                // cJSON_AddStringToObject(petData, "lastSeenAt", last_seen_time);
                cJSON_AddStringToObject(petData, "healthStatus", "Normal");                 
                cJSON_AddStringToObject(petData, "lastCheckHealthDate", update_time_regist);
                cJSON_AddStringToObject(petData, "vaccinationStatus", "");                 
                cJSON_AddStringToObject(petData, "lastVaccineDate", update_time_regist);
                cJSON_AddStringToObject(petData, "violationStatus", "");                 
                cJSON_AddStringToObject(petData, "lastViolationDate", update_time_regist);

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
                        cJSON *new_doc = firestore_get_document(firestore, "pets", document_name);
                        if (new_doc) {
                            send_rfid_data_by_status(firestore, new_doc, document_name);
                            cJSON_Delete(new_doc);
                        }
                    } else {
                        ESP_LOGE(TAG, "Pet registration failed, error code = %d", result);
                    }
                } else {
                    send_rfid_data_by_status(firestore, existing_doc, document_name);
                    ESP_LOGW(TAG, "Pet already registered for UID: %s, skipping registration.", rfid_event.uid);
                    cJSON_Delete(existing_doc);
                }
                cJSON_Delete(petData);
            } else if ((rfid_event.action & RFID_ACTION_DELETE_SPECIFIED) == RFID_ACTION_DELETE_SPECIFIED) {
                ESP_LOGI(TAG, "RFID delete event received: UID = %s", rfid_event.uid);

                // Tạo tên document theo định dạng "pet_<uid>"
                char document_name[80] = {0};
                snprintf(document_name, sizeof(document_name), "pet_%s", rfid_event.uid);

                rfid_response_t response = {0};
                
                // Gọi hàm xóa document
                int delete_result = firestore_delete_document(firestore, "pets", document_name);
                if (delete_result == 0) {
                    ESP_LOGI(TAG, "Successfully deleted pet document: %s", document_name);    
                    response.success = true;
                    // Luôn gửi dữ liệu vào hàng đợi
                    BaseType_t q_result = xQueueSend(rfid_delete_response_queue, &response, pdMS_TO_TICKS(5000));
                    if (q_result != pdTRUE) {
                        ESP_LOGE(TAG, "Queue send failed");
                        return;
                    }

                    ESP_LOGI(TAG, "RFID delete response sent successfully");
                } else {
                    ESP_LOGE(TAG, "Failed to delete pet document: %s (error code = %d)", document_name, delete_result);
                    response.success = false;
                    // Luôn gửi dữ liệu vào hàng đợi
                    BaseType_t q_result = xQueueSend(rfid_delete_response_queue, &response, pdMS_TO_TICKS(5000));
                    if (q_result != pdTRUE) {
                        ESP_LOGE(TAG, "Queue send failed");
                        return;
                    }

                    ESP_LOGE(TAG, "RFID delete response sent failed");
                }
            } else if ((rfid_event.action & RFID_ACTION_NOTIFY_IF_HAS_DATA) == RFID_ACTION_NOTIFY_IF_HAS_DATA) {
                ESP_LOGI(TAG, "RFID notify event received: UID = %s, ReaderID = %s", rfid_event.uid, rfid_event.rfidReaderId);
            
                struct tm tm_now;
                char timestamp[32] = "unknown";
                if (internal_rtc_get_time(&tm_now) == 0) {
                    strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", &tm_now);
                }
            
                // Chuẩn hóa rfidReaderId (gống như g_deviceId)
                char norm_reader_id[32] = {0};
                normalize_mac_address(rfid_event.rfidReaderId, norm_reader_id, sizeof(norm_reader_id));
                // Tạo giá trị "device_<normalized_mac>"
                char rfid_reader_id_store[40] = {0};
                snprintf(rfid_reader_id_store, sizeof(rfid_reader_id_store), "device_%s", norm_reader_id);
                
                // Tạo document ID dạng "notif_<uid>"
                char doc_id[64];
                snprintf(doc_id, sizeof(doc_id), "notif_%s", rfid_event.uid);
            
                // Tạo nội dung thông báo
                cJSON *notif = cJSON_CreateObject();
                if (!notif) {
                    ESP_LOGE(TAG, "Failed to create JSON object for notification");
                    continue;
                }
            
                cJSON_AddStringToObject(notif, "message", "Notification");
                cJSON_AddStringToObject(notif, "time", timestamp);
                cJSON_AddStringToObject(notif, "rfidReaderId", rfid_reader_id_store);

                char petId[64];
                snprintf(petId, sizeof(petId), "pet_%s", rfid_event.uid); 
                cJSON_AddStringToObject(notif, "petId", petId);
            
                // Kiểm tra document đã tồn tại chưa
                cJSON *existing_doc = firestore_get_document(firestore, "notifications", doc_id);
                int result;
            
                if (existing_doc) {
                    result = firestore_update_document(firestore, "notifications", doc_id, notif);
                    if (result == 0) {
                        ESP_LOGI(TAG, "Notification updated for UID: %s", rfid_event.uid);
                    } else {
                        ESP_LOGE(TAG, "Failed to update notification for UID: %s, result = %d", rfid_event.uid, result);
                    }
                    cJSON_Delete(existing_doc);
                } else {
                    result = firestore_create_document(firestore, "notifications", doc_id, notif);
                    if (result == 0) {
                        ESP_LOGI(TAG, "Notification created for UID: %s", rfid_event.uid);
                    } else {
                        ESP_LOGE(TAG, "Failed to create notification for UID: %s, result = %d", rfid_event.uid, result);
                    }
                }
            
                cJSON_Delete(notif);
            } else {
                ESP_LOGW(TAG, "Unknown RFID action: %d", rfid_event.action);
            }
        }
    }

    firestore_destroy(firestore);
    vTaskDelete(NULL);
}