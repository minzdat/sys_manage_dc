#ifndef SPIFFS_STORAGE_H
#define SPIFFS_STORAGE_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Khởi tạo SPIFFS.
 *
 * @return ESP_OK nếu khởi tạo thành công, ngược lại trả về mã lỗi.
 */
esp_err_t storage_spiffs_init(void);

/**
 * @brief Ghi dữ liệu vào file.
 *
 * @param path Đường dẫn đầy đủ của file (ví dụ: "/spiffs/hello.txt").
 * @param data Chuỗi dữ liệu cần ghi vào file.
 *
 * @return ESP_OK nếu ghi thành công, ngược lại trả về mã lỗi.
 */
esp_err_t storage_spiffs_write_file(const char *path, const char *data);

/**
 * @brief Đọc dữ liệu từ file.
 *
 * @param path Đường dẫn đầy đủ của file.
 * @param buffer Bộ nhớ chứa dữ liệu đọc được.
 * @param len Kích thước của buffer.
 *
 * @return ESP_OK nếu đọc thành công, ngược lại trả về mã lỗi.
 */
esp_err_t storage_spiffs_read_file(const char *path, char *buffer, size_t len);

#ifdef __cplusplus
}
#endif

#endif // SPIFFS_STORAGE_H
