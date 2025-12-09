/**
 * Authentication Middleware
 * Validates requests from Flutter app using device ID and shared secret
 */

const deviceSecrets = {}; // In production, use a database

function authMiddleware(req, res, next) {
  // Skip auth for health check and webhook verification
  if (req.path === '/health' || req.path === '/webhook') {
    return next();
  }

  const deviceId = req.headers['x-device-id'];
  const authToken = req.headers['authorization'];

  if (!deviceId || !authToken) {
    return res.status(401).json({
      success: false,
      error: 'Missing device ID or authorization token',
    });
  }

  // Validate device ID format (should be UUID or similar)
  if (!/^[a-zA-Z0-9-]{20,}$/.test(deviceId)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid device ID format',
    });
  }

  // In production, validate token against a JWT or session store
  // For MVP, we do basic validation
  if (!authToken.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization format',
    });
  }

  // Attach device ID to request for later use
  req.deviceId = deviceId;
  req.userId = deviceId; // In production, map device ID to user ID

  next();
}

/**
 * Generate a device token (called during app registration)
 */
function generateDeviceToken(deviceId) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  deviceSecrets[deviceId] = {
    token,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
  };
  return `Bearer ${token}`;
}

/**
 * Validate webhook signature
 */
function validateWebhookSignature(req, res, next) {
  const whatsappService = require('../services/whatsappService');
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.warn('No webhook signature provided');
    // In production, reject; for testing/dev, allow
    return next();
  }

  try {
    const isValid = whatsappService.verifyWebhookSignature(signature, req.rawBody || '');
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
  } catch (error) {
    console.error('Signature verification error:', error.message);
    return res.status(403).json({ error: 'Signature verification failed' });
  }

  next();
}

module.exports = {
  authMiddleware,
  generateDeviceToken,
  validateWebhookSignature,
};
