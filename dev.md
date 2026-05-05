# Development & Production Readiness Context

> Updated when fixing or breaking things. Goal: give complete context for new chats.

## Production Readiness (current)

### Done
- **Auth**: External auth (umans-api) integrated; login, refresh, isAuthenticated use GET/POST correctly. Refresh token persisted in `token_sessions` (access + refresh hashes updated on refresh). Client uses `apiRequest` with single shared refresh and logout only on `REFRESH_TOKEN_*` / `SESSION_NOT_FOUND`.
- **Security**: Access token in header only; refresh in httpOnly cookie (secure in prod, sameSite strict). Security headers in `next.config.js` (HSTS, X-Frame-Options, X-Content-Type-Options, etc.). `.env*.local` and `.env` in `.gitignore`.
- **Logging**: Frontend console: no `console.log`/`console.warn` in production paths; only intentional `console.error` for real failures. Server: `console.error` with clear prefixes for API/auth/socket/DB; dev-only logs guarded by `NODE_ENV === 'development'` where kept.
- **Debug removal**: Removed hardcoded `http://127.0.0.1:7242/ingest/...` fetch calls from socket client (`task-request:created` handler).
- **File viewer**: `fileUrl` null handling fixed for img/src and download link (TypeScript build).
- **Notifications**: Safe JSON parse on `/api/notifications` responses to avoid "Unexpected end of JSON input" when token expires/refresh runs.
- **Container/K8s**: Added `Dockerfile` and Kubernetes manifests in `k8/` for web + socket deployments/services, configmap, and migrate/seed jobs.

### Production topology (current target)

- **App**: Web + Socket + migrate/seed **Jobs** run in **Kubernetes** (same container image).
- **Exposure**: Using **NodePort** Services — web `31130`, socket `31131`.
- **Socket replicas (current)**: Set to **1** for now to avoid cross-pod real-time inconsistencies until a shared Socket.IO adapter (e.g. Redis adapter) is added.
- **Database**: **MariaDB on a separate VM** (not a pod). Cluster workloads connect over the network using `DB_HOST` / `DB_PORT` (see deployment checklist: firewall, `bind-address`, test from a debug pod).

