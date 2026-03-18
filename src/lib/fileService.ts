const FILE_API_URL = process.env.NEXT_PUBLIC_FILE_API_URL;
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL;

export type UploadFolder = 'avatars' | 'task-chat' | 'attachments' | 'documents';

const PUBLIC_FOLDERS: UploadFolder[] = ['avatars'];
const PRIVATE_FOLDERS: UploadFolder[] = ['task-chat', 'attachments', 'documents'];

// Upload a file via presigned URL
export async function uploadFile(
  file: File,
  folder: UploadFolder,
  accessToken: string
): Promise<{ objectKey: string }> {
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
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { message?: string }).message || 'Failed to get upload URL');
  }

  const { uploadUrl, objectKey } = (await res.json()) as {
    uploadUrl: string;
    objectKey: string;
  };

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to storage');
  }

  // Always return objectKey only — never the full URL
  return { objectKey };
}

// Get public CDN URL — only for avatars/
export function getPublicUrl(objectKey: string, appId: string | number): string {
  if (!CDN_URL) {
    throw new Error('NEXT_PUBLIC_CDN_URL is not configured');
  }
  return `${CDN_URL}/files-app-${appId}/${objectKey}`;
}

// Get signed URL for private files
export async function getSignedUrl(
  objectKey: string,
  accessToken: string
): Promise<string> {
  if (!FILE_API_URL) {
    throw new Error('NEXT_PUBLIC_FILE_API_URL is not configured');
  }

  const encoded = encodeURIComponent(objectKey);
  const res = await fetch(`${FILE_API_URL}/api/files/signed-url?objectKey=${encoded}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { message?: string }).message || 'Failed to get signed URL');
  }

  const { signedUrl } = (await res.json()) as { signedUrl: string };
  return signedUrl;
}

// Delete a file
export async function deleteFile(objectKey: string, accessToken: string): Promise<void> {
  if (!FILE_API_URL) {
    throw new Error('NEXT_PUBLIC_FILE_API_URL is not configured');
  }

  const encoded = encodeURIComponent(objectKey);
  const res = await fetch(`${FILE_API_URL}/api/files/${encoded}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { message?: string }).message || 'Failed to delete file');
  }
}

// Helper to check if a folder is public
export function isPublicFolder(folder: UploadFolder): boolean {
  return PUBLIC_FOLDERS.includes(folder);
}

