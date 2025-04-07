idf_component_register(SRCS "smartconfig_webserver.c" "app_http_server.c" "app_config.c"
                    INCLUDE_DIRS "include"
                    REQUIRES json storage_spiffs buzzer_status led_status esp_http_server esp_wifi nvs_flash scan_wifi qrcode
                    EMBED_FILES "webserver.html")
