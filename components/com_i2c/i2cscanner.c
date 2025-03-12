#include <driver/i2c.h>
#include <esp_log.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <stdio.h>
#include <com_i2c.h>

bool i2c_scan_completed = false; 

static void scan_i2c_task(void *ignore)
{
    i2c_config_t conf;
    conf.mode = I2C_MODE_MASTER;
    conf.sda_io_num = SDA_SCAN_PIN;
    conf.scl_io_num = SCL_SCAN_PIN;
    conf.sda_pullup_en = GPIO_PULLUP_ENABLE;
    conf.scl_pullup_en = GPIO_PULLUP_ENABLE;
    conf.master.clk_speed = 100000;
    i2c_param_config(I2C_NUM_0, &conf);

    i2c_driver_install(I2C_NUM_0, I2C_MODE_MASTER, 0, 0, 0);

    esp_err_t res;
    printf("     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f\n");
    printf("00:         ");
    for (uint8_t i = 3; i < 0x78; i++)
    {
        i2c_cmd_handle_t cmd = i2c_cmd_link_create();
        i2c_master_start(cmd);
        i2c_master_write_byte(cmd, (i << 1) | I2C_MASTER_WRITE, 1 /* expect ack */);
        i2c_master_stop(cmd);

        res = i2c_master_cmd_begin(I2C_NUM_0, cmd, 10 / portTICK_PERIOD_MS);
        if (i % 16 == 0)
        {
            printf("\n%.2x:", i);
        }
        if (res == 0)
        {
            printf(" %.2x", i);
        }
        else
        {
            printf(" --");
        }
        i2c_cmd_link_delete(cmd);
    }
    printf("\n\nI2C scan complete.\n");

    // Uninstall I2C driver
    i2c_driver_delete(I2C_NUM_0);
    
    i2c_scan_completed = true;
    vTaskDelete(NULL);
}

void scan_i2c()
{
    xTaskCreatePinnedToCore(scan_i2c_task, "scan i2c task", configMINIMAL_STACK_SIZE * 8, NULL, 5, NULL, APP_CPU_NUM);
    while (!i2c_scan_completed)
    {
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}