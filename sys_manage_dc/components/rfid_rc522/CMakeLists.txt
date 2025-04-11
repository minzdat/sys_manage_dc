idf_component_register(SRCS "rfid_rc522.c"
                    INCLUDE_DIRS "include"
                    REQUIRES com_firestore abobija__rc522 led_status buzzer_status)