### Before Going Live
- **Env**: Set production env (e.g. `NODE_ENV=production`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`, `EXTERNAL_AUTH_API_URL`, `DB_*`, `JWT_SECRET`). Ensure no secrets in `NEXT_PUBLIC_*`.
- **Socket**: Run Socket server in prod (e.g. `SOCKET_SERVER_URL` / `SOCKET_PORT`) and set `NEXT_PUBLIC_SOCKET_URL` to the public URL.
- **File API**: If using MSB file API, set `NEXT_PUBLIC_FILE_API_URL` and `NEXT_PUBLIC_CDN_URL` (and optional `NEXT_PUBLIC_EXTERNAL_AUTH_APP_ID`).
- **DB**: Run migrations; ensure `DB_PASSWORD` (and other DB_*) set. Connection errors are logged.
- **Optional**: Rate limit auth routes; add structured logging (e.g. JSON) for log aggregators.

### Known / Intentional
- **Server console**: Some server-side `console.log`/`console.warn` remain for ops (e.g. Socket connect/disconnect, DB connection success, compliance_flags missing). These are server-only and acceptable for production logs.
- **authSlice**: Two dev-only `console.log` in `initializeAuth` (hasStoredToken, No stored auth data) guarded by `NODE_ENV === 'development'`.
- **fileUpload**: Logging only when `NODE_ENV === 'development'` or `NEXT_PUBLIC_DEBUG_FILE_UPLOAD === 'true'`.

## Auth Flow (reference)
- Login: POST to app `/api/auth/login` → external login → store session (access + refresh hashes) → set refresh cookie (path `/`) → return access token + user.
- Protected request: `Authorization: Bearer <accessToken>`; on 401, client calls `/api/auth/refresh` (cookie) → app looks up session by refresh hash → POST external `/api/auth/refresh` with Cookie + body `{ id, role }` → update session hashes → return new access token.
- External refresh returns only `{ accessToken }` (no new refresh token). External isAuthenticated: GET with Authorization + Cookie.

## Deployment plan / checklist

Use this when shipping the **Next.js web app** (`npm start`, port 3000), **standalone Socket.IO server** (`npm run dev:socket`, default port 3001), and **MariaDB** (Sequelize migrations/seeders). Kubernetes manifests live in `k8/`; the same container image is used for web, socket, migrate, and seed jobs.

### 1. Prerequisites

- [ ] **Container registry**: Push access; replace `your-registry/nberic-task-tracker:latest` in all `k8/*.yaml` files (or use Kustomize/Helm overlays).
- [ ] **Kubernetes**: Manifests use the **`default`** namespace; workload identity / image pull secrets if needed.
- [ ] **Database (VM)**: MariaDB runs **outside the cluster**. Create DB + user on the VM; set `DB_HOST` to the VM’s **DNS name or IP** that is routable from **pod egress** (not the in-cluster name `mariadb` unless you intentionally proxy).
- [ ] **External auth**: Umans (or compatible) API available; `EXTERNAL_AUTH_API_URL` and app IDs match production.
- [ ] **DNS + TLS**: Public hostnames for the web app and for the browser-facing Socket URL (`NEXT_PUBLIC_SOCKET_URL`); Ingress or gateway certs configured.
- [ ] **File uploads**: Choose **external uploader** (`IMAGE_SERVER_UPLOAD_URL`) and/or **persistent volume** (`FILE_UPLOAD_DIR` on a PVC). Default `public/uploads` is **ephemeral** in pods and will lose files on restart unless you use a volume or external storage.

#### Database on another VM (typical prod)

- [ ] **Listen / bind**: On the VM, MariaDB must listen on an interface the cluster can reach (often `0.0.0.0` or the VM’s LAN IP), not only `127.0.0.1`, unless you use a VPN/sidecar tunnel to localhost.
- [ ] **Firewall / security group**: Allow **TCP `DB_PORT`** (usually 3306) from **Kubernetes node IPs** or the **pod CIDR** / SNAT egress your platform uses—whichever matches how your cluster reaches the internet/LAN. Deny the rest of the internet.
- [ ] **User grants**: DB user host should allow connections from cluster clients (e.g. `user@%` or a specific subnet); match your security model.
- [ ] **Verify before migrate**: From a throwaway pod in the same namespace, `nc -zv $DB_HOST 3306` or a MariaDB client using the same credentials as the Secret—same path the **migrate Job** will use.
- [ ] **Latency / HA**: Single VM DB is fine to start; plan backups on the VM and monitor connection pool exhaustion on web pods if traffic grows.

### 2. Configuration (ConfigMap + Secret)

- [ ] Copy `k8/secret.example.yaml` to a real Secret (never commit secrets). Set strong `DB_PASSWORD` and `JWT_SECRET`.
- [ ] Edit `k8/configmap.yaml`: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`, `EXTERNAL_AUTH_API_URL`, `EXTERNAL_AUTH_APP_ID`, `NEXT_PUBLIC_EXTERNAL_AUTH_APP_ID`, file API/CDN URLs if used, `SOCKET_SERVER_URL` (keep internal cluster DNS, e.g. `http://nberic-task-tracker-socket:3001`, even when external access uses NodePort). Set `DB_HOST` to your **DB VM** hostname/IP; `DB_NAME` / `DB_USER` / `DB_PORT` as on the VM.
- [ ] Keep `DB_PASSWORD` only in Secret (`k8/secret.example.yaml` pattern), not in ConfigMap.
- [ ] Optional env vars not in the sample ConfigMap but used by code: `IMAGE_SERVER_UPLOAD_URL`, `IMAGE_SERVER_AUTH_HEADER`, `FILE_UPLOAD_DIR`, `FILE_UPLOAD_URL_PATH`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`. Add to ConfigMap/Secret as needed.
- [ ] Confirm **no secrets** in `NEXT_PUBLIC_*` (those are exposed to the browser).

### 3. Build and push image

- [ ] `docker build -t <registry>/nberic-task-tracker:<tag> .`
- [ ] `docker push <registry>/nberic-task-tracker:<tag>`
- [ ] Update image references in deployments/jobs if not using `:latest`.

### 4. Apply Kubernetes resources (order)

1. [ ] `kubectl apply -f k8/configmap.yaml` (after edits)
2. [ ] Create/update Secret (from example, via `kubectl apply` or sealed secrets / external secrets).
3. [ ] **Migrate**: `kubectl apply -f k8/job.migrate.yaml` — wait for Job success (`kubectl logs job/nberic-task-tracker-migrate`).
4. [ ] **Seed** (only if needed, often once per env): `kubectl apply -f k8/job.seed.yaml` — verify logs; re-running may duplicate data depending on seeders.
5. [ ] `kubectl apply -f k8/socket.service.yaml` → `k8/socket.deployment.yaml`
6. [ ] `kubectl apply -f k8/web.service.yaml` → `k8/web.deployment.yaml`
7. [ ] **NodePort exposure**: web Service `31130`, socket Service `31131` (ensure node firewall allows trusted sources only). If later moving to Ingress, keep WebSocket support enabled.
8. [ ] If **multiple socket replicas**: enable **session affinity** (sticky cookies or consistent hashing) on the path/route used by Socket.IO so a client stays on one pod.

### 5. Post-deploy verification

- [ ] Web: HTTPS loads login; health implied by readiness on `/login`.
- [ ] Login end-to-end; refresh token cookie (secure, correct domain).
- [ ] Real-time: open task flow that uses sockets; confirm events across clients.
- [ ] API routes that emit via `NEXT_PUBLIC_SOCKET_URL` / internal `SOCKET_SERVER_URL` still reach the socket server (cluster DNS + network policy).
- [ ] File upload/download if enabled (external API or PVC path).
- [ ] DB connectivity logs clean on web and migrate job.

### 6. Rollouts and ops

- [ ] **New release**: build/push image → `kubectl rollout restart deployment/nberic-task-tracker-web deployment/nberic-task-tracker-socket`. Run migrate Job again when there are new migrations (use a unique Job name or Helm hook pattern).
- [ ] **Backups**: MariaDB backup strategy for production.
- [ ] **Scaling**: Web replicas independent of socket; tune CPU/memory from `k8/*.yaml` based on metrics.
- [ ] **Known tradeoff**: Socket process runs via `ts-node` in the image (see `Dockerfile` note); acceptable for early prod; consider a slimmer dedicated socket image or compiled server later.

## Broken / Fix History
- Refresh “not persisting”: Fixed by updating both `accessTokenHash` and `refreshTokenHash` in `token_sessions` on refresh (external can rotate refresh).
- isAuthenticated method: Confirmed GET (not POST) for external `/api/auth/isAuthenticated`.
- Notifications 500 / JSON parse: Guarded `response.json()` in notificationSlice and return empty array on parse failure.
- FileViewer build: Only render `<img>` when `fileUrl` is non-null; `href={fileUrl ?? undefined}` for download link.
