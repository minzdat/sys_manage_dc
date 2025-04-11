idf_component_register(SRCS "com_firestore.c"
                    INCLUDE_DIRS "include"
                    REQUIRES sntp_service sys_device json esp_firebase internal_rtc)
