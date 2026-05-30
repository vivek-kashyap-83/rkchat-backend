/**
 * Message Model
 * Stores ONLY encrypted content — server never sees plaintext
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Conversation participants (sorted for consistent lookup)
    conversationId: {
      type: String,
      required: true,
      index: true,
      // Format: "userId1_userId2" (smaller ID first)
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Message type: text or image
    type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
    },
    /**
     * E2EE: encrypted content
     * For text: AES-GCM encrypted ciphertext (base64)
     * For image: AES-GCM encrypted image URL/path (base64)
     * The server stores ONLY this — never plaintext
     */
    encryptedContent: {
      type: String,
      required: true,
    },
    /**
     * AES-GCM IV (initialization vector) — unique per message
     * Required for decryption on client side (base64 encoded)
     */
    iv: {
      type: String,
      required: true,
    },
    /**
     * Encrypted AES key — encrypted with receiver's public key (RSA-OAEP)
     * So only the receiver can decrypt the AES key, then decrypt the message
     */
    encryptedKey: {
      type: String,
      required: true,
    },
    /**
     * Encrypted AES key for sender (so sender can also read their own messages)
     */
    encryptedKeyForSender: {
      type: String,
      required: true,
    },
    // Delivery status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    
    // 🌟 NEW: Check if message is edited
    isEdited: {
      type: Boolean,
      default: false,
    },
    
    // 🌟 NEW: Check if message is deleted for everyone
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    // Soft delete (Delete for me)
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// ─── Index for fast conversation lookup ───────────────────────────────────────
messageSchema.index({ conversationId: 1, createdAt: -1 });

// ─── Static: generate consistent conversationId ───────────────────────────────
messageSchema.statics.getConversationId = function (userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `${ids[0]}_${ids[1]}`;
};

module.exports = mongoose.model('Message', messageSchema);