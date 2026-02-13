//! Code generation routes

use axum::{extract::State, Json};
use serde::Serialize;

use crate::backend::error::ApiError;
use crate::backend::state::AppState;
use crate::generator::{
    BackendGenerator, DatabaseGenerator, FlowWiring, FlowWiringResolver, FrontendGenerator,
    LogicCompiler, OpenApiGenerator,
};
use crate::schema::logic_flow::FlowContext;
use crate::schema::ProjectSchema;

/// Generated code response
#[derive(Debug, Serialize)]
pub struct GeneratedCode {
    pub files: Vec<GeneratedFile>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

/// Generate frontend code (React + Auth + Hooks + Layout + logic runtime)
pub async fn generate_frontend(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    let wiring = resolve_wiring(&project)?;
    let files = collect_frontend_files(&project, &wiring);
    Ok(Json(GeneratedCode { files }))
}

/// Generate backend code (NestJS + Prisma + logic runtime)
pub async fn generate_backend(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    let wiring = resolve_wiring(&project)?;
    let files = collect_backend_files(&project, &wiring);
    Ok(Json(GeneratedCode { files }))
}

/// Generate database schema (Prisma)
pub async fn generate_database(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let generator = DatabaseGenerator::new(&project);
    let output = generator.generate();

    Ok(Json(GeneratedCode {
        files: output
            .files
            .into_iter()
            .map(|f| GeneratedFile {
                path: f.path,
                content: f.content,
            })
            .collect(),
    }))
}

/// Generate ZIP archive of the entire project
pub async fn generate_zip(
    State(state): State<AppState>,
) -> Result<impl axum::response::IntoResponse, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let zip_bytes = build_zip_buffer(&project)?;

    Ok((
        axum::http::StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/zip"),
            (
                axum::http::header::CONTENT_DISPOSITION,
                "attachment; filename=\"project.zip\"",
            ),
        ],
        zip_bytes,
    ))
}

/// Generate OpenAPI 3.0 specification
pub async fn generate_openapi(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let spec = OpenApiGenerator::generate(&project);
    Ok(Json(spec))
}

fn resolve_wiring(project: &ProjectSchema) -> Result<FlowWiring, ApiError> {
    FlowWiringResolver::resolve(project).map_err(ApiError::BadRequest)
}

fn collect_frontend_files(project: &ProjectSchema, wiring: &FlowWiring) -> Vec<GeneratedFile> {
    let generator = FrontendGenerator::with_wiring(project, wiring);
    let output = generator.generate();
    let logic_bundle =
        LogicCompiler::compile_bundle(&project.logic_flows, FlowContext::Frontend, wiring);

    let mut files: Vec<GeneratedFile> = output
        .files
        .into_iter()
        .map(|f| GeneratedFile {
            path: f.path,
            content: f.content,
        })
        .collect();

    for file in logic_bundle.files {
        files.push(GeneratedFile {
            path: file.path,
            content: file.content,
        });
    }
    files
}

fn collect_backend_files(project: &ProjectSchema, wiring: &FlowWiring) -> Vec<GeneratedFile> {
    let generator = BackendGenerator::new(project);
    let output = generator.generate();
    let logic_bundle =
        LogicCompiler::compile_bundle(&project.logic_flows, FlowContext::Backend, wiring);

    let mut files: Vec<GeneratedFile> = output
        .files
        .into_iter()
        .map(|f| GeneratedFile {
            path: f.path,
            content: f.content,
        })
        .collect();

    for file in logic_bundle.files {
        files.push(GeneratedFile {
            path: file.path,
            content: file.content,
        });
    }
    files
}

pub fn build_zip_buffer(project: &ProjectSchema) -> Result<Vec<u8>, ApiError> {
    let wiring = resolve_wiring(project)?;

    let frontend_files = collect_frontend_files(project, &wiring);
    let backend_files = collect_backend_files(project, &wiring);
    let database_files = DatabaseGenerator::new(project).generate();

    let mut buf = Vec::new();
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Stored)
        .unix_permissions(0o755);

    for file in frontend_files {
        write_zip_file(
            &mut zip,
            &format!("client/{}", file.path),
            &file.content,
            options,
        )?;
    }
    for file in backend_files {
        write_zip_file(
            &mut zip,
            &format!("server/{}", file.path),
            &file.content,
            options,
        )?;
    }
    for file in database_files.files {
        write_zip_file(
            &mut zip,
            &format!("server/{}", file.path),
            &file.content,
            options,
        )?;
    }

    // Config
    let config_json =
        serde_json::to_string_pretty(project).map_err(|e| ApiError::Internal(e.to_string()))?;
    write_zip_file(&mut zip, "akasha.config.json", &config_json, options)?;

    // OpenAPI
    let openapi_spec = OpenApiGenerator::generate(project);
    let openapi_json = serde_json::to_string_pretty(&openapi_spec)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    write_zip_file(&mut zip, "server/docs/openapi.json", &openapi_json, options)?;

    // Root README
    let readme = format!(
        "# {}\n\nGenerated by Akasha.\n\n## Structure\n\n- `client/` — React + Tailwind frontend\n- `server/` — NestJS + Prisma backend\n\n## Quick Start\n\n```bash\n# Backend\ncd server\nnpm install\nnpx prisma migrate dev --name init\nnpm run start:dev\n\n# Frontend (another terminal)\ncd client\nnpm install\nnpm start\n```\n",
        project.name
    );
    write_zip_file(&mut zip, "README.md", &readme, options)?;

    zip.finish()
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    drop(zip);

    Ok(buf)
}

