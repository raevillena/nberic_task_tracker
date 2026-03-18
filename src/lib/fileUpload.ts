/**
 * Presigned URL file upload via MSB.io File API.
 * Files are uploaded directly from the client to storage (MinIO); the Next.js backend is not used.
 * Store objectKey in the database; construct CDN URLs at runtime with appId and objectKey.
 *
 * Auth: use the same access token from external auth (Redux). The File API verifies it (e.g. via Redis).
 * appId: can come from the upload-url response (File API) or from NEXT_PUBLIC_EXTERNAL_AUTH_APP_ID (env fallback).
 */

const FILE_API_URL = process.env.NEXT_PUBLIC_FILE_API_URL || '';
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || '';

const isDebug =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEBUG_FILE_UPLOAD === 'true';

function debugLog(message: string, data?: Record<string, unknown>): void {
  if (isDebug) {
    if (data !== undefined) {
      console.log('[FileUpload]', message, data);
    } else {
      console.log('[FileUpload]', message);
    }
  }
}

export interface UploadResult {
  objectKey: string;
  cdnUrl: string;
  /** appId used for cdnUrl (from upload-url response or fallback). */
  appId: string | number;
}

/** Response shape from File API POST /api/files/upload-url */
interface UploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  appId?: string | number;
}

/**
 * Get a presigned URL from the File API, upload the file directly to storage, then return objectKey and CDN URL.
 * appId is taken from the upload-url response when present, otherwise from the passed-in fallback (e.g. env).
 */
export async function uploadFile(
  file: File,
  folder: string,
  accessToken: string,
  appIdFallback: string | number
): Promise<UploadResult> {
  debugLog('Starting upload', {
    fileName: file.name,
    folder,
    size: file.size,
    mimeType: file.type,
    appIdFallback,
    fileApiUrl: FILE_API_URL || '(not set)',
  });

  if (!FILE_API_URL) {
    throw new Error('NEXT_PUBLIC_FILE_API_URL is not configured');
  }

  const res = await fetch(`${FILE_API_URL}/api/files/upload-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      folder,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    debugLog('Upload URL request failed', { status: res.status, err });
    throw new Error((err as { message?: string }).message || 'Failed to get upload URL');
  }

  const data = (await res.json()) as UploadUrlResponse;
  const { uploadUrl, objectKey, appId: responseAppId } = data;

  const appId = responseAppId != null ? responseAppId : appIdFallback;
  debugLog('Got presigned URL', {
    objectKey,
    appIdFromResponse: responseAppId,
    appIdUsed: appId,
    uploadUrlPresent: !!uploadUrl,
  });

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    debugLog('PUT to storage failed', { status: uploadRes.status });
    throw new Error('Failed to upload file to storage');
  }

  const cdnUrl = `${CDN_URL}/files-app-${appId}/${objectKey}`;
  debugLog('Upload complete', { objectKey, cdnUrl, appId });
  return { objectKey, cdnUrl, appId };
}

/**
 * Delete a file by objectKey via the File API.
 */
export async function deleteFile(
  objectKey: string,
  accessToken: string
): Promise<void> {
  if (!FILE_API_URL) {
    throw new Error('NEXT_PUBLIC_FILE_API_URL is not configured');
  }

  const encodedKey = encodeURIComponent(objectKey);
  const res = await fetch(`${FILE_API_URL}/api/files/${encodedKey}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to delete file');
  }
}

/**
 * Build CDN URL for a file from objectKey and appId.
 * Use this when rendering; never store the full URL in the database.
 */
export function getCdnUrl(objectKey: string, appId: string | number): string {
  const base = CDN_URL || 'https://cdn.nbericmmsu.com';
  return `${base}/files-app-${appId}/${objectKey}`;
}

/** Minimal message-like shape for file URL resolution. */
export interface MessageFileLike {
  fileName: string | null;
  fileId: number | null;
}

/**
 * Resolve display URL for a message's file/image.
 * - Full URL (http): use as-is.
 * - CDN objectKey (contains '/', e.g. "task-chat/uuid.ext"): build CDN URL.
 * - Legacy filename (e.g. "uuid.ext" from Next.js /api/files/upload): /uploads/fileName.
 */
export function getMessageFileUrl(
  message: MessageFileLike,
  appId: string | number | null
): string {
  const { fileName, fileId } = message;
  if (!fileName) return `/api/files/${fileId || ''}`;
  if (fileName.startsWith('http')) return fileName;
  if (fileName.startsWith('/')) return fileName;
  if (appId != null && fileName.includes('/')) {
    return getCdnUrl(fileName, appId);
  }
  return `/uploads/${fileName}`;
}
