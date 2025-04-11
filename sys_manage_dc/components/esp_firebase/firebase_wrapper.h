#ifndef FIREBASE_WRAPPER_H
#define FIREBASE_WRAPPER_H

#ifdef __cplusplus
extern "C" {
#endif

#include "cJSON.h"

// Opaque pointer type
typedef struct firestore_handle* firestore_handle_t;

// Initialization
void firebase_init(void);
firestore_handle_t firestore_create(const char* project_id);
void firestore_destroy(firestore_handle_t handle);

// Document operations
cJSON* firestore_get_document(firestore_handle_t handle, const char* collection, const char* document);
int firestore_create_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data);
int firestore_update_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data);
int firestore_delete_document(firestore_handle_t handle, const char* collection, const char* document);
int firestore_patch_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data);

#ifdef __cplusplus
}
#endif

#endif // FIREBASE_WRAPPER_H