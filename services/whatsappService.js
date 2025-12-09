/**
 * Enhanced WhatsApp Service
 */

const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

class WhatsAppService {
  constructor() {
    this.config = whatsappConfig;
    this.validateConfig();
  }

  validateConfig() {
    const required = ['phoneNumberId', 'accessToken'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      console.warn(`⚠️  Missing WhatsApp config: ${missing.join(', ')}`);
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(recipientPhoneNumber, messageText, options = {}) {
    try {
      const payload = {
        messaging_product: this.config.messageDefaults.messagingProduct,
        to: this.normalizePhoneNumber(recipientPhoneNumber),
        type: 'text',
        text: {
          body: messageText,
          preview_url: options.preview_url || false,
        },
      };

      return await this.makeRequest('POST', `/${this.config.phoneNumberId}/messages`, payload);
    } catch (error) {
      console.error('Failed to send text message:', error.message);
      throw error;
    }
  }

  /**
   * Send interactive message (buttons, lists, etc.)
   */
  async sendInteractiveMessage(recipientPhoneNumber, interactivePayload) {
    try {
      const payload = {
        messaging_product: this.config.messageDefaults.messagingProduct,
        to: this.normalizePhoneNumber(recipientPhoneNumber),
        type: 'interactive',
        interactive: interactivePayload,
      };

      return await this.makeRequest('POST', `/${this.config.phoneNumberId}/messages`, payload);
    } catch (error) {
      console.error('Failed to send interactive message:', error.message);
      throw error;
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(recipientPhoneNumber, templateName, languageCode = 'en', parameters = []) {
    try {
      const payload = {
        messaging_product: this.config.messageDefaults.messagingProduct,
        to: this.normalizePhoneNumber(recipientPhoneNumber),
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          parameters: parameters.length > 0 ? { body: { parameters } } : undefined,
        },
      };

      return await this.makeRequest('POST', `/${this.config.phoneNumberId}/messages`, payload);
    } catch (error) {
      console.error('Failed to send template message:', error.message);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId) {
    try {
      const payload = {
        messaging_product: this.config.messageDefaults.messagingProduct,
        status: 'read',
        message_id: messageId,
      };

      return await this.makeRequest('POST', `/${this.config.phoneNumberId}/messages`, payload);
    } catch (error) {
      console.error('Failed to mark message as read:', error.message);
      throw error;
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId) {
    try {
      return await this.makeRequest('GET', `/${messageId}`, null, { fields: 'status,timestamp' });
    } catch (error) {
      console.error('Failed to get message status:', error.message);
      throw error;
    }
  }

  /**
   * Get phone number info
   */
  async getPhoneNumberInfo() {
    try {
      return await this.makeRequest('GET', `/${this.config.phoneNumberId}`, null, {
        fields: 'verified_name,display_phone_number,quality_rating',
      });
    } catch (error) {
      console.error('Failed to get phone number info:', error.message);
      throw error;
    }
  }

  /**
   * Upload media file
   */
  async uploadMedia(filePath, mediaType) {
    try {
      // This would require file upload handling - for now, return placeholder
      console.log(`Media upload: ${filePath} (${mediaType})`);
      return {
        media_object_id: `media_${Date.now()}`,
        url: filePath,
      };
    } catch (error) {
      console.error('Failed to upload media:', error.message);
      throw error;
    }
  }

  /**
   * Validate webhook token
   */
  validateWebhookToken(providedToken) {
    return providedToken === this.config.webhookVerifyToken;
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(signature, rawBody) {
    if (!this.config.appSecret) {
      console.warn('⚠️  APP_SECRET not configured - webhook signature verification skipped');
      return true;
    }

    const crypto = require('crypto');
    const expected = 'sha256=' + crypto
      .createHmac('sha256', this.config.appSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Make HTTP request to WhatsApp API
   */
  async makeRequest(method, endpoint, payload = null, params = {}, retryCount = 0) {
    try {
      const url = `${this.config.apiUrl}${endpoint}`;
      
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (payload) {
        config.data = payload;
      }

      if (Object.keys(params).length > 0) {
        config.params = params;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Retry logic
      if (retryCount < this.config.retry.maxAttempts && this.isRetryableError(error)) {
        const delay = this.config.retry.delayMs * Math.pow(this.config.retry.backoffMultiplier, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(method, endpoint, payload, params, retryCount + 1);
      }

      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new Error(`WhatsApp API Error: ${errorMessage}`);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 || status === 429; // Server error or rate limit
  }

  /**
   * Normalize phone number (ensure it starts with +)
   */
  normalizePhoneNumber(phoneNumber) {
    let normalized = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (!normalized.startsWith('91')) {
      normalized = '91' + normalized; // Assume India country code if not present
    }
    return normalized;
  }
}

module.exports = new WhatsAppService();
