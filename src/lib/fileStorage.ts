/**
 * File upload storage configuration.
 *
 * Modes:
 * 1. External image server: set IMAGE_SERVER_UPLOAD_URL. Files are POSTed there; response URL is used (no local storage).
 * 2. Local/PVC: set FILE_UPLOAD_DIR for a persistent path (e.g. K8s PVC). Omit to use public/uploads (ephemeral in pods).
 */
import { join } from 'path';

/** When set, uploads are forwarded to this URL (POST multipart "file"); response must be JSON with { url: string }. */
export const IMAGE_SERVER_UPLOAD_URL = process.env.IMAGE_SERVER_UPLOAD_URL || '';

export const UPLOAD_DIR =
  process.env.FILE_UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');

/** Base URL path for uploaded files when served by the app (e.g. /uploads/). Used when files live under public. */
export const UPLOAD_URL_PATH = process.env.FILE_UPLOAD_URL_PATH || '/uploads';
