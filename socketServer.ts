// Socket.IO standalone server
// Run with: npm run dev:socket

// Load environment variables from .env.local (Next.js style)
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (Next.js priority), then .env
dotenv.config({ path: resolve('.env.local') });
dotenv.config({ path: resolve('.env') });

import { createServer } from 'http';
import { initializeSocketIO } from './src/lib/socket/server';

const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

// Create HTTP server for Socket.IO
const httpServer = createServer();

// Initialize Socket.IO
const io = initializeSocketIO(httpServer);

httpServer.listen(port, () => {
  console.log(`> Socket.IO server ready on http://${hostname}:${port}`);
});
