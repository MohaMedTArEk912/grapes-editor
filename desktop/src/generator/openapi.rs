//! OpenAPI / Swagger specification generator
//!
//! Generates an OpenAPI 3.0 specification from the project schema's
//! data models and API endpoints.

use crate::schema::ProjectSchema;
use serde_json::{json, Value};

pub struct OpenApiGenerator;

impl OpenApiGenerator {
    /// Generate a complete OpenAPI 3.0 JSON specification from a project schema
    pub fn generate(project: &ProjectSchema) -> Value {
        let mut paths: serde_json::Map<String, Value> = serde_json::Map::new();
        let mut schemas: serde_json::Map<String, Value> = serde_json::Map::new();

        // ── Generate component schemas from data models ──
        for model in project.data_models.iter().filter(|m| !m.archived) {
            let mut properties: serde_json::Map<String, Value> = serde_json::Map::new();
            let mut required: Vec<String> = Vec::new();

            for field in &model.fields {
                let (ts_type, format) = field_type_to_openapi(&format!("{:?}", field.field_type));
                let mut prop: serde_json::Map<String, Value> = serde_json::Map::new();
                prop.insert("type".into(), json!(ts_type));
                if let Some(fmt) = format {
                    prop.insert("format".into(), json!(fmt));
                }
                if field.unique {
                    prop.insert("uniqueItems".into(), json!(true));
                }
                if let Some(ref desc) = field.description {
                    prop.insert("description".into(), json!(desc));
                }
                properties.insert(field.name.clone(), Value::Object(prop));

                if field.required {
                    required.push(field.name.clone());
                }
            }

            // Add timestamps if enabled
            if model.timestamps {
                properties.insert(
                    "createdAt".into(),
                    json!({"type": "string", "format": "date-time"}),
                );
                properties.insert(
                    "updatedAt".into(),
                    json!({"type": "string", "format": "date-time"}),
                );
            }

            let mut schema_obj: serde_json::Map<String, Value> = serde_json::Map::new();
            schema_obj.insert("type".into(), json!("object"));
            schema_obj.insert("properties".into(), Value::Object(properties));
            if !required.is_empty() {
                schema_obj.insert("required".into(), json!(required));
            }

            schemas.insert(model.name.clone(), Value::Object(schema_obj));

            // Also generate CreateDto and UpdateDto
            let create_dto_name = format!("Create{}Dto", model.name);
            let update_dto_name = format!("Update{}Dto", model.name);

            let mut create_props: serde_json::Map<String, Value> = serde_json::Map::new();
            let mut create_required: Vec<String> = Vec::new();
            let mut update_props: serde_json::Map<String, Value> = serde_json::Map::new();

            for field in &model.fields {
                if field.primary_key {
                    continue; // Skip ID field for DTOs
                }
                let (ts_type, format) = field_type_to_openapi(&format!("{:?}", field.field_type));
                let mut prop: serde_json::Map<String, Value> = serde_json::Map::new();
                prop.insert("type".into(), json!(ts_type));
                if let Some(fmt) = format {
                    prop.insert("format".into(), json!(fmt));
                }
                create_props.insert(field.name.clone(), Value::Object(prop.clone()));
                update_props.insert(field.name.clone(), Value::Object(prop));
                if field.required {
                    create_required.push(field.name.clone());
                }
            }

            schemas.insert(
                create_dto_name,
                json!({
                    "type": "object",
                    "properties": create_props,
                    "required": create_required,
                }),
            );
            schemas.insert(
                update_dto_name,
                json!({
                    "type": "object",
                    "properties": update_props,
                }),
            );
        }

        // ── Generate paths from API endpoints ──
        for api in project.apis.iter().filter(|a| !a.archived) {
            let method = format!("{:?}", api.method).to_lowercase();
            let path = &api.path;

            let mut operation: serde_json::Map<String, Value> = serde_json::Map::new();
            operation.insert("summary".into(), json!(api.name));
            if let Some(ref desc) = api.description {
                operation.insert("description".into(), json!(desc));
            }
            operation.insert("operationId".into(), json!(to_camel_case(&api.name)));

            // Tags from path
            let tag = extract_resource(path);
            operation.insert("tags".into(), json!([tag]));

            // Security
            if !api.permissions.is_empty() {
                operation.insert("security".into(), json!([{"bearerAuth": []}]));
            }

            // Parameters from path
            let params: Vec<Value> = extract_path_params(path)
                .iter()
                .map(|p| {
                    json!({
                        "name": p,
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" }
                    })
                })
                .collect();
            if !params.is_empty() {
                operation.insert("parameters".into(), json!(params));
            }

            // Request body for POST/PUT/PATCH
            if method == "post" || method == "put" || method == "patch" {
                if let Some(ref body) = api.request_body {
                    let body_schema = data_shape_to_schema(body);
                    operation.insert(
                        "requestBody".into(),
                        json!({
                            "required": true,
                            "content": {
                                "application/json": {
                                    "schema": body_schema
                                }
                            }
                        }),
                    );
                } else {
                    // Infer from resource name
                    let dto_ref = format!("Create{}Dto", capitalize(&tag));
                    operation.insert("requestBody".into(), json!({
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": format!("#/components/schemas/{}", dto_ref) }
                            }
                        }
                    }));
                }
            }

