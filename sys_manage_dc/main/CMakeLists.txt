file(GLOB_RECURSE UI_SRC_FILES
    "ui/*.c"
)

idf_component_register(
    SRCS "main.c" ${UI_SRC_FILES}
    INCLUDE_DIRS "." "ui"
)