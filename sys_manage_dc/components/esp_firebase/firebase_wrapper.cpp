#include <iostream>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_log.h"
#include "esp_system.h"
#include "esp_event.h"

#include "esp_firebase/app.h"

#include "firebase_config.h"
#include "firebase_wrapper.h"

using namespace ESPFirebase;

void firebase_wrapper(void)
{
    // Config and Authentication
    user_account_t account = {USER_EMAIL, USER_PASSWORD};

    FirebaseApp app = FirebaseApp(API_KEY);

    app.loginUserAccount(account);
}
