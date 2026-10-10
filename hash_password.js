#!/usr/bin/env node
/**
 * Duet Karaoke Maker - Password Hasher Utility
 * 
 * Generates a cryptographically salted PBKDF2 hash (SHA-512 with 100,000 iterations).
 * 
 * Usage:
 *   node hash_password.js "your-strong-password"
 */

const crypto = require('crypto');

function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    console.error('Error: Please provide a password string.');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const inputPassword = process.argv[2];
if (!inputPassword) {
  console.log('Usage: node hash_password.js "<password>"');
  console.log('Example: node hash_password.js "SuperSecret123!"');
  process.exit(0);
}

const hashed = hashPassword(inputPassword);
console.log('\n======================================================');
console.log('  🔐 Duet Karaoke Maker - Password Hash Generated     ');
console.log('======================================================');
console.log('Hashed Value (Salt:Hash):');
console.log(hashed);
console.log('\nSet this in your .env file:');
console.log(`ADMIN_PASSWORD_HASH=${hashed}`);
console.log('======================================================\n');