            // Response
            let response_schema = if let Some(ref resp) = api.response_body {
                data_shape_to_schema(resp)
            } else {
                json!({"type": "object", "properties": {"success": {"type": "boolean"}, "data": {"type": "object"}}})
            };

            let status_code = match method.as_str() {
                "post" => "201",
                "delete" => "204",
                _ => "200",
            };

            operation.insert(
                "responses".into(),
                json!({
                    status_code: {
                        "description": "Successful operation",
                        "content": {
                            "application/json": {
                                "schema": response_schema
                            }
                        }
                    },
                    "401": {
                        "description": "Unauthorized"
                    },
                    "404": {
                        "description": "Not found"
                    }
                }),
            );

            // Insert into paths
            let path_entry = paths.entry(path.clone()).or_insert_with(|| json!({}));
            if let Some(obj) = path_entry.as_object_mut() {
                obj.insert(method, Value::Object(operation));
            }
        }

        // ── Assemble full spec ──
        json!({
            "openapi": "3.0.3",
            "info": {
                "title": format!("{} API", project.name),
                "description": project.description,
                "version": project.version,
            },
            "servers": [
                {
                    "url": "http://localhost:3000",
                    "description": "Development server"
                }
            ],
            "paths": paths,
            "components": {
                "schemas": schemas,
                "securitySchemes": {
                    "bearerAuth": {
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT"
                    }
                }
            }
        })
    }
}

fn field_type_to_openapi(field_type: &str) -> (&'static str, Option<&'static str>) {
    match field_type {
        "String" | "Text" | "Email" | "Url" => ("string", None),
        "Int" => ("integer", Some("int32")),
        "Float" => ("number", Some("double")),
        "Boolean" => ("boolean", None),
        "DateTime" => ("string", Some("date-time")),
        "Json" => ("object", None),
        "Uuid" => ("string", Some("uuid")),
        "Bytes" => ("string", Some("byte")),
        _ => ("string", None),
    }
}

fn extract_resource(path: &str) -> String {
    path.split('/')
        .filter(|s| !s.is_empty() && !s.starts_with(':') && *s != "api")
        .next()
        .unwrap_or("default")
        .to_string()
}

fn extract_path_params(path: &str) -> Vec<String> {
    path.split('/')
        .filter(|s| s.starts_with(':'))
        .map(|s| s.trim_start_matches(':').to_string())
        .collect()
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

fn to_camel_case(s: &str) -> String {
    let parts: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).collect();
    let mut result = String::new();
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }
        if i == 0 {
            result.push_str(&part.to_lowercase());
        } else {
            result.push_str(&capitalize(&part.to_lowercase()));
        }
    }
    result
}

fn data_shape_to_schema(shape: &crate::schema::api::DataShape) -> Value {
    use crate::schema::api::ShapeType;

    match shape.shape_type {
        ShapeType::Array => {
            let items = if let Some(ref item_shape) = shape.item_shape {
                data_shape_to_schema(item_shape)
            } else {
                json!({"type": "object"})
            };
            json!({ "type": "array", "items": items })
        }
        ShapeType::Model => {
            if let Some(ref model_name) = shape.model_ref {
                json!({ "$ref": format!("#/components/schemas/{}", model_name) })
            } else {
                json!({"type": "object"})
            }
        }
        ShapeType::Object => {
            let mut properties: serde_json::Map<String, Value> = serde_json::Map::new();
            let mut required: Vec<String> = Vec::new();

            if let Some(ref fields) = shape.fields {
                for field in fields {
                    let prop = shape_type_to_schema(&field.field_type, field.nested.as_deref());
                    properties.insert(field.name.clone(), prop);
                    if field.required {
                        required.push(field.name.clone());
                    }
                }
            }

            let mut obj = json!({ "type": "object", "properties": properties });
            if !required.is_empty() {
                obj["required"] = json!(required);
            }
            obj
        }
        ref st => shape_type_to_schema(st, None),
    }
}

fn shape_type_to_schema(
    st: &crate::schema::api::ShapeType,
    nested: Option<&crate::schema::api::DataShape>,
) -> Value {
    use crate::schema::api::ShapeType;
    match st {
        ShapeType::String => json!({"type": "string"}),
        ShapeType::Number => json!({"type": "number"}),
        ShapeType::Boolean => json!({"type": "boolean"}),
        ShapeType::Object => {
            if let Some(n) = nested {
                data_shape_to_schema(n)
            } else {
                json!({"type": "object"})
            }
        }
        ShapeType::Array => {
            if let Some(n) = nested {
                json!({"type": "array", "items": data_shape_to_schema(n)})
            } else {
                json!({"type": "array", "items": {"type": "object"}})
            }
        }
        ShapeType::Model => json!({"type": "object"}),
    }
}
