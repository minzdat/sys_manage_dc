#include "gen_pro_qr.h"

void generate_provisioning_qr_code() 
{
    char payload[150] = {"http://192.168.4.1/get"};

    ESP_LOGI("QRCODE_TAG", "Scan this QR code from the provisioning application for Provisioning.");
    
    esp_qrcode_config_t cfg = ESP_QRCODE_CONFIG_DEFAULT();
    esp_qrcode_generate(&cfg, payload);

    ESP_LOGI("QRCODE_TAG", "If QR code is not visible, copy paste the below URL in a browser.\n%s?data=%s", QRCODE_BASE_URL, payload);
}