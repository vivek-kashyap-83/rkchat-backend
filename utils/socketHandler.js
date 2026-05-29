/**
 * Socket.IO Handler
 * Manages real-time message delivery
 * Server handles routing only — never decrypts message content
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

// Map: userId -> socketId (for targeting specific users)
const onlineUsers = new Map();

const initializeSocket = (io) => {
  // ─── Authentication middleware for socket ──────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('Invalid user'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 User connected: ${socket.user.username} (${socket.id})`);

    // Register user as online
    onlineUsers.set(userId, socket.id);

    // Join personal room for direct messages
    socket.join(`user_${userId}`);

    // Notify others that this user is online
    socket.broadcast.emit('user_online', { userId });

    // Send current online users to this socket
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    // ─── Handle: send_message ────────────────────────────────────────────────
    socket.on('send_message', async (data, callback) => {
      try {
        const {
          receiverId,
          type,
          encryptedContent,
          iv,
          encryptedKey,
          encryptedKeyForSender,
          tempId, // client-side temp ID for optimistic UI
        } = data;

        if (!receiverId || !encryptedContent || !iv || !encryptedKey || !encryptedKeyForSender) {
          return callback?.({ error: 'Missing required fields' });
        }

        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) return callback?.({ error: 'Receiver not found' });

        const conversationId = Message.getConversationId(userId, receiverId);

        // Save encrypted message to DB
        const message = await Message.create({
          conversationId,
          sender: socket.user._id,
          receiver: receiverId,
          type: type || 'text',
          encryptedContent,
          iv,
          encryptedKey,
          encryptedKeyForSender,
          status: 'sent',
        });

        await message.populate('sender', 'username displayName avatar');

        const messageData = {
          ...message.toObject(),
          tempId, // echo back so sender can replace optimistic message
        };

        // Deliver to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId.toString());
        if (receiverSocketId) {
          io.to(`user_${receiverId}`).emit('new_message', messageData);
          // Mark as delivered
          await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
          messageData.status = 'delivered';
        }

        // Confirm to sender
        callback?.({ success: true, message: messageData });
      } catch (err) {
        console.error('Socket send_message error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // ─── Handle: mark_read ───────────────────────────────────────────────────
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversationId, receiver: socket.user._id, status: { $ne: 'read' } },
          { status: 'read' }
        );
        // Notify the other user their messages were read
        const [id1, id2] = conversationId.split('_');
        const otherUserId = id1 === userId ? id2 : id1;
        io.to(`user_${otherUserId}`).emit('messages_read', { conversationId, readBy: userId });
      } catch (err) {
        console.error('Mark read error:', err);
      }
    });

    // ─── Handle: typing ──────────────────────────────────────────────────────
    socket.on('typing', ({ receiverId, isTyping }) => {
      io.to(`user_${receiverId}`).emit('user_typing', {
        userId,
        isTyping,
      });
    });

    // ─── Handle: disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.username}`);
      onlineUsers.delete(userId);

      // Update last seen
      await User.findByIdAndUpdate(userId, { lastSeen: Date.now() });

      // Notify others
      socket.broadcast.emit('user_offline', { userId });
    });
  });
};

module.exports = { initializeSocket, onlineUsers };
