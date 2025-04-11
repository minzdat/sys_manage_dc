#include "firebase_wrapper.h"
#include "firebase_config.h"
#include "method_firestore.h"
#include "app.h"

static ESPFirebase::FirebaseApp* g_app = nullptr;

// Wrapper structure
struct firestore_handle {
    ESPFirebase::Firestore* instance;
};

extern "C" {

void firebase_init(void) {
    static ESPFirebase::user_account_t account = {USER_EMAIL, USER_PASSWORD};
    g_app = new ESPFirebase::FirebaseApp(API_KEY);
    g_app->loginUserAccount(account);
}

firestore_handle_t firestore_create(const char* project_id) {
    auto handle = new firestore_handle;
    handle->instance = new ESPFirebase::Firestore(g_app, project_id);
    return handle;
}

void firestore_destroy(firestore_handle_t handle) {
    delete handle->instance;
    delete handle;
}

cJSON* firestore_get_document(firestore_handle_t handle, const char* collection, const char* document) {
    auto result = handle->instance->getDocument(collection, document);
    return result ? cJSON_Duplicate(result, true) : nullptr;
}

int firestore_create_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data) {
    return handle->instance->createDocument(collection, document, data) == ESP_OK ? 0 : -1;
}

int firestore_update_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data) {
    return handle->instance->updateDocument(collection, document, data) == ESP_OK ? 0 : -1;
}

int firestore_delete_document(firestore_handle_t handle, const char* collection, const char* document) {
    return handle->instance->deleteDocument(collection, document) == ESP_OK ? 0 : -1;
}

int firestore_patch_document(firestore_handle_t handle, const char* collection, const char* document, const cJSON* data) {
    return handle->instance->patchDocument(collection, document, data) == ESP_OK ? 0 : -1;
}
} // extern "C"