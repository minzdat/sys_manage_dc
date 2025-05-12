#include <iostream>
#include "esp_log.h"
#include "method_firestore.h"

#define METHOD_FIRESTORE_TAG "FIRESTORE_API"

namespace ESPFirebase {

Firestore::Firestore(FirebaseApp* app, const char* project_id, const char* database_id)
    : app(app), project_id(project_id), database_id(database_id)
{
    base_firestore_url = "https://firestore.googleapis.com/v1/projects/" + 
                        std::string(project_id) + 
                        "/databases/" + 
                        std::string(database_id) + 
                        "/documents/";
}

std::string Firestore::buildDocumentPath(const char* collection, const char* document) {
    std::string path = collection;
    if (document != nullptr) {
        path += "/" + std::string(document);
    }
    return path;
}

cJSON* Firestore::getDocument(const char* collection, const char* document) {
    std::string url = base_firestore_url + buildDocumentPath(collection, document);
    url += "?access_token=" + std::string(this->app->auth_token);

    http_ret_t http_ret = this->app->performRequest(url.c_str(), HTTP_METHOD_GET, "");
    if (http_ret.err == ESP_OK && http_ret.status_code == 200) {
        cJSON* response = cJSON_Parse(this->app->local_response_buffer);
        cJSON* fields = cJSON_GetObjectItem(response, "fields");
        this->app->clearHTTPBuffer();
        return fields ? cJSON_Duplicate(fields, true) : nullptr;
    } 
    else {
        ESP_LOGE(METHOD_FIRESTORE_TAG, "Get failed: %d", http_ret.status_code);
        return nullptr;
    }
}

esp_err_t Firestore::createDocument(const char* collection, const char* document, const cJSON* data) {
    std::string url = base_firestore_url + buildDocumentPath(collection);
    url += "?documentId=" + std::string(document) + "&access_token=" + std::string(this->app->auth_token);

    // Tạo cấu trúc Firestore fields
    cJSON* request_body = cJSON_CreateObject();
    cJSON* fields = cJSON_CreateObject();
    
    cJSON* item = data->child;
    while (item) {
        cJSON* field_obj = cJSON_CreateObject();
        if (cJSON_IsString(item)) {
            cJSON_AddStringToObject(field_obj, "stringValue", item->valuestring);
        } else if (cJSON_IsNumber(item)) {
            cJSON_AddNumberToObject(field_obj, "doubleValue", item->valuedouble);
        } // Thêm các kiểu dữ liệu khác nếu cần
        
        cJSON_AddItemToObject(fields, item->string, field_obj);
        item = item->next;
    }
    
    cJSON_AddItemToObject(request_body, "fields", fields);
    
    char* json_str = cJSON_Print(request_body);
    http_ret_t http_ret = this->app->performRequest(url.c_str(), HTTP_METHOD_POST, json_str);
    free(json_str);
    cJSON_Delete(request_body);

    return (http_ret.status_code == 200) ? ESP_OK : ESP_FAIL;
}

esp_err_t Firestore::updateDocument(const char* collection, const char* document, const cJSON* data) {
    std::string url = base_firestore_url + buildDocumentPath(collection, document);
    
    // Build updateMask with multiple fieldPaths parameters
    std::string update_mask;
    cJSON* item = data->child;
    while (item) {
        if (!update_mask.empty()) update_mask += "&";
        update_mask += "updateMask.fieldPaths=" + std::string(item->string);
        item = item->next;
    }
    
    // Append update_mask and access token
    url += "?" + update_mask;
    url += "&access_token=" + std::string(this->app->auth_token);

    // Rest of the code remains the same...
    cJSON* request_body = cJSON_CreateObject();
    cJSON* fields = cJSON_CreateObject();
    
    item = data->child;
    while (item) {
        cJSON* field_obj = cJSON_CreateObject();
        if (cJSON_IsString(item)) {
            cJSON_AddStringToObject(field_obj, "stringValue", item->valuestring);
        } else if (cJSON_IsNumber(item)) {
            cJSON_AddNumberToObject(field_obj, "doubleValue", item->valuedouble);
        }
        cJSON_AddItemToObject(fields, item->string, field_obj);
        item = item->next;
    }
    
    cJSON_AddItemToObject(request_body, "fields", fields);
    
    char* json_str = cJSON_Print(request_body);
    http_ret_t http_ret = this->app->performRequest(url.c_str(), HTTP_METHOD_PATCH, json_str);
    free(json_str);
    cJSON_Delete(request_body);

    return (http_ret.status_code == 200) ? ESP_OK : ESP_FAIL;
}

esp_err_t Firestore::patchDocument(const char* collection, const char* document, const cJSON* data) {
    // Xây dựng URL cho tài liệu
    std::string url = base_firestore_url + buildDocumentPath(collection, document);

    // Xây dựng update mask theo các field của data (tương tự như updateDocument)
    std::string update_mask;
    cJSON* item = data->child;
    while (item) {
        if (!update_mask.empty()) {
            update_mask += "&";
        }
        update_mask += "updateMask.fieldPaths=" + std::string(item->string);
        item = item->next;
    }

    // Nối update mask và access token vào URL
    url += "?" + update_mask;
    url += "&access_token=" + std::string(this->app->auth_token);

    // Tạo request body (định dạng tương ứng với Firestore API)
    cJSON* request_body = cJSON_CreateObject();
    cJSON* fields = cJSON_CreateObject();
    item = data->child;
    while (item) {
        cJSON* field_obj = cJSON_CreateObject();
        if (cJSON_IsString(item)) {
            cJSON_AddStringToObject(field_obj, "stringValue", item->valuestring);
        } else if (cJSON_IsNumber(item)) {
            cJSON_AddNumberToObject(field_obj, "doubleValue", item->valuedouble);
        }
        // Bạn có thể bổ sung xử lý cho các kiểu dữ liệu khác (như boolean, array, object) nếu cần
        cJSON_AddItemToObject(fields, item->string, field_obj);
        item = item->next;
    }
    cJSON_AddItemToObject(request_body, "fields", fields);

    // Chuyển request body sang chuỗi JSON
    char* json_str = cJSON_Print(request_body);
    ESP_LOGI(METHOD_FIRESTORE_TAG, "PATCH document URL: %s\nBody: %s", url.c_str(), json_str);

    // Thực hiện PATCH request
    http_ret_t http_ret = this->app->performRequest(url.c_str(), HTTP_METHOD_PATCH, json_str);

    free(json_str);
    cJSON_Delete(request_body);

    if (http_ret.err == ESP_OK && http_ret.status_code == 200) {
        ESP_LOGI(METHOD_FIRESTORE_TAG, "PATCH successful for document %s", document);
        return ESP_OK;
    } else {
        ESP_LOGE(METHOD_FIRESTORE_TAG, "PATCH failed for document %s, status code: %d", document, http_ret.status_code);
        return ESP_FAIL;
    }
}

esp_err_t Firestore::deleteDocument(const char* collection, const char* document) {
    std::string url = base_firestore_url + buildDocumentPath(collection, document);
    url += "?access_token=" + std::string(this->app->auth_token);

    http_ret_t http_ret = this->app->performRequest(url.c_str(), HTTP_METHOD_DELETE, "");
    return (http_ret.status_code == 200) ? ESP_OK : ESP_FAIL;
}

}