fn write_zip_file<W: std::io::Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    path: &str,
    content: &str,
    options: zip::write::FileOptions,
) -> Result<(), ApiError> {
    zip.start_file(path, options)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    use std::io::Write;
    zip.write_all(content.as_bytes())
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::logic_flow::{FlowContext, LogicFlowSchema, TriggerType};
    use std::fs;
    use std::io::Read;
    use std::path::{Path, PathBuf};
    use std::process::{Child, Command, Stdio};
    use std::thread;
    use std::time::{Duration, Instant};

    const ZIP_RUNTIME_SMOKE_ENV: &str = "AKASHA_RUN_ZIP_RUNTIME_SMOKE";

    struct TempDirGuard {
        path: PathBuf,
    }

    impl TempDirGuard {
        fn new(prefix: &str) -> Result<Self, String> {
            let path = std::env::temp_dir().join(format!("{}-{}", prefix, uuid::Uuid::new_v4()));
            fs::create_dir_all(&path)
                .map_err(|e| format!("failed to create temp dir '{}': {}", path.display(), e))?;
            Ok(Self { path })
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn should_run_zip_runtime_smoke() -> bool {
        std::env::var(ZIP_RUNTIME_SMOKE_ENV)
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }

    fn extract_zip_archive(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
        let cursor = std::io::Cursor::new(bytes);
        let mut archive =
            zip::ZipArchive::new(cursor).map_err(|e| format!("failed to open zip: {}", e))?;

        for idx in 0..archive.len() {
            let mut entry = archive
                .by_index(idx)
                .map_err(|e| format!("failed to read zip entry {idx}: {e}"))?;
            let Some(enclosed) = entry.enclosed_name() else {
                return Err(format!("zip entry contains unsafe path: {}", entry.name()));
            };
            let out_path = target_dir.join(enclosed);

            if entry.name().ends_with('/') {
                fs::create_dir_all(&out_path).map_err(|e| {
                    format!("failed to create directory '{}': {}", out_path.display(), e)
                })?;
                continue;
            }

            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    format!("failed to create parent directory '{}': {}", parent.display(), e)
                })?;
            }
            let mut out_file = fs::File::create(&out_path)
                .map_err(|e| format!("failed to create file '{}': {}", out_path.display(), e))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("failed to write file '{}': {}", out_path.display(), e))?;
        }
        Ok(())
    }

    fn spawn_npm_process(
        cwd: &Path,
        args: &[&str],
        extra_env: &[(&str, &str)],
    ) -> Result<Child, String> {
        let mut command = if cfg!(target_os = "windows") {
            let mut cmd = Command::new("cmd");
            cmd.arg("/C").arg("npm");
            cmd
        } else {
            Command::new("npm")
        };

        command
            .args(args)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        for (key, value) in extra_env {
            command.env(key, value);
        }

        command.spawn().map_err(|e| {
            format!(
                "failed to run npm {:?} in '{}': {}",
                args,
                cwd.display(),
                e
            )
        })
    }

    fn run_npm_until_exit(
        cwd: &Path,
        args: &[&str],
        extra_env: &[(&str, &str)],
        timeout: Duration,
    ) -> Result<(), String> {
        let mut child = spawn_npm_process(cwd, args, extra_env)?;
        let started = Instant::now();

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if status.success() {
                        return Ok(());
                    }
                    return Err(format!(
                        "npm {:?} failed in '{}' with status: {}",
                        args,
                        cwd.display(),
                        status
                    ));
                }
                Ok(None) => {
                    if started.elapsed() >= timeout {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err(format!(
                            "npm {:?} timed out in '{}' after {:?}",
                            args,
                            cwd.display(),
                            timeout
                        ));
                    }
                    thread::sleep(Duration::from_millis(250));
                }
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "failed while waiting for npm {:?} in '{}': {}",
                        args,
                        cwd.display(),
                        e
                    ));
                }
            }
        }
    }

    fn run_npm_start_smoke(
        cwd: &Path,
        args: &[&str],
        extra_env: &[(&str, &str)],
        startup_window: Duration,
    ) -> Result<(), String> {
        let mut child = spawn_npm_process(cwd, args, extra_env)?;
        let started = Instant::now();

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(format!(
                        "npm {:?} exited too early in '{}' with status: {}",
                        args,
                        cwd.display(),
                        status
                    ));
                }
                Ok(None) => {
                    if started.elapsed() >= startup_window {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Ok(());
                    }
                    thread::sleep(Duration::from_millis(250));
                }
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "failed while waiting for npm {:?} in '{}': {}",
                        args,
                        cwd.display(),
                        e
                    ));
                }
            }
        }
    }

    #[test]
    fn zip_contains_logic_runtime_and_start_scripts() {
        let project = ProjectSchema::new("proj-zip-1", "Zip App");
        let bytes = build_zip_buffer(&project).expect("zip should build");

        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).expect("zip should open");

        assert!(archive.by_name("client/src/logic/flow-runner.ts").is_ok());
        assert!(archive.by_name("server/src/logic/flow-runner.ts").is_ok());
        assert!(archive.by_name("client/src/logic/flow-contract.ts").is_ok());
        assert!(archive.by_name("server/src/logic/flow-contract.ts").is_ok());

        let mut client_pkg = String::new();
        archive
            .by_name("client/package.json")
            .expect("client package exists")
            .read_to_string(&mut client_pkg)
            .expect("client package should read");
        assert!(client_pkg.contains("\"start\""));

        let mut server_pkg = String::new();
        archive
            .by_name("server/package.json")
            .expect("server package exists")
            .read_to_string(&mut server_pkg)
            .expect("server package should read");
        assert!(server_pkg.contains("\"start\""));
        assert!(server_pkg.contains("\"test:e2e\""));
    }

    #[test]
    fn generated_frontend_and_backend_include_logic_runtime_files() {
        let project = ProjectSchema::new("proj-gen-1", "Generate App");
        let wiring = resolve_wiring(&project).expect("wiring should resolve");

        let frontend = collect_frontend_files(&project, &wiring);
        assert!(frontend.iter().any(|f| f.path == "src/logic/flow-contract.ts"));
        assert!(frontend.iter().any(|f| f.path == "src/logic/flow-runner.ts"));
        assert!(frontend.iter().any(|f| f.path == "src/logic/flow-registry.ts"));

        let backend = collect_backend_files(&project, &wiring);
        assert!(backend.iter().any(|f| f.path == "src/logic/flow-contract.ts"));
        assert!(backend.iter().any(|f| f.path == "src/logic/flow-runner.ts"));
        assert!(backend.iter().any(|f| f.path == "src/logic/flow-registry.ts"));
    }

    #[test]
    fn generation_fails_for_unwireable_explicit_trigger() {
        let mut project = ProjectSchema::new("proj-gen-fail-1", "Generate Fail App");
        project.logic_flows.push(LogicFlowSchema::new(
            "flow-unwired",
            "Unwired Event",
            TriggerType::Event {
                component_id: "missing-component".into(),
                event: "onClick".into(),
            },
            FlowContext::Frontend,
        ));

        let err = resolve_wiring(&project).expect_err("wiring should fail");
        match err {
            ApiError::BadRequest(message) => {
                assert!(message.contains("missing-component"));
            }
            other => panic!("expected bad request, got {:?}", other),
        }

        let zip_err = build_zip_buffer(&project).expect_err("zip generation should fail");
        assert!(matches!(zip_err, ApiError::BadRequest(_)));
    }

    #[test]
    fn zip_runtime_smoke_installs_and_starts_generated_apps() {
        if !should_run_zip_runtime_smoke() {
            eprintln!(
                "Skipping ZIP runtime smoke test. Set {}=1 to enable.",
                ZIP_RUNTIME_SMOKE_ENV
            );
            return;
        }

        let project = ProjectSchema::new("proj-zip-runtime-1", "Zip Runtime App");
        let zip_bytes = build_zip_buffer(&project).expect("zip should build");
        let temp_dir = TempDirGuard::new("akasha-zip-runtime").expect("temp dir should be created");
        extract_zip_archive(&zip_bytes, temp_dir.path()).expect("zip should be extracted");

        let client_dir = temp_dir.path().join("client");
        let server_dir = temp_dir.path().join("server");

        run_npm_until_exit(
            &client_dir,
            &["install", "--prefer-offline", "--no-audit", "--no-fund"],
            &[],
            Duration::from_secs(600),
        )
        .expect("client npm install should succeed");
        run_npm_until_exit(
            &server_dir,
            &["install", "--prefer-offline", "--no-audit", "--no-fund"],
            &[],
            Duration::from_secs(600),
        )
        .expect("server npm install should succeed");

        run_npm_start_smoke(
            &client_dir,
            &[
                "start",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "4173",
                "--strictPort",
            ],
            &[("CI", "1")],
            Duration::from_secs(20),
        )
        .expect("client npm start should stay running through startup window");
        run_npm_start_smoke(
            &server_dir,
            &["start"],
            &[("PORT", "3901"), ("CI", "1")],
            Duration::from_secs(30),
        )
        .expect("server npm start should stay running through startup window");
    }
}
