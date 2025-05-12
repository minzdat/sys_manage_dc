#include "rfid_rc522.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "esp_log.h"
#include <esp_check.h>
#include "rc522.h"
#include "picc/rc522_mifare.h"
#include "led_status.h"
#include "buzzer_status.h"
#include "internal_rtc.h"

static const char *TAG = "RFID_RC522";

char last_seen_time[64] = {0};
uint8_t action_rfid_card = RFID_ACTION_READ_SPECIFIED;

static rc522_spi_config_t driver_config = {
    .host_id = SPI3_HOST,
    .bus_config = &(spi_bus_config_t){
        .miso_io_num = RC522_SPI_BUS_GPIO_MISO,
        .mosi_io_num = RC522_SPI_BUS_GPIO_MOSI,
        .sclk_io_num = RC522_SPI_BUS_GPIO_SCLK,
    },
    .dev_config = {
        .spics_io_num = RC522_SPI_SCANNER_GPIO_SDA,
    },
    .rst_io_num = RC522_SCANNER_GPIO_RST,
};

static rc522_driver_handle_t driver;
static rc522_handle_t scanner;

static void hex_buffer_to_string(const uint8_t *hex_buffer, size_t len, char *output)
{
    for (size_t i = 0; i < len; i++) {
        // Nếu byte thuộc khoảng ký tự in được (32 đến 126), copy trực tiếp.
        if (hex_buffer[i] >= 32 && hex_buffer[i] <= 126) {
            output[i] = (char)hex_buffer[i];
        } else {
            output[i] = '.';
        }
    }
    // Thêm ký tự kết thúc chuỗi
    output[len] = '\0';
}

static void dump_block(uint8_t buffer[RC522_MIFARE_BLOCK_SIZE])
{
    for (uint8_t i = 0; i < RC522_MIFARE_BLOCK_SIZE; i++) {
        esp_log_write(ESP_LOG_INFO, TAG, "%02" RC522_X " ", buffer[i]);
    }

    esp_log_write(ESP_LOG_INFO, TAG, "\n");
}

static esp_err_t read_all_memory(rc522_handle_t scanner, rc522_picc_t *picc) 
{
    rc522_mifare_key_t key = { .value = { RC522_MIFARE_KEY_VALUE_DEFAULT } };
    // Với MIFARE 1K: 16 sector, mỗi sector có 4 block.
    for (uint8_t sector = 0; sector < 16; sector++) {
        ESP_LOGI(TAG, "Reading data of sector %d:", sector);
        // Mỗi sector có 4 block, block cuối cùng là trailer.
        // Lặp qua từng block trong sector.
        for (uint8_t blk_offset = 0; blk_offset < 4; blk_offset++) {
            uint8_t block_addr = sector * 4 + blk_offset;
            // Thực hiện xác thực cho mỗi block (trong thực tế bạn cần tránh xác thực lại block trailer nếu không muốn ghi đè vào khóa)
            esp_err_t ret = rc522_mifare_auth(scanner, picc, block_addr, &key);
            if (ret != ESP_OK) {
                ESP_LOGW(TAG, "Auth failed at block %d, skipping", block_addr);
                continue;
            }
            uint8_t read_buffer[RC522_MIFARE_BLOCK_SIZE] = {0};
            ret = rc522_mifare_read(scanner, picc, block_addr, read_buffer);
            if (ret != ESP_OK) {
                ESP_LOGW(TAG, "Reading block %d failed, err=0x%02X", block_addr, ret);
                continue;
            }
            // In dữ liệu block: hiện dưới dạng hex và (nếu có thể) dưới dạng ký tự.
            ESP_LOGI(TAG, "Block %d:", block_addr);
            for (int i = 0; i < RC522_MIFARE_BLOCK_SIZE; i++) {
                printf("%02X ", read_buffer[i]);
            }
            printf("\n");

            // Chuyển đổi buffer hex thành chuỗi ký tự và in ra
            char output_string[RC522_MIFARE_BLOCK_SIZE + 1];
            hex_buffer_to_string(read_buffer, RC522_MIFARE_BLOCK_SIZE - 2, output_string);
            printf("Chars: %s\n", output_string);
        }
    }
    return ESP_OK;
}

