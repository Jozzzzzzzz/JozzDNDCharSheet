#!/usr/bin/env node
// tools/seed-campaign.js
// One-time script to create the Neuertham campaign in Firestore.
// Run ONCE from a browser console or via the admin portal instead —
// this script is a reference for what gets written.
//
// To use: paste the body of createNeuertham() into your browser console
// while signed in as the owner on the live site.

// SHA-256 in browser:
async function sha256Hex(text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function createNeuertham() {
  const password = 'Neuertham12345';
  const passwordHash = await sha256Hex(password);
  const id = 'camp_neuertham';

  await window.db.collection('campaigns').doc(id).set({
    id,
    name: 'Neuertham',
    setting: 'Homebrew',
    dmEmails: [], // add DM email here once known
    passwordHash,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  console.log('Neuertham campaign created. Password hash:', passwordHash);
}

createNeuertham();
