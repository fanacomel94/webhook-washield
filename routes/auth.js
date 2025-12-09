/**
 * Authentication Routes
 * Device registration and token management
 */

const express = require('express');
const router = express.Router();
const { generateDeviceToken } = require('../middleware/auth');
const { User } = require('../models/database');
const { generateId, computeKeyFingerprint, safeLog } = require('../utils/helpers');

/**
 * POST /api/auth/register
 * Register a new device/user
 * Body: {
 *   deviceId: string (unique device identifier),
 *   publicKey: string (base64 X25519 public key),
 *   signingPublicKey: string (base64 Ed25519 public key),
 *   displayName: string (optional),
 *   phoneNumber: string (optional)
 * }
 */
router.post('/register', (req, res) => {
  try {
    const {
      deviceId,
      publicKey,
      signingPublicKey,
      displayName = 'User',
      phoneNumber,
    } = req.body;

    if (!deviceId || !publicKey || !signingPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceId, publicKey, signingPublicKey',
      });
    }

    // Check if device already registered
    const existingUser = User.findByDeviceId(deviceId);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Device already registered',
        userId: existingUser.id,
      });
    }

    // Compute key fingerprints
    const publicKeyId = computeKeyFingerprint(publicKey);

    // Create user record
    const user = User.create({
      deviceId,
      publicKey,
      publicKeyId,
      signingPublicKey,
      displayName,
      phoneNumber,
    });

    // Generate authentication token
    const token = generateDeviceToken(deviceId);

    safeLog('New device registered', {
      userId: user.id,
      deviceId: user.deviceId,
      publicKeyId: user.publicKeyId,
    });

    return res.status(201).json({
      success: true,
      data: {
        userId: user.id,
        deviceId: user.deviceId,
        publicKeyId: user.publicKeyId,
        registeredAt: user.createdAt,
        token,
      },
    });
  } catch (error) {
    console.error('Error registering device:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to register device',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate a registered device (obtain token)
 * Body: {
 *   deviceId: string
 * }
 */
router.post('/login', (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceId',
      });
    }

    const user = User.findByDeviceId(deviceId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Device not registered. Please call /auth/register first.',
      });
    }

    // Generate token
    const token = generateDeviceToken(deviceId);

    // Update last seen
    user.lastSeen = new Date().toISOString();

    safeLog('Device logged in', { userId: user.id, deviceId });

    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        token,
        lastSeen: user.lastSeen,
      },
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', (req, res) => {
  try {
    const userId = req.userId;

    // In a real system, fetch from database using userId
    // For now, return a minimal profile
    return res.status(200).json({
      success: true,
      data: {
        userId,
        authenticated: true,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      message: error.message,
    });
  }
});

module.exports = router;
