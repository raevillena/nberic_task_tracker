# Production assessment: K8s, separate DB, nginx, image upload

This document covers deployment in a **Kubernetes cluster** with **databases as internal services** and **static assets served via nginx**, plus a **review of image upload** and current mitigations.

---

## 1. Image / file upload (current vs production)

### Current behavior

- **Upload:** `POST /api/files/upload` writes files to `public/uploads/` (or `FILE_UPLOAD_DIR` if set).
- **Serve:** Files under `public/uploads/` are served by Next.js at `/uploads/<filename>`. The app also serves files via `GET /api/files/[fileId]` (auth required).
- **References:** Task chat and file viewer use `/uploads/${fileName}` or `/api/files/${fileId}`.

### Issues for production / K8s

| Issue | Impact |
|-------|--------|
| **Ephemeral disk** | Pod filesystem is lost on restart; `public/uploads` is not persistent. |
| **Multiple replicas** | Each pod has its own filesystem; uploads on one pod are not visible on another. |
| **No DB record** | Upload metadata is not stored in DB (only in messages); no file_uploads table in use. |
| **public/ in image** | If uploads go to `public/uploads`, they are inside the container and not shared; build could also bloat if uploads were ever committed. |

### Changes made

- **Configurable upload directory:** `FILE_UPLOAD_DIR` (env) overrides the default `public/uploads`. In K8s, set this to a **PersistentVolumeClaim** mount path (e.g. `/data/uploads`).
- **URL when using custom dir:** When `FILE_UPLOAD_DIR` is set, the API returns `url: /api/files/<fileId>` so the app always serves files via the API (no reliance on Next.js static serving from that path).
- **`.gitignore`:** `public/uploads/` is ignored so uploads are never committed.

### Recommended production setup

1. **Separate image server (recommended for K8s)**  
   - Host images on a dedicated server (e.g. nginx serving a volume, or an upload API that stores to disk/S3 and returns a URL).  
   - Set **`IMAGE_SERVER_UPLOAD_URL`** to that server’s upload endpoint (e.g. `https://images.mycompany.com/upload`).  
   - **Contract:** the app POSTs `multipart/form-data` with field `file`; the server must respond with JSON `{ "url": "https://..." }` (the public URL of the file).  
   - Optional: set **`IMAGE_SERVER_AUTH_HEADER`** (e.g. `Bearer <token>`) if the image server requires auth.  
   - No local or PVC storage is used; pods stay stateless and no upload persistence is needed in the app cluster.  
   - **Image server contract:** accept `POST` with `Content-Type: multipart/form-data`, field name `file`. Respond with `Content-Type: application/json` and body `{ "url": "https://your-image-server/path/to/file.jpg" }` (the public URL to access the file). Optional: support `Authorization` header when `IMAGE_SERVER_AUTH_HEADER` is set.

2. **Single-replica + PVC**  
   - Mount a PVC at e.g. `/data/uploads`, set `FILE_UPLOAD_DIR=/data/uploads`.  
   - All uploads and file serving go through the app (nginx proxies to the app).

3. **Multiple replicas with shared storage**  
   - Use a **shared read-write volume** (e.g. NFS/PVC) and set `FILE_UPLOAD_DIR` to that mount, or use **object storage** (S3/MinIO) behind a small adapter that returns URLs.

4. **nginx serving static**  
   - With **image server:** nginx only proxies the app; images are loaded from the image server’s URLs.  
   - With **PVC:** uploads live on `FILE_UPLOAD_DIR`; file URLs use `/api/files/<fileId>` and nginx proxies `/api` to the app.

---

## 2. Database (separate internal server)

### Current config

- **Sequelize** (and app) use env: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- **config/config.js** (Sequelize CLI) loads `.env` / `.env.local`; production section uses these with no defaults (correct for strict config).
- **src/lib/db/connection.ts** uses the same vars with fallbacks; in production, ensure env is set so fallbacks are not used.

### For K8s

- Run MariaDB/MySQL as a separate service (e.g. in the same cluster or internal network).
- Set env from K8s Secret (or external secret store):

  - `DB_HOST` = internal service name (e.g. `mariadb.namespace.svc.cluster.local`) or internal LB.
  - `DB_PORT` = 3306 (or your port).
  - `DB_NAME`, `DB_USER`, `DB_PASSWORD` from secrets.