static esp_err_t read_specified_memory(rc522_handle_t scanner, rc522_picc_t *picc, uint8_t block_addr, bool *has_data_out)
{
    rc522_mifare_key_t key = { .value = { RC522_MIFARE_KEY_VALUE_DEFAULT } };
    esp_err_t ret;

    if (has_data_out) *has_data_out = false;

    // Xác thực cho block được chỉ định
    ret = rc522_mifare_auth(scanner, picc, block_addr, &key);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Auth failed at block %d, cannot read data", block_addr);
        return ret;
    }

    uint8_t read_buffer[RC522_MIFARE_BLOCK_SIZE] = {0};
    ret = rc522_mifare_read(scanner, picc, block_addr, read_buffer);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Reading block %d failed, err=0x%02X", block_addr, ret);
        return ret;
    }

    // Kiểm tra block có dữ liệu hay không (chỉ xét 14 byte đầu)
    bool has_data = false;
    for (int i = 0; i < RC522_MIFARE_BLOCK_SIZE - 2; i++) {
        if (read_buffer[i] != 0x00 && read_buffer[i] != 0xFF) {
            if (has_data_out) *has_data_out = true;
            has_data = true;
            break;
        }
    }

    if (has_data) {
        ESP_LOGI(TAG, "Block %d contains valid data.", block_addr);
    } else {
        ESP_LOGW(TAG, "Block %d appears empty or uninitialized.", block_addr);
    }
    
    // In dữ liệu block: hiển thị dưới dạng hex
    ESP_LOGI(TAG, "Reading data from block %d:", block_addr);
    for (int i = 0; i < RC522_MIFARE_BLOCK_SIZE; i++) {
        printf("%02X ", read_buffer[i]);
    }
    printf("\n");

    // Chuyển đổi buffer hex thành chuỗi ký tự và in ra
    char output_string[RC522_MIFARE_BLOCK_SIZE + 1];
    hex_buffer_to_string(read_buffer, RC522_MIFARE_BLOCK_SIZE - 2, output_string);
    printf("Chars: %s\n", output_string);

    return ESP_OK;
}

static esp_err_t write_specified_memory(rc522_handle_t scanner, rc522_picc_t *picc, const char *data, uint8_t block_addr)
{
    rc522_mifare_key_t key = { .value = { RC522_MIFARE_KEY_VALUE_DEFAULT } };
    esp_err_t ret = ESP_OK;

    // Kiểm tra độ dài dữ liệu: tối đa 14 ký tự (để lại 2 byte cho giá trị ngẫu nhiên)
    if (strlen(data) > 14) {
        ESP_LOGW(TAG, "Data length must be no more than 14 characters");
        ESP_LOGW(TAG, "because the last two bytes will be set randomly");
        return ESP_ERR_INVALID_ARG;
    }

    // Xác thực cho block được chỉ định
    ESP_RETURN_ON_ERROR(rc522_mifare_auth(scanner, picc, block_addr, &key), TAG, "auth fail");

    uint8_t read_buffer[RC522_MIFARE_BLOCK_SIZE] = {0};
    uint8_t write_buffer[RC522_MIFARE_BLOCK_SIZE] = {0};

    // --- Bước 1: Đọc dữ liệu hiện có để hiển thị ---
    ESP_LOGI(TAG, "Reading data from block %d", block_addr);
    ESP_RETURN_ON_ERROR(rc522_mifare_read(scanner, picc, block_addr, read_buffer), TAG, "read fail");
    ESP_LOGI(TAG, "Current data:");
    dump_block(read_buffer);

    // --- Bước 2: Chuẩn bị dữ liệu mới cần ghi ---
    // Copy dữ liệu từ tham số (không vượt quá 16 byte, với 2 byte cuối dành cho random)
    strncpy((char *)write_buffer, data, RC522_MIFARE_BLOCK_SIZE);
    // Set ngẫu nhiên cho 2 byte cuối để đảm bảo dữ liệu thay đổi mỗi lần ghi
    int r = rand();
    write_buffer[RC522_MIFARE_BLOCK_SIZE - 2] = (r >> 8) & 0xFF; // Byte 14
    write_buffer[RC522_MIFARE_BLOCK_SIZE - 1] = r & 0xFF;        // Byte 15

    ESP_LOGI(TAG, "Writing data (%s) to block %d:", data, block_addr);
    dump_block(write_buffer);
    ESP_RETURN_ON_ERROR(rc522_mifare_write(scanner, picc, block_addr, write_buffer), TAG, "write fail");

    // --- Bước 3: Đọc lại dữ liệu và xác minh ---
    ESP_LOGI(TAG, "Write done. Verifying...");
    ESP_RETURN_ON_ERROR(rc522_mifare_read(scanner, picc, block_addr, read_buffer), TAG, "read fail");
    ESP_LOGI(TAG, "New data in block %d:", block_addr);
    dump_block(read_buffer);

    bool rw_mismatch = false;
    uint8_t i;
    for (i = 0; i < RC522_MIFARE_BLOCK_SIZE; i++) {
        if (write_buffer[i] != read_buffer[i]) {
            rw_mismatch = true;
            break;
        }
    }
    if (!rw_mismatch) {
        ESP_LOGI(TAG, "Verified.");
    } else {
        ESP_LOGE(TAG, "Write failed. RW mismatch at byte %d (w:%02" RC522_X ", r:%02" RC522_X ")", i, write_buffer[i], read_buffer[i]);
        dump_block(write_buffer);
        dump_block(read_buffer);
        return ESP_FAIL;
    }
    return ESP_OK;
}

