#ifndef _ESP_FIRESTORE_H_
#define  _ESP_FIRESTORE_H_

#include "cJSON.h"
#include "app.h"
#include <string>

namespace ESPFirebase 
{
    class Firestore
    {
    private:
        FirebaseApp* app;
        std::string base_firestore_url;
        std::string project_id;
        std::string database_id;

        std::string buildDocumentPath(const char* collection, const char* document = nullptr);

    public:
        cJSON* getDocument(const char* collection, const char* document);
        esp_err_t createDocument(const char* collection, const char* document, const cJSON* data);
        esp_err_t updateDocument(const char* collection, const char* document, const cJSON* data);
        esp_err_t patchDocument(const char* collection, const char* document, const cJSON* data); 
        esp_err_t deleteDocument(const char* collection, const char* document);

        Firestore(FirebaseApp* app, const char* project_id, const char* database_id = "(default)");
    };
}

#endif