- **Connection pooling** (config and connection.ts) is already set (e.g. max 20, min 5 in production); adjust if needed for replica count and DB limits.
- Ensure the DB server allows connections from the pod network (security groups / network policies).

---

## 3. Static assets and nginx

### Next.js behavior

- **Build:** `next build` produces `.next/` and can copy `public/` into the build output.
- **Serving:** Next.js serves `public/*` at `/*` (e.g. `public/favicon.ico` → `/favicon.ico`). With `FILE_UPLOAD_DIR` set, uploads are **not** under `public/`, so nginx does not need to serve an uploads directory from disk.

### Options with nginx

1. **nginx as reverse proxy only (recommended)**  
   - nginx terminates TLS and proxies to the Next.js app (Node server or standalone server).  
   - Static assets (JS/CSS/images from the Next build) are served by Next.js; no need for nginx to serve them from disk unless you want to offload them later.

2. **nginx serves some static**  
   - If you later add `output: 'export'` for a static export, nginx could serve the exported `out/` for static files and proxy API/dynamic routes to the app.  
   - Current app uses API routes and likely SSR, so **standalone** (see below) or normal Node server behind nginx is the typical setup.

### Next.js standalone (optional for smaller image)

- In `next.config.js` add `output: 'standalone'`.  
- Build produces `.next/standalone` and a `.next/static` copy; run `node .next/standalone/server.js` (or similar) in the container.  
- Static assets are still served by the Node process; nginx proxies to it. This reduces image size and is well-suited for K8s.

---

## 4. Environment variables (production checklist)

Ensure these are set in the K8s deployment (ConfigMap/Secret) or external secret manager:

| Variable | Purpose |
|----------|--------|
| `NODE_ENV` | `production` |
| `DB_HOST` | Internal DB host (e.g. K8s service) |
| `DB_PORT` | 3306 (or your port) |
| `DB_NAME` | Database name |
| `DB_USER` | DB user |
| `DB_PASSWORD` | DB password (from Secret) |
| `IMAGE_SERVER_UPLOAD_URL` | Optional; when set, uploads are forwarded here (POST multipart `file`); response must be JSON `{ "url": "https://..." }`. No local storage used. |
| `IMAGE_SERVER_AUTH_HEADER` | Optional; e.g. `Bearer <token>` for the image server upload endpoint. |
| `FILE_UPLOAD_DIR` | Optional when using image server; otherwise e.g. `/data/uploads` (PVC) so uploads persist. |
| `EXTERNAL_AUTH_API_URL` | External auth API base URL |
| `EXTERNAL_AUTH_APP_ID` | App ID for external auth |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `https://your-domain`) for cookies and CORS |
| `NEXT_PUBLIC_SOCKET_URL` | Socket server URL (if used by client) |
| `SOCKET_SERVER_URL` | Socket server URL (if used by server-side code) |
| `SOCKET_PORT` | Socket server port (e.g. 3001) |
| `HOSTNAME` / `PORT` | If used by the Next server or socket server |

Do **not** commit `.env` or `.env.local`; inject env from K8s or CI.

---

## 5. Security and hardening

- **Auth:** Access and refresh tokens, cookie settings (e.g. `secure`, `sameSite`) are already set with production in mind; keep `NEXT_PUBLIC_APP_URL` correct.
- **Headers:** next.config.js already sets security headers (HSTS, X-Frame-Options, etc.); nginx can add or reinforce them.
- **Secrets:** Store DB and auth-related secrets in K8s Secrets or an external store; never in image or repo.
- **Uploads:** Validation (type, size) is in place; consider virus scanning or additional checks if required by policy.

---

## 6. Summary

| Area | Status | Action |
|------|--------|--------|
| **Image upload** | Addressed | Use `FILE_UPLOAD_DIR` (e.g. PVC at `/data/uploads`); with custom dir, URLs use `/api/files/<id>`. For multi-replica scale-out, plan for object storage or shared volume. |
| **DB** | Ready | Set `DB_*` env from internal host/secret; ensure network access from pods. |
| **Static / nginx** | Ready | Proxy to Next.js; uploads not under `public/` when using PVC; optional `output: 'standalone'` for containers. |
| **Secrets** | Manual | Ensure all secrets in K8s Secrets or external store; no defaults in production for DB and auth. |

If you want, next steps can include: a sample K8s Deployment/Service and PVC for the app and uploads, or a small S3/MinIO adapter for file upload and serve.
