mod store;
use anyhow::{Result, bail};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Query, Request, State},
    http::{HeaderMap, Method, StatusCode, Uri},
    middleware::{self, Next},
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
    routing::{any, get, post},
};
use futures_util::StreamExt;
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use store::Store;
use tokio::sync::{Mutex, RwLock, watch};
use tokio_stream::wrappers::WatchStream;
fn now() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
#[derive(Clone)]
struct Cached {
    value: Value,
    version: String,
    verified: Instant,
}
#[derive(Default)]
struct Counters {
    requests: AtomicU64,
    refreshes: AtomicU64,
    hits: AtomicU64,
    redis_hits: AtomicU64,
    db_hits: AtomicU64,
    invalidations: AtomicU64,
    errors: AtomicU64,
}
#[derive(Clone)]
struct App {
    client: reqwest::Client,
    token: Arc<String>,
    redis: redis::aio::ConnectionManager,
    db: Store,
    cache: Arc<RwLock<Option<Cached>>>,
    refresh: Arc<Mutex<()>>,
    generation: Arc<AtomicU64>,
    redis_ok: Arc<AtomicBool>,
    db_ok: Arc<AtomicBool>,
    metrics: Arc<Counters>,
    updates: watch::Sender<String>,
    public: Arc<String>,
    last_failure: Arc<RwLock<Option<(Instant, String)>>>,
}
impl App {
    async fn engine(&self, path: &str) -> Result<Value> {
        let r = self
            .client
            .get(format!("http://127.0.0.1:4174{path}"))
            .header("x-engine-token", self.token.as_str())
            .timeout(if path.starts_with("/internal/") {
                Duration::from_secs(2)
            } else {
                Duration::from_secs(if std::env::var("LAB_SHARED").unwrap_or_default() == "1" {
                    5
                } else {
                    3
                })
            })
            .send()
            .await?;
        if !r.status().is_success() {
            let status = r.status();
            let detail = r
                .json::<Value>()
                .await
                .ok()
                .and_then(|v| v["error"].as_str().map(str::to_owned))
                .unwrap_or_default();
            bail!("contract engine unavailable ({status}): {detail}")
        }
        Ok(r.json().await?)
    }
    async fn refresh(&self, force: bool) -> Result<Value> {
        let _lock = self.refresh.lock().await;
        if let Some((at, message)) = self.last_failure.read().await.as_ref() {
            if at.elapsed() < Duration::from_millis(500) {
                bail!("engine unavailable: {message}")
            }
        }
        if !force {
            if let Some(c) = self.cache.read().await.as_ref() {
                if c.verified.elapsed() < Duration::from_millis(1000) {
                    self.metrics.hits.fetch_add(1, Ordering::Relaxed);
                    return Ok(c.value.clone());
                }
            }
        }
        let generation = self.generation.load(Ordering::SeqCst);
        let meta = match self.engine("/internal/meta").await {
            Ok(meta) => {
                *self.last_failure.write().await = None;
                meta
            }
            Err(e) => {
                *self.last_failure.write().await = Some((Instant::now(), e.to_string()));
                return Err(e);
            }
        };
        let version = meta["version"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("engine version missing"))?
            .to_string();
        let mut layer = "memory";
        let old = self.cache.read().await.clone();
        let mut value = if let Some(c) = old.as_ref().filter(|c| c.version == version) {
            self.metrics.hits.fetch_add(1, Ordering::Relaxed);
            c.value.clone()
        } else {
            let key = format!("robinpaper:state:{version}");
            let mut redis = self.redis.clone();
            let cached = tokio::time::timeout(
                Duration::from_millis(150),
                redis::cmd("GET")
                    .arg(&key)
                    .query_async::<Option<String>>(&mut redis),
            )
            .await;
            let from_redis = match cached {
                Ok(Ok(Some(s))) => {
                    self.redis_ok.store(true, Ordering::Relaxed);
                    serde_json::from_str::<Value>(&s)
                        .ok()
                        .filter(|v| v["stateVersion"] == version)
                }
                Ok(Ok(None)) => {
                    self.redis_ok.store(true, Ordering::Relaxed);
                    None
                }
                _ => {
                    self.redis_ok.store(false, Ordering::Relaxed);
                    None
                }
            };
            if let Some(v) = from_redis {
                layer = "redis";
                self.metrics.redis_hits.fetch_add(1, Ordering::Relaxed);
                v
            } else {
                let db = self.db.clone();
                let v = version.clone();
                let from_db = tokio::task::spawn_blocking(move || db.load(&v)).await??;
                if let Some(v) = from_db {
                    layer = "sqlite";
                    self.metrics.db_hits.fetch_add(1, Ordering::Relaxed);
                    v
                } else {
                    layer = "engine";
                    self.metrics.refreshes.fetch_add(1, Ordering::Relaxed);
                    match self.engine("/api/state?actor=6").await {
                        Ok(value) => value,
                        Err(e) => {
                            *self.last_failure.write().await =
                                Some((Instant::now(), e.to_string()));
                            return Err(e);
                        }
                    }
                }
            }
        };
        if value["chainId"] != 31337 || !value["blockHash"].is_string() {
            bail!("invalid chain snapshot")
        }
        // Presentation status can change between blocks; overlay cheap metadata without rereading contracts.
        if value["stateVersion"] == meta["version"] {
            for key in ["showcase", "heartbeat", "testing"] {
                value[key] = meta[key].clone();
            }
        }
        let actual = value["stateVersion"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("snapshot version missing"))?
            .to_string();
        if self.generation.load(Ordering::SeqCst) != generation {
            bail!("snapshot superseded by a mutation; retry")
        }
        if layer != "memory" {
            let db = self.db.clone();
            let v = value.clone();
            match tokio::task::spawn_blocking(move || db.commit(&v)).await? {
                Ok(()) => self.db_ok.store(true, Ordering::Relaxed),
                Err(e) => {
                    self.db_ok.store(false, Ordering::Relaxed);
                    bail!("database projection failed: {e}")
                }
            };
            let mut redis = self.redis.clone();
            let result = tokio::time::timeout(
                Duration::from_millis(150),
                redis::cmd("SET")
                    .arg(format!("robinpaper:state:{actual}"))
                    .arg(value.to_string())
                    .arg("EX")
                    .arg(10)
                    .query_async::<()>(&mut redis),
            )
            .await;
            self.redis_ok
                .store(matches!(result, Ok(Ok(()))), Ordering::Relaxed);
        }
        value["backend"] = json!({"api":"rust-axum","database":"sqlite-wal","redis":self.redis_ok.load(Ordering::Relaxed),"stateVersion":actual,"verifiedAtMs":now(),"source":layer});
        let previous = self.updates.borrow().clone();
        let content = value.to_string();
        // Exclude diagnostic time from change detection; SSE only publishes changed state/status.
        let changed = old
            .as_ref()
            .map(|c| {
                c.version != actual
                    || c.value["showcase"] != value["showcase"]
                    || c.value["testing"] != value["testing"]
                    || c.value["heartbeat"] != value["heartbeat"]
                    || c.value["backend"]["redis"] != value["backend"]["redis"]
            })
            .unwrap_or(true);
        *self.cache.write().await = Some(Cached {
            value: value.clone(),
            version: actual,
            verified: Instant::now(),
        });
        if changed || previous.is_empty() {
            self.updates.send_replace(content);
        }
        Ok(value)
    }
    async fn current(&self) -> Result<Value> {
        for attempt in 0..3 {
            match self.refresh(false).await {
                Ok(value) => return Ok(value),
                Err(e) if attempt < 2 && e.to_string().contains("superseded") => continue,
                Err(e) => {
                    self.metrics.errors.fetch_add(1, Ordering::Relaxed);
                    return Err(e);
                }
            }
        }
        bail!("snapshot changed repeatedly; retry")
    }
    async fn invalidate(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        self.metrics.invalidations.fetch_add(1, Ordering::Relaxed);
        *self.cache.write().await = None;
    }
}
fn failure(e: impl std::fmt::Display) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({"error":e.to_string(),"stale":true})),
    )
        .into_response()
}
async fn security(headers: HeaderMap, request: Request, next: Next) -> Response {
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let shared = std::env::var("LAB_SHARED").unwrap_or_default() == "1";
    let lan_host = std::env::var("LAB_LAN_HOST").unwrap_or_default();
    let hosts = ["127.0.0.1:4173", "localhost:4173", lan_host.as_str()];
    if !hosts.contains(&host) || host.is_empty() {
        return (StatusCode::FORBIDDEN, "Unknown host").into_response();
    }
    let path = request.uri().path();
    if let Some(origin) = headers.get("origin") {
        let origin = origin.to_str().unwrap_or("");
        if !(path == "/rpc"
            && (origin.starts_with("chrome-extension://")
                || origin.starts_with("moz-extension://")))
            && !hosts
                .iter()
                .any(|h| !h.is_empty() && origin == format!("http://{h}"))
        {
            return (StatusCode::FORBIDDEN, "Cross-origin request blocked").into_response();
        }
    }
    if shared
        && ((path == "/api/action" || path == "/api/showcase") && request.method() != Method::GET
            || path == "/api/wallets")
    {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"Shared session: use your wallet. Server signers, key export and rollback are disabled."}))).into_response();
    }
    if request.method() != Method::GET
        && path != "/rpc"
        && headers.get("x-lab-request").and_then(|v| v.to_str().ok()) != Some("1")
    {
        return (StatusCode::FORBIDDEN, "UI request header required").into_response();
    }
    let rpc_origin = if path == "/rpc" {
        headers.get("origin").cloned()
    } else {
        None
    };
    let mut response = next.run(request).await;
    if let Some(origin) = rpc_origin {
        let h = response.headers_mut();
        h.insert("access-control-allow-origin", origin);
        h.insert(
            "access-control-allow-methods",
            "POST, OPTIONS".parse().unwrap(),
        );
        h.insert(
            "access-control-allow-headers",
            "content-type".parse().unwrap(),
        );
        h.insert("vary", "Origin".parse().unwrap());
    }
    let h = response.headers_mut();
    h.insert("cache-control", "no-store".parse().unwrap());
    h.insert("x-content-type-options", "nosniff".parse().unwrap());
    h.insert("referrer-policy", "no-referrer".parse().unwrap());
    h.insert("content-security-policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'".parse().unwrap());
    response
}
async fn state_api(State(app): State<App>, Query(q): Query<HashMap<String, String>>) -> Response {
    app.metrics.requests.fetch_add(1, Ordering::Relaxed);
    let actor = q.get("actor").map(|v| v.parse::<u8>()).unwrap_or(Ok(6));
    let actor = match actor {
        Ok(i) if i < 10 => i,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"Choose one of 10 actors"})),
            )
                .into_response();
        }
    };
    match app.current().await {
        Ok(mut v) => {
            v["actor"] = json!(actor);
            Json(v).into_response()
        }
        Err(e) => failure(e),
    }
}
async fn events(State(app): State<App>) -> Response {
    if let Err(e) = app.current().await {
        return failure(e);
    }
    let stream = WatchStream::new(app.updates.subscribe())
        .filter(|s| std::future::ready(!s.is_empty()))
        .map(|s| Ok::<_, Infallible>(Event::default().event("state").data(s)));
    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(5)))
        .into_response()
}
async fn index(State(app): State<App>) -> Response {
    if let Err(e) = app.current().await {
        return failure(e);
    }
    let db = app.db.clone();
    match tokio::task::spawn_blocking(move || db.inspect()).await {
        Ok(Ok(v)) => Json(v).into_response(),
        _ => failure("Database unavailable"),
    }
}
async fn backend(State(app): State<App>) -> Response {
    let engine = app.engine("/internal/stats").await;
    let index = app.db.clone();
    let db = tokio::task::spawn_blocking(move || index.inspect())
        .await
        .ok()
        .and_then(|r| r.ok());
    let c = app.cache.read().await;
    let m = &app.metrics;
    Json(json!({"api":"rust-axum","database":{"kind":"sqlite-wal","healthy":db.is_some()&&app.db_ok.load(Ordering::Relaxed),"index":db},"redis":{"healthy":app.redis_ok.load(Ordering::Relaxed),"ttlSeconds":10},"engine":engine.ok(),"cache":{"stateVersion":c.as_ref().map(|s|&s.version),"ageMs":c.as_ref().map(|s|s.verified.elapsed().as_millis()),"requests":m.requests.load(Ordering::Relaxed),"memoryHits":m.hits.load(Ordering::Relaxed),"redisHits":m.redis_hits.load(Ordering::Relaxed),"databaseHits":m.db_hits.load(Ordering::Relaxed),"engineRefreshes":m.refreshes.load(Ordering::Relaxed),"invalidations":m.invalidations.load(Ordering::Relaxed),"errors":m.errors.load(Ordering::Relaxed)},"consistency":"engine instance + epoch + revision + block hash; no stale DB fallback"})).into_response()
}
async fn proxy(State(app): State<App>, method: Method, uri: Uri, body: Bytes) -> Response {
    let path = uri.path_and_query().map(|v| v.as_str()).unwrap_or("/");
    if ![
        "/api/action",
        "/api/showcase",
        "/api/abi",
        "/api/wallets",
        "/api/prepare",
        "/rpc",
    ]
    .contains(&uri.path())
        && !uri.path().starts_with("/api/receipt/")
    {
        return StatusCode::NOT_FOUND.into_response();
    }
    if method != Method::GET && method != Method::POST {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    let signed_send = serde_json::from_slice::<Value>(&body)
        .ok()
        .is_some_and(|v| {
            v["method"] == "eth_sendRawTransaction"
                || v.as_array().is_some_and(|rows| {
                    rows.iter().any(|r| r["method"] == "eth_sendRawTransaction")
                })
        });
    let mutation = method == Method::POST
        && (["/api/action", "/api/showcase"].contains(&uri.path()) || signed_send);
    if mutation {
        if let Err(e) = app.engine("/internal/meta").await {
            return failure(e);
        }
    }
    if mutation {
        app.invalidate().await;
    }
    let result = app
        .client
        .request(method, format!("http://127.0.0.1:4174{path}"))
        .header("x-engine-token", app.token.as_str())
        .header("x-lab-request", "1")
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await;
    if mutation {
        app.invalidate().await;
    }
    match result {
        Ok(r) => {
            let status = r.status();
            let disposition = r.headers().get("content-disposition").cloned();
            match r.bytes().await {
                Ok(bytes) => {
                    let mut res =
                        (status, [("content-type", "application/json")], bytes).into_response();
                    if let Some(v) = disposition {
                        res.headers_mut().insert("content-disposition", v);
                    }
                    res
                }
                Err(e) => failure(e),
            }
        }
        Err(e) => failure(e),
    }
}
async fn assets(State(app): State<App>, uri: Uri) -> Response {
    let file = match uri.path() {
        "/" => "index.html",
        "/app.js" => "app.js",
        "/wallet.js" => "wallet.js",
        "/style.css" => "style.css",
        "/favicon.svg" => "favicon.svg",
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let mime = match file {
        "app.js" | "wallet.js" => "text/javascript",
        "style.css" => "text/css",
        "favicon.svg" => "image/svg+xml",
        _ => "text/html",
    };
    match tokio::fs::read(format!("{}/{file}", app.public)).await {
        Ok(bytes) => ([("content-type", mime)], bytes).into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
#[tokio::main]
async fn main() -> Result<()> {
    let token = std::env::var("ENGINE_TOKEN")?;
    let redis_password = std::env::var("REDIS_PASSWORD")?;
    let runtime = std::env::var("LAB_RUNTIME")?;
    let public = std::env::var("LAB_PUBLIC")?;
    let redis = redis::Client::open(format!("redis://:{redis_password}@127.0.0.1:6387/0"))?
        .get_connection_manager()
        .await?;
    let (updates, _) = watch::channel(String::new());
    let app = App {
        client: reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?,
        token: Arc::new(token),
        redis,
        db: Store::open(&format!("{runtime}/app.sqlite3"))?,
        cache: Default::default(),
        refresh: Default::default(),
        generation: Default::default(),
        redis_ok: Arc::new(AtomicBool::new(true)),
        db_ok: Arc::new(AtomicBool::new(true)),
        metrics: Default::default(),
        updates,
        public: Arc::new(public),
        last_failure: Default::default(),
    };
    let probe = app.clone();
    tokio::spawn(async move {
        let mut timer = tokio::time::interval(Duration::from_secs(2));
        loop {
            timer.tick().await;
            let mut redis = probe.redis.clone();
            let ping = tokio::time::timeout(
                Duration::from_millis(150),
                redis::cmd("PING").query_async::<String>(&mut redis),
            )
            .await;
            probe
                .redis_ok
                .store(matches!(ping, Ok(Ok(_))), Ordering::Relaxed);
        }
    });
    let worker = app.clone();
    tokio::spawn(async move {
        let mut timer = tokio::time::interval(Duration::from_millis(500));
        loop {
            timer.tick().await;
            if let Err(e) = worker.refresh(true).await {
                if !e.to_string().contains("superseded") {
                    worker.metrics.errors.fetch_add(1, Ordering::Relaxed);
                    eprintln!("Indexer: {e}");
                }
            }
        }
    });
    let router = Router::new()
        .route("/api/state", get(state_api))
        .route("/api/events", get(events))
        .route("/api/index", get(index))
        .route("/api/backend", get(backend))
        .route("/api/action", post(proxy))
        .route("/api/prepare", post(proxy))
        .route(
            "/rpc",
            post(proxy).options(|| async { StatusCode::NO_CONTENT }),
        )
        .route("/api/showcase", get(proxy).post(proxy))
        .route("/api/abi", get(proxy))
        .route("/api/wallets", get(proxy))
        .route("/api/receipt/{hash}", get(proxy))
        .fallback(any(assets))
        .layer(DefaultBodyLimit::max(100_000))
        .layer(middleware::from_fn(security))
        .with_state(app);
    let bind = if std::env::var("LAB_SHARED").unwrap_or_default() == "1" {
        "0.0.0.0:4173"
    } else {
        "127.0.0.1:4173"
    };
    let listener = tokio::net::TcpListener::bind(bind).await?;
    println!("Rust API + SQLite WAL + Redis ready at http://127.0.0.1:4173");
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await?;
    Ok(())
}
