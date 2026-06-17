#!/usr/bin/env node
// Onboard a new TML doctor: prompts for username + password, prints the JSON
// line to add to assets/users.json. Also offers to do the edit in-place.
//
// Run:  node scripts/add-user.js
// Then paste the printed entry into assets/users.json (or accept the in-place edit).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SALT = 'TML-2026-report-generator';
const USERS_PATH = path.join(__dirname, '..', 'assets', 'users.json');

function hash(username, password) {
  return crypto.createHash('sha256').update(`${username}:${password}:${SALT}`).digest('hex');
}

function prompt(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!silent) {
      rl.question(question, (ans) => { rl.close(); resolve(ans); });
      return;
    }
    // Silent input for passwords
    process.stdout.write(question);
    const onData = (ch) => {
      ch = ch.toString();
      if (['\n', '\r', ''].includes(ch)) {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false); process.stdin.pause();
        process.stdout.write('\n');
        rl.close();
        resolve(buf);
      } else if (ch === '') { process.exit(); }
      else if (ch === '') { buf = buf.slice(0, -1); }
      else { buf += ch; }
    };
    let buf = '';
    process.stdin.setRawMode(true); process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

(async () => {
  const username = (await prompt('Username (lowercase, e.g. dr.rakshith): ')).trim().toLowerCase();
  if (!username || !/^[a-z0-9._-]+$/.test(username)) {
    console.error('Username must be lowercase letters, digits, or . _ -');
    process.exit(1);
  }
  const password = await prompt('Password (min 8 chars): ', { silent: true });
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  const h = hash(username, password);
  const line = `  "${username}": "${h}"`;
  console.log('\n--- Entry for assets/users.json ---');
  console.log(line + ',');
  console.log('--- End ---\n');

  // Offer in-place edit
  const apply = (await prompt('Add this entry to assets/users.json now? [y/N]: ')).trim().toLowerCase();
  if (apply === 'y' || apply === 'yes') {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
    if (users[username]) {
      const ok = (await prompt(`User "${username}" exists. Overwrite? [y/N]: `)).trim().toLowerCase();
      if (ok !== 'y' && ok !== 'yes') { console.log('Cancelled.'); process.exit(0); }
    }
    users[username] = h;
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2) + '\n');
    console.log(`Updated ${USERS_PATH}`);
  } else {
    console.log('No file changes. Paste the entry into assets/users.json yourself.');
  }
})();
