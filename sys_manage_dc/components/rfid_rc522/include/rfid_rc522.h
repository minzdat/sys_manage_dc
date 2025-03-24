#ifndef RFID_RC522_H
#define RFID_RC522_H

#include "esp_err.h"
#include "rc522.h"
#include "picc/rc522_mifare.h"
#include "driver/rc522_spi.h"

#ifdef __cplusplus
extern "C" {
#endif

// Cấu hình driver (ví dụ sử dụng chân và SPI tương tự các file mẫu)
#define RC522_SPI_BUS_GPIO_MISO    (GPIO_NUM_19)
#define RC522_SPI_BUS_GPIO_MOSI    (GPIO_NUM_23)
#define RC522_SPI_BUS_GPIO_SCLK    (GPIO_NUM_18)
#define RC522_SPI_SCANNER_GPIO_SDA (GPIO_NUM_12)
#define RC522_SCANNER_GPIO_RST     (GPIO_NUM_5) // soft-reset

/* Định nghĩa các bit hành động */
#define RFID_ACTION_READ             0x01
#define RFID_ACTION_WRITE            0x02
#define RFID_ACTION_READ_SPECIFIED   0x04
#define RFID_ACTION_DELETE_SPECIFIED 0x08
#define RFID_ACTION_DELETE_ALL       0x10

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
