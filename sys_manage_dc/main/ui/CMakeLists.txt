SET(SOURCES screens/ui_Screen1.c
    ui.c
    components/ui_comp_hook.c
    ui_helpers.c
    images/ui_img_downpour_png.c
    images/ui_img_808186920.c
    images/ui_img_1954064446.c)

add_library(ui ${SOURCES})
