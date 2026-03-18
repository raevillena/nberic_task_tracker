// File upload API route for images and files

// File upload API: supports external image server or local/PVC storage

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateRequest } from '@/lib/auth/middleware';
import { UPLOAD_DIR, UPLOAD_URL_PATH, IMAGE_SERVER_UPLOAD_URL } from '@/lib/fileStorage';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/** Forward file to external image server. Server must POST multipart "file" and return JSON { url: string }. */
async function uploadToImageServer(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  if (process.env.IMAGE_SERVER_AUTH_HEADER) {
    headers['Authorization'] = process.env.IMAGE_SERVER_AUTH_HEADER;
  }
  const res = await fetch(IMAGE_SERVER_UPLOAD_URL, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image server returned ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Image server response must be JSON with { url: string }');
  }
  return data.url;
}

export async function POST(request: NextRequest) {
  try {
    await authenticateRequest(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // External image server: forward file and return its URL (no local storage)
    if (IMAGE_SERVER_UPLOAD_URL) {
      const externalUrl = await uploadToImageServer(file);
      return NextResponse.json({
        fileId: null,
        fileName: file.name,
        storedFileName: externalUrl,
        fileSize: file.size,
        mimeType: file.type,
        url: externalUrl,
      });
    }

    // Local or PVC storage
    await ensureUploadDir();

    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${UPLOAD_DIR}/${fileName}`.replace(/\/+/g, '/');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileId = fileName.replace(`.${fileExtension}`, '');
    const url = process.env.FILE_UPLOAD_DIR
      ? `/api/files/${fileId}`
      : `${UPLOAD_URL_PATH}/${fileName}`;

    return NextResponse.json({
      fileId,
      fileName: file.name,
      storedFileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      url,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