esp_err_t write_data_to_blocks(rc522_handle_t scanner, rc522_picc_t *picc, const char *data, uint8_t *block_num) {
    size_t data_len = strlen(data);
    const char *data_ptr = data;
    uint8_t current_block = *block_num;

    while (data_len > 0) {
        // Bỏ qua trailer block (block % 4 == 3)
        while ((current_block % 4) == 3) {
            current_block++;
            if (current_block >= 64) {
                ESP_LOGE(TAG, "Exceeded block limit");
                return ESP_ERR_NO_MEM;
            }
        }

        // Copy tối đa 14 byte vào block_data (để trống 2 byte cuối)
        size_t copy_len = (data_len < 14) ? data_len : 14;
        char block_data[RC522_MIFARE_BLOCK_SIZE] = {0}; // Tự động khởi tạo toàn bộ block thành 0
        memcpy(block_data, data_ptr, copy_len);

        // Gọi hàm write_specified_memory để ghi block (2 byte cuối sẽ được thêm ở đây)
        esp_err_t ret = write_specified_memory(scanner, picc, block_data, current_block);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to write block %d", current_block);
            return ret;
        }

        // Cập nhật con trỏ và block hiện tại
        data_ptr += copy_len;
        data_len -= copy_len;
        current_block++;

        if (current_block >= 64) {
            ESP_LOGE(TAG, "Exceeded block limit");
            return ESP_ERR_NO_MEM;
        }
    }

    *block_num = current_block; // Cập nhật vị trí block sau khi ghi xong
    return ESP_OK;
}

