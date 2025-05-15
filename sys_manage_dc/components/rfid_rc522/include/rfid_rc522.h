#ifndef RFID_RC522_H
#define RFID_RC522_H

#include "esp_err.h"
#include "rc522.h"
#include "picc/rc522_mifare.h"
#include "driver/rc522_spi.h"
#include "com_firestore.h"

#ifdef __cplusplus
extern "C" {
#endif

extern char *g_deviceId;
extern char last_seen_time[64];
extern uint8_t action_rfid_card;

// Cấu hình driver (ví dụ sử dụng chân và SPI tương tự các file mẫu)
#define RC522_SPI_BUS_GPIO_MISO    (GPIO_NUM_13)
#define RC522_SPI_BUS_GPIO_MOSI    (GPIO_NUM_11)
#define RC522_SPI_BUS_GPIO_SCLK    (GPIO_NUM_12)
#define RC522_SPI_SCANNER_GPIO_SDA (GPIO_NUM_18)
#define RC522_SCANNER_GPIO_RST     (GPIO_NUM_5) // soft-reset

/* Định nghĩa các bit hành động */
#define RFID_ACTION_READ_SPECIFIED          0x04
#define RFID_ACTION_REGIST_SER              0x20 
#define RFID_ACTION_DELETE_SPECIFIED        0x08
#define RFID_ACTION_READ_ALL                0x01
#define RFID_ACTION_DELETE_ALL              0x10
#define RFID_ACTION_NOTIFY_IF_HAS_DATA      0x05

#define BLOCK_ADR_PROCESS               4
#define BLOCK_START                     4
#define BLOCK_END                       15
#define BLOCK_MAX                       63

/**
 * @brief Thực hiện các hành động trên thẻ RFID dựa vào bitmask actions.
 *
 * @param actions      Bitmask xác định các hành động cần thực hiện.
 * @param scanner      Handle của RC522 scanner.
 * @param picc         Con trỏ đến cấu trúc thông tin thẻ.
 * @param data         Dữ liệu cần ghi/sửa (nếu áp dụng).
 * @param block_addr   Địa chỉ block cần thao tác.
 *
 * @return esp_err_t   Kết quả thực hiện.
 */
esp_err_t rfid_component_execute(uint8_t actions,
                                 rc522_handle_t scanner,
                                 rc522_picc_t *picc,
                                 const char *data,
                                 uint8_t block_addr);

void init_rfid(void);

#ifdef __cplusplus
}
#endif

#endif // RFID_RC522_H
