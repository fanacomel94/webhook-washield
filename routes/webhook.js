/**
 * Webhook Routes
 * Handle incoming messages and status updates from WhatsApp Cloud API
 */

const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { Message, Conversation } = require('../models/database');
const { validateWebhookSignature } = require('../middleware/auth');
const { parseIncomingMessage, safeLog } = require('../utils/helpers');

/**
 * GET /webhook
 * Webhook verification endpoint (called by Meta when registering webhook)
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && whatsappService.validateWebhookToken(token)) {
    safeLog('Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    safeLog('Webhook verification failed', { mode, token: token ? '***' : 'missing' });
    return res.status(403).json({ error: 'Verification failed' });
  }
});

/**
 * POST /webhook
 * Receive incoming messages and status updates from WhatsApp
 * Meta sends:
 * - Messages (incoming text, media, templates)
 * - Status updates (sent, delivered, read)
 * - Template updates, etc.
 */
router.post('/', validateWebhookSignature, (req, res) => {
  try {
    const body = req.body;

    // WhatsApp sends data in a specific structure
    if (body.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Not a WhatsApp webhook' });
    }

    // Process each entry (can have multiple)
    if (body.entry && body.entry.length > 0) {
      body.entry.forEach(entry => {
        if (entry.changes && entry.changes.length > 0) {
          entry.changes.forEach(change => {
            handleChange(change);
          });
        }
      });
    }

    // Always respond with 200 immediately
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Handle individual change from webhook
 */
function handleChange(change) {
  try {
    const field = change.field;
    const value = change.value;

    if (field === 'messages') {
      handleIncomingMessage(value);
    } else if (field === 'message_status') {
      handleMessageStatus(value);
    } else if (field === 'message_template_status_update') {
      handleTemplateStatusUpdate(value);
    }
  } catch (error) {
    console.error('Error handling change:', error.message);
  }
}

/**
 * Handle incoming message
 */
function handleIncomingMessage(value) {
  try {
    if (!value.messages || value.messages.length === 0) return;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    safeLog('Incoming message received', {
      messageId: message.id,
      type: message.type,
      from: message.from,
    });

    // Extract message content
    let messageContent = '';
    let messageType = message.type;

    switch (message.type) {
      case 'text':
        messageContent = message.text?.body || '';
        break;
      case 'image':
        messageContent = message.image?.caption || '';
        messageType = 'image';
        break;
      case 'document':
        messageContent = message.document?.caption || '';
        messageType = 'document';
        break;
      case 'audio':
        messageContent = '[Audio message]';
        messageType = 'audio';
        break;
      case 'video':
        messageContent = message.video?.caption || '[Video message]';
        messageType = 'video';
        break;
      default:
        messageContent = JSON.stringify(message);
    }

    // Create a local record of the incoming message
    // In a production system, you would:
    // 1. Find or create a conversation
    // 2. Store the encrypted message
    // 3. Notify the user (push notification)

    const incoming = Message.create({
      content: messageContent,
      messageType,
      status: 'delivered',
      whatsappMessageId: message.id,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      // In production, map 'from' phone number to userId
    });

    safeLog('Incoming message stored', { messageId: incoming.id });
  } catch (error) {
    console.error('Error handling incoming message:', error.message);
  }
}

/**
 * Handle message status update
 */
function handleMessageStatus(value) {
  try {
    if (!value.statuses || value.statuses.length === 0) return;

    const status = value.statuses[0];

    safeLog('Message status update', {
      messageId: status.id,
      status: status.status,
      timestamp: status.timestamp,
    });

    // Find the message by WhatsApp ID and update status
    // In production, query your database
    const message = Object.values(Message.db || {})
      .flat()
      .find(m => m.whatsappMessageId === status.id);

    if (message) {
      message.status = status.status; // sent, delivered, read, failed
      safeLog('Message status updated', { messageId: status.id, status: message.status });
    }
  } catch (error) {
    console.error('Error handling message status:', error.message);
  }
}

/**
 * Handle template status update (for template messages)
 */
function handleTemplateStatusUpdate(value) {
  try {
    safeLog('Template status update received', {
      templateId: value.message_template_id,
      status: value.event,
    });

    // Handle template rejection, approval, etc.
    // This is for when you submit message templates for WhatsApp approval
  } catch (error) {
    console.error('Error handling template status:', error.message);
  }
}

module.exports = router;
