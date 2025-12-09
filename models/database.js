/**
 * Database Models (In-Memory for MVP, can be replaced with MongoDB/PostgreSQL)
 */

// In-memory storage
const db = {
  messages: [],
  contacts: [],
  conversations: [],
  users: [],
};

class Message {
  constructor(data) {
    this.id = data.id || `msg_${Date.now()}`;
    this.conversationId = data.conversationId;
    this.senderId = data.senderId;
    this.recipientId = data.recipientId;
    this.content = data.content; // encrypted base64
    this.messageType = data.messageType || 'text';
    this.status = data.status || 'pending'; // pending, sent, delivered, read
    this.whatsappMessageId = data.whatsappMessageId; // ID from WhatsApp API
    this.timestamp = data.timestamp || new Date().toISOString();
    this.encryptionMethod = data.encryptionMethod || 'AES-256-GCM';
    this.publicKeyId = data.publicKeyId; // ID of sender's public key used for encryption
  }

  static create(data) {
    const message = new Message(data);
    db.messages.push(message);
    return message;
  }

  static findById(id) {
    return db.messages.find(m => m.id === id);
  }

  static findByConversation(conversationId, limit = 50) {
    return db.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static updateStatus(messageId, status) {
    const message = this.findById(messageId);
    if (message) {
      message.status = status;
      return message;
    }
    return null;
  }
}

class Contact {
  constructor(data) {
    this.id = data.id || `contact_${Date.now()}`;
    this.userId = data.userId;
    this.name = data.name;
    this.phoneNumber = data.phoneNumber;
    this.publicKey = data.publicKey; // Base64 encoded X25519 public key
    this.publicKeyId = data.publicKeyId; // Fingerprint or ID
    this.verified = data.verified || false;
    this.verifiedAt = data.verifiedAt;
    this.createdAt = new Date().toISOString();
  }

  static create(data) {
    const contact = new Contact(data);
    db.contacts.push(contact);
    return contact;
  }

  static findById(id) {
    return db.contacts.find(c => c.id === id);
  }

  static findByUserId(userId) {
    return db.contacts.filter(c => c.userId === userId);
  }

  static findByPhoneNumber(phoneNumber) {
    return db.contacts.find(c => c.phoneNumber === phoneNumber);
  }

  static updateVerification(contactId, verified) {
    const contact = this.findById(contactId);
    if (contact) {
      contact.verified = verified;
      contact.verifiedAt = new Date().toISOString();
      return contact;
    }
    return null;
  }
}

class Conversation {
  constructor(data) {
    this.id = data.id || `conv_${Date.now()}`;
    this.userId = data.userId;
    this.contactId = data.contactId;
    this.phoneNumber = data.phoneNumber;
    this.displayName = data.displayName;
    this.lastMessage = data.lastMessage;
    this.lastMessageTime = data.lastMessageTime;
    this.unreadCount = data.unreadCount || 0;
    this.createdAt = new Date().toISOString();
  }

  static create(data) {
    const conversation = new Conversation(data);
    db.conversations.push(conversation);
    return conversation;
  }

  static findById(id) {
    return db.conversations.find(c => c.id === id);
  }

  static findByUserId(userId) {
    return db.conversations.filter(c => c.userId === userId);
  }

  static findByUserAndContact(userId, contactId) {
    return db.conversations.find(c => c.userId === userId && c.contactId === contactId);
  }

  static updateLastMessage(conversationId, message, timestamp) {
    const conversation = this.findById(conversationId);
    if (conversation) {
      conversation.lastMessage = message;
      conversation.lastMessageTime = timestamp;
      return conversation;
    }
    return null;
  }
}

class User {
  constructor(data) {
    this.id = data.id || `user_${Date.now()}`;
    this.deviceId = data.deviceId; // Unique device identifier from Flutter app
    this.publicKey = data.publicKey; // User's X25519 public key
    this.publicKeyId = data.publicKeyId; // Fingerprint
    this.signingPublicKey = data.signingPublicKey; // Ed25519 public key
    this.phoneNumber = data.phoneNumber;
    this.displayName = data.displayName;
    this.createdAt = new Date().toISOString();
    this.lastSeen = new Date().toISOString();
  }

  static create(data) {
    const user = new User(data);
    db.users.push(user);
    return user;
  }

  static findByDeviceId(deviceId) {
    return db.users.find(u => u.deviceId === deviceId);
  }

  static findById(id) {
    return db.users.find(u => u.id === id);
  }

  static updateLastSeen(userId) {
    const user = this.findById(userId);
    if (user) {
      user.lastSeen = new Date().toISOString();
      return user;
    }
    return null;
  }
}

module.exports = {
  Message,
  Contact,
  Conversation,
  User,
  db, // For debugging/testing
};
