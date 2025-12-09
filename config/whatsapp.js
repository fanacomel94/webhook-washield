/**
 * WhatsApp Cloud API Configuration
 */

module.exports = {
  // API Endpoint
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.instagram.com/v18.0',
  
  // Business Credentials
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  
  // Webhook Configuration
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'washield_verify_token',
  appSecret: process.env.APP_SECRET,
  
  // Message Configuration
  messageDefaults: {
    messagingProduct: 'whatsapp',
  },
  
  // Retry Configuration
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
  
  // Rate Limiting
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
};
