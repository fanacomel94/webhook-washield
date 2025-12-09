/**
 * Message Routes
 * Endpoints for sending/receiving encrypted messages via WhatsApp
 */

const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { Message, Conversation, Contact } = require('../models/database');
const { generateId, safeLog } = require('../utils/helpers');

/**
 * POST /api/messages/send
 * Send encrypted message via WhatsApp
 * Body: {
 *   recipientPhoneNumber: string,
 *   recipientContactId: string,
 *   encryptedContent: string (base64),
 *   messageType: 'text' | 'image' | 'document',
 *   publicKeyId: string (fingerprint of key used for encryption)
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const {
      recipientPhoneNumber,
      recipientContactId,
      encryptedContent,
      messageType = 'text',
      publicKeyId,
    } = req.body;

    if (!recipientPhoneNumber || !encryptedContent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipientPhoneNumber, encryptedContent',
      });
    }

    // Create local message record
    const messageId = generateId('msg');
    const message = Message.create({
      id: messageId,
      senderId: req.userId,
      recipientId: recipientContactId,
      content: encryptedContent,
      messageType,
      publicKeyId,
      status: 'pending',
    });

    // Send via WhatsApp
    try {
      const result = await whatsappService.sendTextMessage(
        recipientPhoneNumber,
        encryptedContent // Send the encrypted payload
      );

      // Update message with WhatsApp ID and mark as sent
      message.whatsappMessageId = result.messages?.[0]?.id;
      message.status = 'sent';

      safeLog('Message sent via WhatsApp', { messageId, whatsappMessageId: message.whatsappMessageId });

      return res.status(200).json({
        success: true,
        data: {
          messageId: message.id,
          whatsappMessageId: message.whatsappMessageId,
          status: message.status,
          timestamp: message.timestamp,
        },
      });
    } catch (whatsappError) {
      message.status = 'failed';
      return res.status(500).json({
        success: false,
        error: 'Failed to send via WhatsApp',
        details: whatsappError.message,
        messageId: message.id,
      });
    }
  } catch (error) {
    console.error('Error in /send:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/messages/:conversationId
 * Get message history for a conversation
 * Query: { limit: number (default 50) }
 */
router.get('/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50 } = req.query;

    const messages = Message.findByConversation(conversationId, parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        conversationId,
        messageCount: messages.length,
        messages,
      },
    });
  } catch (error) {
    console.error('Error in GET messages:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages',
      message: error.message,
    });
  }
});

/**
 * GET /api/messages/status/:whatsappMessageId
 * Check message delivery status from WhatsApp API
 */
router.get('/status/:whatsappMessageId', async (req, res) => {
  try {
    const { whatsappMessageId } = req.params;

    const status = await whatsappService.getMessageStatus(whatsappMessageId);

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error checking message status:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check message status',
      message: error.message,
    });
  }
});

/**
 * POST /api/messages/:messageId/read
 * Mark message as read
 */
router.post('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Update local status
    message.status = 'read';

    // Mark in WhatsApp if we have the WhatsApp message ID
    if (message.whatsappMessageId) {
      await whatsappService.markMessageAsRead(message.whatsappMessageId);
    }

    return res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Error marking message as read:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark message as read',
      message: error.message,
    });
  }
});

module.exports = router;
