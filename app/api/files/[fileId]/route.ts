// File download/serve API route

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { authenticateRequest } from '@/lib/auth/middleware';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Authenticate request
    await authenticateRequest(request);

    const { fileId } = await params;

    // Find file by ID (in production, query database)
    // For now, we'll look for files matching the pattern
    const files = await import('fs/promises').then((fs) =>
      fs.readdir(UPLOAD_DIR)
    );
    const file = files.find((f) => f.startsWith(fileId));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const filePath = join(UPLOAD_DIR, file);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const mimeType = file.endsWith('.png')
      ? 'image/png'
      : file.endsWith('.jpg') || file.endsWith('.jpeg')
      ? 'image/jpeg'
      : file.endsWith('.gif')
      ? 'image/gif'
      : file.endsWith('.webp')
      ? 'image/webp'
      : 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${file}"`,
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
