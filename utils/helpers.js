/**
 * Utility functions
 */

const crypto = require('crypto');

/**
 * Generate a unique ID
 */
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Compute SHA-256 fingerprint of a public key
 */
function computeKeyFingerprint(publicKeyBase64) {
  try {
    const hash = crypto.createHash('sha256').update(publicKeyBase64).digest('hex');
    return hash.substring(0, 16).toUpperCase();
  } catch (error) {
    console.error('Failed to compute key fingerprint:', error.message);
    return null;
  }
}

/**
 * Format timestamp for WhatsApp API
 */
function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Safely log (don't log sensitive data)
 */
function safeLog(message, data = {}) {
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = ['accessToken', 'appSecret', 'phoneNumber', 'publicKey', 'privateKey'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  console.log(`[${new Date().toISOString()}] ${message}`, sanitized);
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phoneNumber) {
  // Remove spaces, dashes, parentheses
  const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
  
  // Check if it's a valid international format
  return /^\+?[1-9]\d{1,14}$/.test(cleaned);
}

/**
 * Format phone number to standard format
 */
function formatPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Assume India country code if not present
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return '+' + cleaned;
  }
  
  return '+' + cleaned;
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = delayMs * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Parse incoming WhatsApp webhook message
 */
function parseIncomingMessage(webhookData) {
  try {
    const entry = webhookData.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return null;

    // Handle incoming messages
    if (value.messages) {
      const message = value.messages[0];
      return {
        type: 'message',
        messageId: message.id,
        from: message.from,
        timestamp: message.timestamp,
        messageType: message.type,
        text: message.text?.body,
        media: message.image || message.document || message.audio || message.video,
      };
    }

    // Handle message status updates
    if (value.statuses) {
      const status = value.statuses[0];
      return {
        type: 'status',
        messageId: status.id,
        status: status.status,
        timestamp: status.timestamp,
        recipientId: status.recipient_id,
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse webhook message:', error.message);
    return null;
  }
}

module.exports = {
  generateId,
  computeKeyFingerprint,
  getTimestamp,
  safeLog,
  isValidPhoneNumber,
  formatPhoneNumber,
  retryWithBackoff,
  parseIncomingMessage,
};