esp_err_t rfid_component_execute(uint8_t actions, rc522_handle_t scanner, rc522_picc_t *picc, const char *data, uint8_t block_addr)
{
    esp_err_t ret = ESP_OK;
    rc522_mifare_key_t key = { .value = { RC522_MIFARE_KEY_VALUE_DEFAULT } };

    // 1. Đọc dữ liệu từ thẻ (đọc block cụ thể)
    if (actions & RFID_ACTION_READ_SPECIFIED) {
        bool any_block_has_data = false;
        for (int block = BLOCK_START; block <= BLOCK_END; block++) {
            // Bỏ qua trailer block (block % 4 == 3)
            if (block % 4 == 3) {
                ESP_LOGI(TAG, "Skipping trailer block %d", block);
                continue;
            }
            bool has_data = false;
            ESP_LOGI(TAG, "Reading data from block %d", block);
            ret = read_specified_memory(scanner, picc, block, &has_data);
            if (ret == ESP_OK) {
                if (has_data) {
                    any_block_has_data = true;
                }
                ESP_LOGI(TAG, "Read block %d success", block);
            } else {
                ESP_LOGE(TAG, "Read block %d failed, err=0x%02X", block, ret);
            }
        }

        if (any_block_has_data) {
            rfid_event_t event = {0};
            
            char uid_str[RC522_PICC_UID_STR_BUFFER_SIZE_MAX + 1] = {0};
            for (int i = 0; i < picc->uid.length; i++) {
                sprintf(uid_str + i * 2, "%02x", picc->uid.value[i]);
            }
        
            strncpy(event.uid, uid_str, sizeof(event.uid));
            strncpy(event.rfidReaderId, g_deviceId, sizeof(event.rfidReaderId));
            event.action = RFID_ACTION_NOTIFY_IF_HAS_DATA;
        
            if (xQueueSend(rfid_event_queue, &event, 0) != pdTRUE) {
                ESP_LOGE(TAG, "Failed to send notify event to rfid_event_queue");
            } else {
                ESP_LOGI(TAG, "Sent notify event to rfid_event_queue");
            }
        }        
    }

    // 2. Action mới: Gửi signal đăng ký thú cưng đến task rfid_pet_registration_task
    if (actions & RFID_ACTION_REGIST_SER) {
        ESP_LOGI(TAG, "Sending registration signal to rfid_pet_registration_task");

        // Tạo một sự kiện (rfid_event_t). Dữ liệu này có thể được chỉnh sửa tùy thuộc yêu cầu thực tế
        rfid_event_t event;

        char uid_str[RC522_PICC_UID_STR_BUFFER_SIZE_MAX + 1] = {0};
        for (int i = 0; i < picc->uid.length; i++) {
            // Sử dụng sprintf để chuyển đổi mỗi byte thành 2 ký tự hex.
            sprintf(uid_str + i * 2, "%02x", picc->uid.value[i]);
        }

        strncpy(event.uid, uid_str, sizeof(event.uid));
        strncpy(event.rfidReaderId, g_deviceId, sizeof(event.rfidReaderId));
        event.action = RFID_ACTION_REGIST_SER;
        // Gửi event vào hàng đợi, timeout có thể là 0 (không chờ) hoặc tùy chỉnh
        if (xQueueSend(rfid_event_queue, &event, 0) != pdTRUE) {
            ESP_LOGE(TAG, "Failed to send registration event to rfid_pet_registration_task");
            ret = ESP_FAIL;
        } else {
            ESP_LOGI(TAG, "Registration signal sent successfully");

            // Đợi phản hồi trong 5 giây
            rfid_response_t response;
            if (xQueueReceive(rfid_response_queue, &response, pdMS_TO_TICKS(5000))) {
                if (response.success) {
                    ESP_LOGI(TAG, "Registration confirmed - Status: %s", response.status);

                    if (strcmp(response.status, "Writing") == 0) {
                        ESP_LOGI(TAG, "Received pet data:");
                        ESP_LOGI(TAG, "├─ Name: %s", response.data.name);
                        ESP_LOGI(TAG, "├─ Breed: %s", response.data.breed);
                        ESP_LOGI(TAG, "├─ Gender: %s", response.data.gender);
                        // ESP_LOGI(TAG, "├─ Health Status: %s", response.data.healthStatus);
                        // ESP_LOGI(TAG, "├─ Vaccination Status: %s", response.data.vaccinationStatus);
                        // ESP_LOGI(TAG, "├─ Violation Status: %s", response.data.violationStatus);
                        ESP_LOGI(TAG, "└─ Age: %.1f", response.data.age);
                        ESP_LOGI(TAG, "└─ OwnerId: %s", response.data.ownerId);

                        ESP_LOGI(TAG, "Received owner data:");
                        ESP_LOGI(TAG, "├─ FullName: %s", response.data.fullName);
                        ESP_LOGI(TAG, "└─ Phone: %s", response.data.phone);

                        // Chuyển đổi age từ float sang string
                        char age_str[16];
                        snprintf(age_str, sizeof(age_str), "%.1f", response.data.age);

                        // Ghi dữ liệu vào thẻ RFID
                        ESP_LOGI(TAG, "Writing data to blocks starting from %d", block_addr);
                        esp_err_t ret;
                        uint8_t block_num = block_addr;

                        // Ghi lần lượt từng trường dữ liệu
                        struct {
                            const char *label;
                            const char *data;
                        } fields_to_write[] = {
                            {"NAME", response.data.name},
                            {"BREED", response.data.breed},
                            {"GENDER", response.data.gender},
                            // {"HEALTH STATUS", response.data.healthStatus},
                            // {"VACCINATION STATUS", response.data.vaccinationStatus},
                            // {"VIOLATION STATUS", response.data.violationStatus},
                            {"AGE", age_str},
                            {"OWNER ID", response.data.ownerId},
                            {"OWNER NAME", response.data.fullName},
                            {"OWNER PHONE", response.data.phone},
                        };

                        for (int i = 0; i < sizeof(fields_to_write)/sizeof(fields_to_write[0]); ++i) {
                            if (write_data_to_blocks(scanner, picc, fields_to_write[i].data, &block_num) != ESP_OK) {
                                ESP_LOGE(TAG, "Failed to write %s", fields_to_write[i].label);
                                return ESP_FAIL;
                            }
                        }

                        ESP_LOGI(TAG, "Data written successfully to blocks %d-%d", block_addr, block_num - 1);

                        xSemaphoreGive(rfid_write_done_sema);
                        ESP_LOGI(TAG, "Data written and semaphore given");
                    } else if (strcmp(response.status, "Processing") == 0) {
                        ESP_LOGW(TAG, "Registration is still being processed...");
                    }else if (strcmp(response.status, "Active") == 0) {
                        ESP_LOGW(TAG, "Card is already active, no action needed");
                    } else {
                        ESP_LOGE(TAG, "Unknown status received: %s", response.status);
                        ret = ESP_FAIL;
                    }

                } else {
                    ESP_LOGE(TAG, "Registration failed - Status: %s", response.status);
                    ESP_LOGE(TAG, "Error details: %s", response.data.name); // Giả định chứa lỗi trong `name`
                    ret = ESP_FAIL;
                }
            } else {
                ESP_LOGE(TAG, "Timeout while waiting for registration response");
                ret = ESP_ERR_TIMEOUT;
            }

        }
    }

    // 3. Xóa dữ liệu từ block 4 đến 14 (bỏ qua trailer block)
    if (actions & RFID_ACTION_DELETE_SPECIFIED) {
        ESP_LOGI(TAG, "Erasing data to Firestore");

        // Tạo một sự kiện (rfid_event_t). Dữ liệu này có thể được chỉnh sửa tùy thuộc yêu cầu thực tế
        rfid_event_t event;

        char uid_str[RC522_PICC_UID_STR_BUFFER_SIZE_MAX + 1] = {0};
        for (int i = 0; i < picc->uid.length; i++) {
            // Sử dụng sprintf để chuyển đổi mỗi byte thành 2 ký tự hex.
            sprintf(uid_str + i * 2, "%02x", picc->uid.value[i]);
        }

        strncpy(event.uid, uid_str, sizeof(event.uid));
        strncpy(event.rfidReaderId, g_deviceId, sizeof(event.rfidReaderId));
        event.action = RFID_ACTION_DELETE_SPECIFIED;
        
        // Gửi event vào hàng đợi, timeout có thể là 0 (không chờ) hoặc tùy chỉnh
        if (xQueueSend(rfid_event_queue, &event, 0) != pdTRUE) {
            ESP_LOGE(TAG, "Failed to send registration event to rfid_pet_registration_task");
            ret = ESP_FAIL;
        } else {
            ESP_LOGI(TAG, "Registration signal sent successfully");

            // Đợi phản hồi trong 5 giây
            rfid_response_t response;
            if (xQueueReceive(rfid_delete_response_queue, &response, pdMS_TO_TICKS(5000))) {
                if (response.success) {
                    ESP_LOGI(TAG, "Erasing data at block %d", block_addr);
                    for (int block = BLOCK_START; block <= BLOCK_END; block++) {
                        // Bỏ qua trailer block (block % 4 == 3)
                        if (block % 4 == 3) {
                            ESP_LOGI(TAG, "Skipping trailer block %d", block);
                            continue;
                        }
                        ret = write_specified_memory(scanner, picc, "", block);
                        if (ret == ESP_OK) {
                            ESP_LOGI(TAG, "Successfully erased blocks 4-14");
                        } else {
                            ESP_LOGE(TAG, "Erase failed, err=0x%02X", ret);
                        }
                    }
                } else {
                    ESP_LOGE(TAG, "Registration failed - Status: %s", response.status);
                    ret = ESP_FAIL;
                }
            } else {
                ESP_LOGE(TAG, "Timeout while waiting for registration response");
                ret = ESP_ERR_TIMEOUT;
            }
        }
    }

    // 4. Đọc toàn bộ dữ liệu trong thẻ
    if (actions & RFID_ACTION_READ_ALL) {
        ESP_LOGI(TAG, "Reading card information:");
        // Đọc và in toàn bộ dữ liệu của thẻ
        ret = read_all_memory(scanner, picc);
        if (ret == ESP_OK) {
            ESP_LOGI(TAG, "Reading card data successful");
        } else {
            ESP_LOGE(TAG, "Reading card data failed, err=0x%02X", ret);
        }
    }    
   
    // 5. Xóa toàn bộ dữ liệu trong thẻ (lặp qua các block dữ liệu)
    if (actions & RFID_ACTION_DELETE_ALL) {
        ESP_LOGI(TAG, "Erasing all data in the card");
        for (int block = BLOCK_START; block <= BLOCK_MAX; block++) {
            // Bỏ qua trailer block (block % 4 == 3)
            if (block % 4 == 3) {
                ESP_LOGI(TAG, "Skipping trailer block %d", block);
                continue;
            }
            ret = write_specified_memory(scanner, picc, "", block);
            if (ret == ESP_OK) {
                ESP_LOGI(TAG, "Erase all memory card RFID success");
            } else {
                ESP_LOGE(TAG, "Erase all memory card RFID failed, err=0x%02X", ret);
            }
        }
    }

    return ret;
}

