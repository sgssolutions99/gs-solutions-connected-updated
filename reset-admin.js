
require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const dbPath = path.resolve(
  __dirname,
  process.env.DB_FILE || './data/sgs-solution.sqlite'
);

const db = new Database(dbPath);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('New admin password (minimum 8 characters): ', async (password) => {
  try {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const admin = db.prepare(
      "SELECT id, email FROM users WHERE role='admin' LIMIT 1"
    ).get();

    if (!admin) {
      console.log('No admin account found. Check your .env settings.');
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    db.prepare(
      'UPDATE users SET password_hash=?, active=1 WHERE id=?'
    ).run(hash, admin.id);

    console.log('Admin password reset successfully.');
    console.log('Admin email:', admin.email);
  } catch (error) {
    console.error('Reset failed:', error.message);
  } finally {
    db.close();
    rl.close();
  }
});
