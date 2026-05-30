/**
 * Message Routes
 * GET  /api/messages/:userId      - Get conversation history with a user
 * POST /api/messages              - Send a message (REST fallback)
 * PUT  /api/messages/:id/read     - Mark messages as read
 * PUT  /api/messages/:id          - Edit a message (NEW)
 * DELETE /api/messages/:id        - Delete a message (NEW)
 */

const router = require('express').Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── GET /api/messages/:userId (Load Messages) ────────────────────────────────
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Validate target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const conversationId = Message.getConversationId(req.user._id, userId);

    const messages = await Message.find({
      conversationId,
      deletedBy: { $ne: req.user._id }, // PERFECT: ये डिलीट किए हुए मैसेज को रोक लेगा
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'username displayName avatar')
      .lean();

    // Return in chronological order
    res.json({ messages: messages.reverse(), conversationId });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// ─── POST /api/messages (REST fallback if socket unavailable) ─────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, type, encryptedContent, iv, encryptedKey, encryptedKeyForSender } = req.body;

    if (!receiverId || !encryptedContent || !iv || !encryptedKey || !encryptedKeyForSender) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found.' });
    }

    const conversationId = Message.getConversationId(req.user._id, receiverId);

    const message = await Message.create({
      conversationId,
      sender: req.user._id,
      receiver: receiverId,
      type: type || 'text',
      encryptedContent,
      iv,
      encryptedKey,
      encryptedKeyForSender,
    });

    await message.populate('sender', 'username displayName avatar');

    res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ─── PUT /api/messages/:conversationId/read ───────────────────────────────────
router.put('/:conversationId/read', protect, async (req, res) => {
  try {
    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        receiver: req.user._id,
        status: { $ne: 'read' },
      },
      { status: 'read' }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read.' });
  }
});

// 🌟 NEW: PUT /api/messages/:id (मैसेज एडिट करने के लिए) ────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { encryptedContent } = req.body;

    const message = await Message.findOneAndUpdate(
      { _id: id, sender: req.user._id }, // सिर्फ भेजने वाला ही एडिट कर सकता है
      { encryptedContent, isEdited: true },
      { new: true }
    );

    if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// 🌟 NEW: DELETE /api/messages/:id (मैसेज डिलीट करने के लिए) ──────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.query; // 'me' या 'everyone'
    const currentUserId = req.user._id;

    if (mode === 'everyone') {
      // सबके लिए डिलीट: Flag true कर दो
      await Message.findOneAndUpdate(
        { _id: id, sender: currentUserId }, // सिर्फ भेजने वाला ही सबके लिए डिलीट कर सकता है
        { isDeletedForEveryone: true }
      );
    } else {
      // सिर्फ मेरे लिए डिलीट: deletedBy array में मेरी ID डाल दो
      await Message.findByIdAndUpdate(id, { 
        $addToSet: { deletedBy: currentUserId } 
      });
    }

    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;