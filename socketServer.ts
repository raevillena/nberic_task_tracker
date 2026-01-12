// Socket.IO standalone server
// Run with: npm run dev:socket

// Load environment variables from .env.local (Next.js style)
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (Next.js priority), then .env
dotenv.config({ path: resolve('.env.local') });
dotenv.config({ path: resolve('.env') });

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { initializeSocketIO } from './src/lib/socket/server';
import { getSocketInstance } from './src/lib/socket/instance';

const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

// Create HTTP server for Socket.IO
const httpServer = createServer();

// Initialize Socket.IO
const io = initializeSocketIO(httpServer);

// Add HTTP endpoints for API routes to emit events
// This allows Next.js API routes (running on port 3000) to trigger socket events
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  const parsedUrl = parse(req.url || '', true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle event emission requests
  if (req.method === 'POST' && parsedUrl.pathname === '/emit') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { event, payload } = data;

        if (event && payload) {
          // Emit the event to all connected clients
          io.emit(event, payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing event or payload' }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(port, () => {
  console.log(`> Socket.IO server ready on http://${hostname}:${port}`);
});
