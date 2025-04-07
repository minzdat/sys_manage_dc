#include "storage_spiffs.h"
#include "esp_log.h"
#include "esp_spiffs.h"
#include <stdio.h>
#include <string.h>

static const char *TAG = "storage_spiffs";
#define SPIFFS_BASE_PATH "/spiffs"

esp_err_t storage_spiffs_init(void)
{
    esp_vfs_spiffs_conf_t conf = {
        .base_path = SPIFFS_BASE_PATH,
        .partition_label = NULL,
        .max_files = 5,
        .format_if_mount_failed = true
    };

    // Khởi tạo và mount SPIFFS.
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize SPIFFS (%s)", esp_err_to_name(ret));
        return ret;
    }

    size_t total = 0, used = 0;
    ret = esp_spiffs_info(NULL, &total, &used);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get SPIFFS partition information (%s)", esp_err_to_name(ret));
        esp_spiffs_format(NULL);
        return ret;
    }
    ESP_LOGI(TAG, "SPIFFS Partition size: total: %d, used: %d", total, used);
    return ESP_OK;
}

esp_err_t storage_spiffs_write_file(const char *path, const char *data)
{
    FILE *f = fopen(path, "w");
    if (f == NULL) {
        ESP_LOGE(TAG, "Failed to open file for writing: %s", path);
        return ESP_FAIL;
    }
    fprintf(f, "%s", data);
    fclose(f);
    ESP_LOGI(TAG, "File written: %s", path);
    return ESP_OK;
}

esp_err_t storage_spiffs_read_file(const char *path, char *buffer, size_t len)
{
    FILE *f = fopen(path, "r");
    if (f == NULL) {
        ESP_LOGE(TAG, "Failed to open file for reading: %s", path);
        return ESP_FAIL;
    }
    if (fgets(buffer, len, f) == NULL) {
        ESP_LOGE(TAG, "Failed to read from file: %s", path);
        fclose(f);
        return ESP_FAIL;
    }
    fclose(f);
    // Loại bỏ ký tự xuống dòng nếu có.
    char *pos = strchr(buffer, '\n');
    if (pos) {
        *pos = '\0';
    }
    ESP_LOGI(TAG, "Read from file: %s", buffer);
    return ESP_OK;
}
