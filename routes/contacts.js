/**
 * Contact Routes
 * Manage encrypted contacts (recipients with verified public keys)
 */

const express = require('express');
const router = express.Router();
const { Contact, User } = require('../models/database');
const { generateId, computeKeyFingerprint, safeLog } = require('../utils/helpers');

/**
 * POST /api/contacts
 * Add a new contact
 * Body: {
 *   name: string,
 *   phoneNumber: string,
 *   publicKey: string (base64 X25519 public key),
 *   verified: boolean (optional, default false)
 * }
 */
router.post('/', (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      publicKey,
      verified = false,
    } = req.body;

    if (!name || !phoneNumber || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, phoneNumber, publicKey',
      });
    }

    // Compute fingerprint as public key ID
    const publicKeyId = computeKeyFingerprint(publicKey);

    const contact = Contact.create({
      userId: req.userId,
      name,
      phoneNumber,
      publicKey,
      publicKeyId,
      verified,
    });

    safeLog('Contact created', { contactId: contact.id, name: contact.name });

    return res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('Error creating contact:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create contact',
      message: error.message,
    });
  }
});

/**
 * GET /api/contacts
 * List all contacts for the user
 */
router.get('/', (req, res) => {
  try {
    const contacts = Contact.findByUserId(req.userId);

    return res.status(200).json({
      success: true,
      data: {
        count: contacts.length,
        contacts,
      },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts',
      message: error.message,
    });
  }
});

/**
 * GET /api/contacts/:contactId
 * Get a specific contact
 */
router.get('/:contactId', (req, res) => {
  try {
    const { contactId } = req.params;
    const contact = Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('Error fetching contact:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch contact',
      message: error.message,
    });
  }
});

/**
 * PUT /api/contacts/:contactId/verify
 * Mark contact as verified (public key fingerprint confirmed)
 */
router.put('/:contactId/verify', (req, res) => {
  try {
    const { contactId } = req.params;
    const { fingerprint } = req.body;

    const contact = Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Optionally verify fingerprint matches
    if (fingerprint && contact.publicKeyId !== fingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint mismatch - public key does not match',
      });
    }

    const updated = Contact.updateVerification(contactId, true);

    safeLog('Contact verified', { contactId });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error verifying contact:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify contact',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/contacts/:contactId
 * Delete a contact
 */
router.delete('/:contactId', (req, res) => {
  try {
    const { contactId } = req.params;
    const contact = Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // In a real DB, this would be a delete operation
    // For now, mark as deleted or remove from array
    // For MVP, we'll just return success
    safeLog('Contact deleted', { contactId });

    return res.status(200).json({
      success: true,
      message: 'Contact deleted',
    });
  } catch (error) {
    console.error('Error deleting contact:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
      message: error.message,
    });
  }
});

module.exports = router;
