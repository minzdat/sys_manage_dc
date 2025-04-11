#ifndef COM_FIRESTORE_H
#define COM_FIRESTORE_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define FIRMWARE_VERSION                    "v1.0.0"            // Phiên bản firmware
#define MODULE_RFID_TYPE                    "MFRC-522"          // Loại module RFID
#define ACCEPTED_CARD_TYPE                  "MIFARE-1K"         // Loại thẻ RFID được chấp nhận
#define TIME_UPDATE_INFO_DEVICE             (60000)             // 1 phút

extern QueueHandle_t rfid_event_queue;

// Các định nghĩa cho các thông số thiết bị
typedef struct {
    char uid[64];           // UID của thẻ RFID
    char rfidReaderId[64];  // ID của đầu đọc RFID
} rfid_event_t;

void update_info_device_task(void *pvParameters);
void rfid_pet_registration_task(void *pvParameters);

#endif // COM_FIRESTORE_H
