import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';

// Types for BMS data (based on the ESP32 payload)
interface BMSData {
  device_id: string;
  timestamp_ms: number;
  wifi_rssi_sta: number;
  temperature_c: (number | null)[];
  pack1: {
    cell1_v: string;
    cell2_v: string;
    cell3_v: string;
    cell4_v: string;
    total_v: string;
    current_a: string;
    power_w: string;
    status: string;
  };
  pack2: {
    cell1_v: string;
    cell2_v: string;
    cell3_v: string;
    cell4_v: string;
    total_v: string;
    current_a: string;
    power_w: string;
    status: string;
  };
  received_at?: number;
}

const history: BMSData[] = [];
const MAX_HISTORY = 100;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(cors());
  app.use(express.json());

  // API Route for ESP32 POST
  app.post('/api/bms', (req, res) => {
    console.log(`[BMS] Incoming POST from ${req.ip}`);
    
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('[BMS] Error: Received empty body');
      return res.status(400).json({ error: 'Empty body' });
    }

    const data = req.body as BMSData;
    data.received_at = Date.now();

    // Store in history
    history.push(data);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    // Broadcast to all connected clients
    io.emit('bms_update', data);

    console.log(`[BMS] Success: Received data from ${data.device_id}`);
    res.status(201).json({ status: 'ok', received: true });
  });

  // Diagnostic GET route
  app.get('/api/bms', (req, res) => {
    res.json({ 
      status: "online", 
      message: "BMS API is alive. Please use POST to send data.",
      history_count: history.length
    });
  });

  // API Route for initial history
  app.get('/api/bms-history', (req, res) => {
    res.json(history);
  });

  // Socket.io connection
  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    // Send latest data point immediately if available
    if (history.length > 0) {
      socket.emit('bms_update', history[history.length - 1]);
    }
    
    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
