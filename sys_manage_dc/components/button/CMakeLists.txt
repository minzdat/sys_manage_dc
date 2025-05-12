idf_component_register(SRCS "button.c" "button_ctrl.c"
                    INCLUDE_DIRS "include"
                    REQUIRES rfid_rc522 esp_wifi driver esp_timer smartconfig_webserver)
