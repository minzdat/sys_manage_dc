idf_component_register(SRCS "method_firestore.cpp" "firebase_wrapper.cpp" "app.cpp"
                    INCLUDE_DIRS "." ".."
                    PRIV_REQUIRES esp_http_client esp-tls nvs_flash esp_netif esp_wifi json
                    EMBED_TXTFILES gtsr1.pem)
