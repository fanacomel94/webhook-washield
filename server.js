/**
 * WA-Shield Backend Server
 * Node.js + Express backend for WhatsApp Cloud API integration
 * 
 * Features:
 * - WhatsApp Cloud API integration (send/receive messages)
 * - Device authentication
 * - Contact management with public key verification
 * - Encrypted message storage
 * - Webhook handling for incoming messages and status updates
 */

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const contactRoutes = require('./routes/contacts');
const webhookRoutes = require('./routes/webhook');

// Import middleware
const { authMiddleware, validateWebhookSignature } = require('./middleware/auth');

// Import utilities
const { safeLog } = require('./utils/helpers');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============= MIDDLEWARE =============

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    process.env.FLUTTER_APP_URL || '*',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Body parser with raw body capture for webhook signature verification
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============= HEALTH CHECK =============

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// ============= API ROUTES =============

// Public routes (no authentication)
app.use('/webhook', webhookRoutes);

// Authentication routes (device registration/login)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);

// ============= 404 HANDLER =============

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// ============= ERROR HANDLER =============

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============= START SERVER =============

const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 WA-Shield Backend Started');
  console.log('='.repeat(50));
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  // Log configuration status (without secrets)
  const whatsappConfig = require('./config/whatsapp');
  console.log('\n📋 Configuration Status:');
  console.log(`  ✓ WhatsApp API URL: ${whatsappConfig.apiUrl}`);
  console.log(`  ${whatsappConfig.phoneNumberId ? '✓' : '✗'} Phone Number ID: ${whatsappConfig.phoneNumberId ? 'SET' : 'NOT SET'}`);
  console.log(`  ${whatsappConfig.accessToken ? '✓' : '✗'} Access Token: ${whatsappConfig.accessToken ? 'SET' : 'NOT SET'}`);
  console.log(`  ${whatsappConfig.appSecret ? '✓' : '✗'} App Secret: ${whatsappConfig.appSecret ? 'SET' : 'NOT SET'}`);
  console.log(`  ✓ Webhook Verify Token: SET`);
  console.log('\n📚 Available Endpoints:');
  console.log('  GET  /health                          - Health check');
  console.log('  POST /api/auth/register               - Register device');
  console.log('  POST /api/auth/login                  - Login device');
  console.log('  GET  /api/auth/profile                - Get profile');
  console.log('  POST /api/messages/send               - Send encrypted message');
  console.log('  GET  /api/messages/:conversationId    - Get message history');
  console.log('  POST /api/messages/:messageId/read    - Mark message as read');
  console.log('  POST /api/contacts                    - Add contact');
  console.log('  GET  /api/contacts                    - List contacts');
  console.log('  PUT  /api/contacts/:contactId/verify  - Verify contact');
  console.log('  GET  /webhook                         - Webhook verification');
  console.log('  POST /webhook                         - Receive webhook events');
  console.log('\n' + '='.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
