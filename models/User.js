/**
 * User Model
 * Fixed max 5 users — no public registration
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MAX_USERS = 5;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never return password in queries
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    avatar: {
      // Single letter avatar color index (0-5) for UI color coding
      colorIndex: { type: Number, default: 0 },
    },
    // Public key for E2EE key exchange (client-generated, stored server-side)
    publicKey: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ─── Hash password before save ────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Compare password method ──────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Static: enforce user limit ───────────────────────────────────────────────
userSchema.statics.MAX_USERS = MAX_USERS;

userSchema.statics.canCreateUser = async function () {
  const count = await this.countDocuments();
  return count < MAX_USERS;
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
