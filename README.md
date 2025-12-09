# WA-Shield Backend

Complete Node.js + Express backend for WA-Shield with WhatsApp Cloud API integration and end-to-end encryption support.

## Features

- ✅ **WhatsApp Cloud API Integration** — Send and receive messages securely
- ✅ **Device Authentication** — Unique device registration and token-based auth
- ✅ **Contact Management** — Store contacts with verified public key fingerprints
- ✅ **Encrypted Messaging** — Support for encrypted message payload handling
- ✅ **Webhook Support** — Receive incoming messages and status updates
- ✅ **Message History** — Store and retrieve encrypted conversation history
- ✅ **Production Ready** — Error handling, retry logic, rate limiting ready

## Quick Start

### 1. Install Dependencies

```bash
cd washield_backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your WhatsApp Cloud API credentials:

```bash
cp .env.example .env
```

Edit `.env` with:
- `WHATSAPP_PHONE_NUMBER_ID` - Your business phone number ID from WhatsApp
- `WHATSAPP_ACCESS_TOKEN` - Your permanent access token
- `APP_SECRET` - Your app secret for webhook signature verification
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` - Your custom webhook verify token

### 3. Start Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will run on `http://localhost:3000` (or port specified in `.env`)

## API Endpoints

### Authentication

**Register Device**
```
POST /api/auth/register
Body: {
  deviceId: string (unique device ID),
  publicKey: string (base64 X25519 public key),
  signingPublicKey: string (base64 Ed25519 public key),
  displayName?: string,
  phoneNumber?: string
}

Response: { userId, deviceId, publicKeyId, token, registeredAt }
```

**Login Device**
```
POST /api/auth/login
Body: {
  deviceId: string
}

Response: { userId, token, lastSeen }
```

### Contacts

**Add Contact**
```
POST /api/contacts
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}
Body: {
  name: string,
  phoneNumber: string,
  publicKey: string (base64),
  verified?: boolean
}

Response: { id, name, phoneNumber, publicKeyId, verified, createdAt }
```

**List Contacts**
```
GET /api/contacts
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}

Response: { count, contacts: [...] }
```

**Verify Contact**
```
PUT /api/contacts/:contactId/verify
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}
Body: {
  fingerprint?: string (optional, for validation)
}

Response: { id, verified, verifiedAt, ... }
```

### Messages

**Send Encrypted Message**
```
POST /api/messages/send
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}
Body: {
  recipientPhoneNumber: string,
  recipientContactId: string,
  encryptedContent: string (base64),
  messageType?: 'text' | 'image' | 'document',
  publicKeyId: string (fingerprint of encryption key)
}

Response: { messageId, whatsappMessageId, status, timestamp }
```

**Get Message History**
```
GET /api/messages/:conversationId?limit=50
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}

Response: { conversationId, messageCount, messages: [...] }
```

**Mark Message as Read**
```
POST /api/messages/:messageId/read
Headers: {
  x-device-id: <deviceId>,
  authorization: Bearer <token>
}

Response: { id, status, timestamp, ... }
```

### Webhook

**Verify Webhook** (called by Meta)
```
GET /webhook?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=xxx

Response: <challenge-value>
```

**Receive Messages** (POST from Meta)
```
POST /webhook
Headers: {
  x-hub-signature-256: sha256=<hmac>
}
Body: {
  object: "whatsapp_business_account",
  entry: [...]
}

Response: { received: true }
```

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# WhatsApp Cloud API
WHATSAPP_API_URL=https://graph.instagram.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Webhook
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
APP_SECRET=your_app_secret

# Optional
FLUTTER_APP_URL=http://localhost:5000
```

## Project Structure

```
washield_backend/
├── config/
│   └── whatsapp.js              # WhatsApp API configuration
├── middleware/
│   └── auth.js                  # Authentication & signature verification
├── models/
│   └── database.js              # Data models (Message, Contact, User, Conversation)
├── routes/
│   ├── auth.js                  # Device registration & login
│   ├── messages.js              # Encrypted messaging endpoints
│   ├── contacts.js              # Contact management
│   └── webhook.js               # WhatsApp webhook handler
├── services/
│   └── whatsappService.js       # WhatsApp Cloud API client
├── utils/
│   └── helpers.js               # Utility functions
├── server.js                    # Express app entry point
├── package.json
├── .env.example
└── README.md
```

## Testing with curl

### Register Device
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-123",
    "publicKey": "base64_x25519_public_key",
    "signingPublicKey": "base64_ed25519_public_key",
    "displayName": "My Device"
  }'
```

### Send Message
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "x-device-id: device-123" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "recipientPhoneNumber": "+91xxxxxxxxxx",
    "recipientContactId": "contact-1",
    "encryptedContent": "base64_encrypted_payload",
    "messageType": "text",
    "publicKeyId": "ABC123DEF456"
  }'
```

### Add Contact
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -H "x-device-id: device-123" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "name": "Alice",
    "phoneNumber": "+91xxxxxxxxxx",
    "publicKey": "base64_x25519_public_key"
  }'
```

## Webhook Setup

1. Get your ngrok URL (for local testing):
   ```bash
   ngrok http 3000
   ```

2. Set up webhook in Meta Developer Dashboard:
   - App → Settings → Webhooks
   - Callback URL: `https://<ngrok-url>/webhook`
   - Verify Token: `<WHATSAPP_WEBHOOK_VERIFY_TOKEN>`
   - Subscribe to: `messages`, `message_status`

3. When Meta verifies, your server responds with the challenge.

4. When messages arrive, the webhook handler processes them.

## Security Considerations

- ✅ Validate webhook signatures using HMAC-SHA256
- ✅ Store access tokens securely (environment variables, secrets manager)
- ✅ Implement rate limiting for production
- ✅ Use HTTPS for all endpoints in production
- ✅ Rotate access tokens and secrets periodically
- ✅ Use database instead of in-memory storage for production
- ✅ Implement proper JWT token expiration
- ✅ Add request validation and sanitization

## Production Deployment

For production deployment:

1. **Database** — Replace in-memory models with MongoDB/PostgreSQL
2. **Authentication** — Implement JWT with expiration
3. **Rate Limiting** — Use `express-rate-limit` middleware
4. **Logging** — Integrate Winston or Bunyan for structured logging
5. **Monitoring** — Add health checks and error tracking (Sentry, DataDog)
6. **HTTPS** — Deploy on a service with SSL/TLS (AWS, Heroku, DigitalOcean)
7. **Secrets** — Use environment secrets manager (AWS Secrets Manager, HashiCorp Vault)

## Support

For issues or questions:
1. Check the logs: `npm run dev` (development mode shows console logs)
2. Verify `.env` file has all required credentials
3. Check WhatsApp Business Account settings for phone number ID and token
4. Ensure webhook URL is publicly accessible (use ngrok for local testing)

## License

MIT
