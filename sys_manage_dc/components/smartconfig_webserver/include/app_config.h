#ifndef __APP_CONFIG_H
#define __APP_CONFIG_H

#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

typedef enum
{
    PROVISION_ACCESSPOINT = 0,
    PROVISION_SMARTCONFIG = 1,
} provision_type_t;

#define MAX_SSID_LENGTH                 32
#define REPROVISION_TRIGGER_BIT         BIT0

extern EventGroupHandle_t s_wifi_event_reprovision_group;
extern volatile bool in_provisioning_mode;

void re_provision_task(void *pvParameters);
void app_config(void);
void ap_start(void);
#endif