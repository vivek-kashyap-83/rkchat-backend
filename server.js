/**
 * RK Chat - Main Server Entry Point
 * Secure private messaging application
 * Max 5 users, E2EE messages, real-time via WebSocket
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// Route imports
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');

// Socket handler
const { initializeSocket } = require('./utils/socketHandler');

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB max for socket payloads
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images statically (images are referenced by encrypted URL tokens)
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// ─── Database Connection ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rkchat')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'RK Chat', version: '1.0.0' });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
initializeSocket(io);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 RK Chat server running on port ${PORT}`);
  console.log(`📡 WebSocket ready`);
});

module.exports = { app, io };
