# WA-Shield Backend Integration Guide for Flutter

This guide explains how to integrate your Flutter app with the WA-Shield backend.

## Overview

The backend provides these main functions:

1. **Device Registration** — Register your Flutter app with a unique device ID
2. **Contact Management** — Store and verify contacts with public keys
3. **Encrypted Messaging** — Send encrypted messages via WhatsApp
4. **Message History** — Retrieve encrypted conversation history
5. **Webhook Events** — Receive incoming messages and status updates

## Setup Steps

### 1. Backend Configuration

Ensure your backend is running and `.env` is configured with WhatsApp credentials:

```bash
cd washield_backend
npm install
cp .env.example .env
# Edit .env with your WhatsApp credentials
npm start
```

Check that the server is running:
```bash
curl http://localhost:3000/health
# Response: { "status": "OK", ... }
```

### 2. Flutter App Integration

In your Flutter app, create a backend service to handle API calls:

```dart
// lib/services/backend_service.dart

import 'package:http/http.dart' as http;
import 'dart:convert';

class BackendService {
  static const String baseUrl = 'http://localhost:3000/api';
  static late String _token;
  static late String _deviceId;

  /// Initialize with device ID and register/login
  static Future<void> initialize(String deviceId) async {
    _deviceId = deviceId;

    // Try to login first
    try {
      _token = await login(deviceId);
    } catch (e) {
      // If login fails, register new device
      _token = await register(deviceId);
    }
  }

  /// Register a new device
  static Future<String> register(
    String deviceId,
    String publicKey,
    String signingPublicKey, {
    String displayName = 'Flutter App',
    String? phoneNumber,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'deviceId': deviceId,
        'publicKey': publicKey,
        'signingPublicKey': signingPublicKey,
        'displayName': displayName,
        'phoneNumber': phoneNumber,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['data']['token'];
    } else {
      throw Exception('Registration failed: ${response.body}');
    }
  }

  /// Login an existing device
  static Future<String> login(String deviceId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'deviceId': deviceId}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['data']['token'];
    } else {
      throw Exception('Login failed: ${response.body}');
    }
  }

  /// Send encrypted message
  static Future<Map<String, dynamic>> sendMessage(
    String recipientPhoneNumber,
    String recipientContactId,
    String encryptedContent,
    String publicKeyId, {
    String messageType = 'text',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/messages/send'),
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
      body: jsonEncode({
        'recipientPhoneNumber': recipientPhoneNumber,
        'recipientContactId': recipientContactId,
        'encryptedContent': encryptedContent,
        'messageType': messageType,
        'publicKeyId': publicKeyId,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to send message: ${response.body}');
    }
  }

  /// Add a contact
  static Future<Map<String, dynamic>> addContact(
    String name,
    String phoneNumber,
    String publicKey, {
    bool verified = false,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/contacts'),
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
      body: jsonEncode({
        'name': name,
        'phoneNumber': phoneNumber,
        'publicKey': publicKey,
        'verified': verified,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to add contact: ${response.body}');
    }
  }

  /// Get all contacts
  static Future<List<Map<String, dynamic>>> getContacts() async {
    final response = await http.get(
      Uri.parse('$baseUrl/contacts'),
      headers: {
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return List<Map<String, dynamic>>.from(data['data']['contacts']);
    } else {
      throw Exception('Failed to fetch contacts: ${response.body}');
    }
  }

  /// Get message history
  static Future<List<Map<String, dynamic>>> getMessages(
    String conversationId, {
    int limit = 50,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/messages/$conversationId?limit=$limit'),
      headers: {
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return List<Map<String, dynamic>>.from(data['data']['messages']);
    } else {
      throw Exception('Failed to fetch messages: ${response.body}');
    }
  }

  /// Mark message as read
  static Future<void> markMessageAsRead(String messageId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/messages/$messageId/read'),
      headers: {
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark message as read: ${response.body}');
    }
  }

  /// Verify a contact (confirm public key fingerprint)
  static Future<void> verifyContact(String contactId, {String? fingerprint}) async {
    final response = await http.put(
      Uri.parse('$baseUrl/contacts/$contactId/verify'),
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': _deviceId,
        'Authorization': 'Bearer $_token',
      },
      body: fingerprint != null ? jsonEncode({'fingerprint': fingerprint}) : null,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to verify contact: ${response.body}');
    }
  }
}
```

### 3. Initialize in Main App

Add this to your `lib/main.dart`:

```dart
import 'package:uuid/uuid.dart';
import 'services/backend_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Generate unique device ID (or get from secure storage)
  const uuid = Uuid();
  String deviceId = uuid.v4(); // In production, save this to secure storage
  
  // Initialize backend service
  try {
    await BackendService.initialize(deviceId);
  } catch (e) {
    print('Failed to initialize backend: $e');
  }

  runApp(const MyApp());
}
```

### 4. Send Message Example

In your encryption page:

```dart
import 'services/backend_service.dart';

// When user wants to send an encrypted message
Future<void> sendEncryptedMessage(
  String recipientPhoneNumber,
  String contactId,
  String messageText,
) async {
  try {
    // Get recipient's public key from contacts
    final contacts = await BackendService.getContacts();
    final contact = contacts.firstWhere((c) => c['id'] == contactId);
    final recipientPublicKey = contact['publicKey'];

    // Encrypt the message (using your CryptoService)
    final aesKey = await CryptoService.deriveAesKey(recipientPublicKey);
    final encryptedContent = await CryptoService.encrypt(messageText, aesKey);

    // Send via backend
    final result = await BackendService.sendMessage(
      recipientPhoneNumber,
      contactId,
      encryptedContent,
      contact['publicKeyId'],
    );

    print('Message sent: ${result['messageId']}');
  } catch (e) {
    print('Error sending message: $e');
  }
}
```

### 5. Add Contact with Public Key

```dart
// When scanning QR code with contact's public key
Future<void> addContactFromQR(Map<String, dynamic> qrData) async {
  try {
    final contact = await BackendService.addContact(
      qrData['name'] ?? 'New Contact',
      qrData['phoneNumber'],
      qrData['publicKey'],
    );

    print('Contact added: ${contact['id']}');

    // Optionally verify the contact by comparing fingerprint
    if (qrData['fingerprint'] != null) {
      await BackendService.verifyContact(
        contact['id'],
        fingerprint: qrData['fingerprint'],
      );
    }
  } catch (e) {
    print('Error adding contact: $e');
  }
}
```

## API Authentication

All endpoints (except `/webhook` and `/health`) require these headers:

```
x-device-id: <your-device-id>
Authorization: Bearer <your-token>
```

The token is obtained during registration or login.

## Message Flow

```
Flutter App → Backend → WhatsApp Cloud API → Recipient
     ↓
   Encrypt message with recipient's public key
   Send encrypted payload via backend
   Backend forwards to WhatsApp API
   Message delivered to recipient's WhatsApp
   
Recipient → WhatsApp Cloud API → Backend Webhook → Store in DB
   ↓
   Frontend polls for new messages
   Decrypts using their private key
```

## Testing

### Test Backend

```bash
# Check health
curl http://localhost:3000/health

# Register device
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device-1",
    "publicKey": "base64_key_1",
    "signingPublicKey": "base64_key_2"
  }'
```

### Test from Flutter

```dart
void testBackend() async {
  try {
    await BackendService.initialize('test-device-123');
    final contacts = await BackendService.getContacts();
    print('Contacts: $contacts');
  } catch (e) {
    print('Test failed: $e');
  }
}
```

## Production Checklist

- [ ] Update backend URL from `localhost:3000` to production domain
- [ ] Use HTTPS (not HTTP)
- [ ] Store device ID securely (use `flutter_secure_storage`)
- [ ] Implement token refresh mechanism
- [ ] Add error handling and retry logic
- [ ] Implement proper logging (without sensitive data)
- [ ] Test on real device with actual WhatsApp numbers
- [ ] Set up proper error tracking (Sentry, Firebase Crashlytics)
- [ ] Implement rate limiting on client side
- [ ] Cache contacts and messages locally

## Troubleshooting

**Connection refused**
- Ensure backend is running: `npm start` in `washield_backend/`
- Check backend URL in your Flutter app

**Authentication failed**
- Verify device ID is unique
- Check that `.env` has correct WhatsApp credentials
- Ensure backend is not restarted (which clears in-memory tokens)

**Message send failed**
- Verify recipient phone number format (+91...)
- Check that recipient is a valid WhatsApp contact
- Ensure your access token is valid and not expired

**Webhook not receiving messages**
- Verify webhook URL is publicly accessible
- Check webhook verify token matches `.env`
- Ensure webhook signature verification is passing (if enabled)

## Next Steps

1. Implement proper database (MongoDB/PostgreSQL) to persist messages and contacts
2. Add JWT tokens with expiration for better security
3. Implement message encryption on backend side (optional, depends on threat model)
4. Add push notifications for incoming messages
5. Set up proper logging and monitoring
6. Deploy backend to production (Heroku, AWS, DigitalOcean, etc.)
