'use strict';
const crypto = require('crypto');
const store = require('./store');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// store.js is async on this deployment path (Supabase, over the network),
// so everything in this file that touches the store is async too.
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  // prune expired sessions globally (explicit store.remove so it actually
  // deletes the row — store.all() returns a fresh snapshot, not a live
  // mutable reference into the datastore)
  for (const s of await store.all('sessions')) {
    if (s.expiresAt < Date.now()) await store.remove('sessions', s.id);
  }
  await store.insert('sessions', { token, userId, expiresAt });
  return token;
}

async function getSession(token) {
  if (!token) return null;
  const session = (await store.all('sessions')).find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

async function destroySession(token) {
  const session = (await store.all('sessions')).find((s) => s.token === token);
  if (session) await store.remove('sessions', session.id);
}

function getTokenFromReq(req) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Account lockout after repeated failed logins -----------------------------
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLocked(user) {
  return !!(user.lockedUntil && user.lockedUntil > Date.now());
}

async function recordFailedLogin(user) {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const patch = { failedLoginAttempts: attempts };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    patch.lockedUntil = Date.now() + LOCKOUT_MS;
    patch.failedLoginAttempts = 0; // next window starts fresh once locked
  }
  await store.update('users', user.id, patch);
}

async function resetFailedLogins(user) {
  if (user.failedLoginAttempts || user.lockedUntil) {
    await store.update('users', user.id, { failedLoginAttempts: 0, lockedUntil: null });
  }
}

// Permission model: role -> module -> {view, create, edit, delete, approve}
const MODULES = [
  'dashboard', 'cases', 'documents',
  'tasks', 'notifications', 'knowledgeBase', 'settings',
];

async function can(user, moduleName, action) {
  if (!user) return false;
  const role = await store.find('roles', user.roleId);
  if (!role) return false;
  if (role.name === 'Admin') return true; // Admin: full access always
  const perm = (role.permissions || {})[moduleName];
  if (!perm) return false;
  return !!perm[action];
}

module.exports = {
  hashPassword, verifyPassword, createSession, getSession, destroySession,
  getTokenFromReq, can, MODULES, isLocked, recordFailedLogin, resetFailedLogins,
};
