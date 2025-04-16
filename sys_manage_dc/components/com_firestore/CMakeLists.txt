idf_component_register(SRCS "com_firestore.c"
                    INCLUDE_DIRS "include"
                    REQUIRES abobija__rc522 nvs_flash rfid_rc522 sntp_service sys_device json esp_firebase internal_rtc)
