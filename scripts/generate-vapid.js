#!/usr/bin/env node
// Run: node scripts/generate-vapid.js
// Then copy the output into your .env.local

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID Keys generated!\n');
console.log('Copy these into your .env.local:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('\nKeep the PRIVATE key secret. Never commit it to git.\n');
