#ifndef COM_FIRESTORE_H
#define COM_FIRESTORE_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define FIRMWARE_VERSION                    "v1.0.0"            // Phiên bản firmware
#define MODULE_RFID_TYPE                    "MFRC-522"          // Loại module RFID
#define ACCEPTED_CARD_TYPE                  "MIFARE-1K"         // Loại thẻ RFID được chấp nhận
#define TIME_UPDATE_INFO_DEVICE             (60000)             // 1 phút

extern QueueHandle_t rfid_event_queue;
extern QueueHandle_t rfid_response_queue;
extern QueueHandle_t rfid_delete_response_queue;
extern SemaphoreHandle_t rfid_write_done_sema;

// Định nghĩa kiểu phản hồi
typedef struct {
    bool success;
    char status[16];                                // Trạng thái: "Processing", "Writing", v.v.
    struct {
        char name[16];                              // Tên thú cưng (1 block) - Tối đa 16 ký tự (1 block)
        char breed[16];                             // Giống loài (1 block)
        char gender[16];                            // Tối đa 16 ký tự (1 block)
        // char healthStatus[32];                   // Tình trạng sức khỏe (2 block)
        // char vaccinationStatus[32];              // Tình trạng tiêm chủng (2 block)
        // char violationStatus[32];                // Tình trạng vi phạm (2 block)
        double age;                                 // Tuổi thú cưng (1 block)
        char ownerId[32];                           // ID của chủ thú cưng (2 block)
        char fullName[32];                          // Tên đầy đủ của chủ thú cưng (2 block)
        char phone[16];                             // Số điện thoại (1 block)
        // Tong cộng 9 block (16 byte/block)
    } data;
} rfid_response_t;

// Các định nghĩa cho các thông số thiết bị
typedef struct {
    char uid[32];           // UID của thẻ RFID
    char rfidReaderId[32];  // ID của đầu đọc RFID
    uint8_t action;
} rfid_event_t;

void update_info_device_task(void *pvParameters);
void rfid_pet_registration_task(void *pvParameters);

#endif // COM_FIRESTORE_H