// Hàm xử lý sự kiện khi thẻ được đưa vào vùng đọc
static void on_picc_state_changed(void *arg, esp_event_base_t base, int32_t event_id, void *data)
{
    struct tm tm_update;

    // Lấy thời gian hiện tại
    if (internal_rtc_get_time(&tm_update) == 0) {
        if (strftime(last_seen_time, sizeof(last_seen_time), "%Y-%m-%dT%H:%M:%S", &tm_update) == 0) {
            strncpy(last_seen_time, "unknown", sizeof(last_seen_time));
        }
    } else {
        strncpy(last_seen_time, "unknown", sizeof(last_seen_time));
    }

    rc522_picc_state_changed_event_t *event = (rc522_picc_state_changed_event_t *)data;
    rc522_picc_t *picc = event->picc;

    if (picc->state != RC522_PICC_STATE_ACTIVE) {
        return;
    }

    ESP_LOGI(TAG, "Card detected:");
    rc522_picc_print(picc);

    if (!rc522_mifare_type_is_classic_compatible(picc->type)) {
        ESP_LOGW(TAG, "Card is not MIFARE Classic compatible");
        return;
    }

    // Thực hiện các hành động trên thẻ RFID
    const char *sample_data = "HELLO RFID";
    uint8_t block_addr = BLOCK_ADR_PROCESS;

    esp_err_t ret = rfid_component_execute(action_rfid_card, scanner, picc, sample_data, block_addr);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Action done successfully");
    } else {
        ESP_LOGE(TAG, "Action failed, err=0x%02X", ret);
    }

    if (rc522_mifare_deauth(scanner, picc) != ESP_OK) {
        ESP_LOGW(TAG, "Deauth failed");
    }
    
    led_status_set(LED_STATUS_RFID_DETECTED_BIT);
    buzzer_status_set(BUZZER_STATUS_RFID_DETECTED_BIT);
}

void init_rfid(void)
{
    srand(time(NULL)); // Initialize random generator

    // Khởi tạo driver và scanner
    rc522_spi_create(&driver_config, &driver);
    rc522_driver_install(driver);

    rc522_config_t scanner_config = {
        .driver = driver,
    };

    rc522_create(&scanner_config, &scanner);
    rc522_register_events(scanner, RC522_EVENT_PICC_STATE_CHANGED, on_picc_state_changed, NULL);
    rc522_start(scanner);

    ESP_LOGI(TAG, "RFID scanner initialized");

    // Khởi tạo semaphore (trạng thái ban đầu: unavailable)
    rfid_write_done_sema = xSemaphoreCreateBinary();
    configASSERT(rfid_write_done_sema != NULL);
}
