/**
 * Seed Script — Create initial users for RK Chat
 * Usage: ADMIN_SECRET=your_secret node utils/seedUsers.js
 * 
 * Edit the USERS array below with your desired credentials
 * Max 5 users total
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

// ─── EDIT THESE USERS ─────────────────────────────────────────────────────────
const USERS = [
  { username: 'alice', password: 'ChangeMe123!', displayName: 'Alice' },
  { username: 'bob',   password: 'ChangeMe456!', displayName: 'Bob'   },
  // Add up to 3 more users (max 5 total)
];
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rkchat');
    console.log('Connected to MongoDB');

    for (const userData of USERS) {
      const existing = await User.findOne({ username: userData.username });
      if (existing) {
        console.log(`⏭  User "${userData.username}" already exists, skipping`);
        continue;
      }

      const canCreate = await User.canCreateUser();
      if (!canCreate) {
        console.log(`❌ Max users (${User.MAX_USERS}) reached. Cannot create more.`);
        break;
      }

      const count = await User.countDocuments();
      await User.create({
        ...userData,
        avatar: { colorIndex: count % 6 },
      });
      console.log(`✅ Created user: ${userData.username} (${userData.displayName})`);
    }

    const total = await User.countDocuments();
    console.log(`\n📊 Total users: ${total}/${User.MAX_USERS}`);
    console.log('\n⚠️  IMPORTANT: Change default passwords immediately!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
