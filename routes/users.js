/**
 * User Routes
 * GET /api/users        - List all users (except self)
 * GET /api/users/:id    - Get user by ID (for public key)
 */

const router = require('express').Router();
const User = require('../models/User');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

// ─── GET /api/users ───────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      isActive: true,
    }).select('username displayName avatar publicKey lastSeen');

    // For each user, get unread message count
    const usersWithUnread = await Promise.all(
      users.map(async (user) => {
        const conversationId = Message.getConversationId(req.user._id, user._id);
        const unreadCount = await Message.countDocuments({
          conversationId,
          receiver: req.user._id,
          status: { $ne: 'read' },
        });

        // Get last message preview (encrypted — client decrypts)
        const lastMessage = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .select('encryptedContent iv encryptedKey encryptedKeyForSender type sender createdAt status')
          .lean();

        return {
          ...user.toJSON(),
          unreadCount,
          lastMessage: lastMessage || null,
        };
      })
    );

    res.json({ users: usersWithUnread });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      'username displayName avatar publicKey lastSeen'
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

module.exports = router;
