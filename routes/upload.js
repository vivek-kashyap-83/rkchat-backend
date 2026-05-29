/**
 * Image Upload Route
 * POST /api/upload/image
 * Images are stored server-side; URL is then encrypted client-side before being sent as a message
 */

const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { protect } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Multer Storage Config ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // UUID filename + original extension to prevent path traversal
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// Only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024, // 5MB
  },
});

// ─── POST /api/upload/image ───────────────────────────────────────────────────
router.post('/image', protect, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Return the URL path — client will encrypt this before storing in DB
    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
      imageUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image too large. Maximum size is 5MB.' });
    }
  }
  res.status(400).json({ error: err.message });
});

module.exports = router;
