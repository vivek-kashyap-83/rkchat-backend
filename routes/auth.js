/**
 * Auth Routes
 * POST /api/auth/login
 * POST /api/auth/register  (admin lock removed, max 5 users)
 * GET  /api/auth/me
 * POST /api/auth/update-public-key
 */

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── Generate JWT ─────────────────────────────────────────────────────────────
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── POST /api/auth/login (GOD MODE BYPASS) ──────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Phone login attempt:", username);

    const user = await User.findOne({ username: username.trim().toLowerCase() });

    if (!user) {
      console.log("ERROR: User not found in database");
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    console.log("User found in database:", user.username);

    // Bypass password check, generate token directly
    const token = signToken(user._id);
    
    console.log("Token generated successfully, login approved!");

    return res.status(200).json({
      token: token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        publicKey: user.publicKey,
      }
    });

  } catch (err) {
    console.log("SERVER ERROR DURING LOGIN:", err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── POST /api/auth/register (NO ADMIN SECRET REQUIRED NOW) ──────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    // YAHAN SE ADMIN SECRET WALA TALA HATA DIYA GAYA HAI 🔓

    // Check user limit
    const canCreate = await User.canCreateUser();
    if (!canCreate) {
      return res.status(403).json({
        error: `Maximum user limit (${User.MAX_USERS}) reached. No new users can be created.`,
      });
    }

    if (!username || !password || !displayName) {
      return res.status(400).json({ error: 'Username, password, and display name required.' });
    }

    // Check username uniqueness
    const existing = await User.findOne({ username: username.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    // Assign color index based on current user count
    const userCount = await User.countDocuments();

    const user = await User.create({
      username: username.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
      avatar: { colorIndex: userCount % 6 },
    });

    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        publicKey: user.publicKey,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already taken.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// ─── POST /api/auth/update-public-key ─────────────────────────────────────────
// Called after login to store/update client's RSA public key for E2EE
router.post('/update-public-key', protect, async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'Public key required.' });
    }

    await User.findByIdAndUpdate(req.user._id, { publicKey });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update public key.' });
  }
});

module.exports = router;