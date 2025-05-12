#ifndef SCAN_WIFI_H
#define SCAN_WIFI_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Khởi chạy quá trình quét Wi‑Fi.
 *
 * Hàm này sẽ khởi tạo các module cần thiết, cấu hình Wi‑Fi dưới chế độ STA và thực hiện quét,
 * sau đó in ra các thông tin của các Access Point (SSID, RSSI, chế độ bảo mật, …).
 */
#define MAX_SSID_LENGTH 32
#define DEFAULT_SCAN_LIST_SIZE CONFIG_SCAN_LIST_SIZE

void wifi_scan(char ssid_array[][MAX_SSID_LENGTH + 1]);

#ifdef __cplusplus
}
#endif

#endif // SCAN_WIFI_H
