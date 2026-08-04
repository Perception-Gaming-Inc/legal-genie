'use strict';
/**
 * Supabase Storage-backed file handling, for the Vercel + Supabase
 * deployment path. Replaces the old local-disk uploads/ folder — Vercel's
 * serverless functions don't have persistent local storage, so uploaded
 * documents and contract-version files have to live somewhere external.
 *
 * Create the bucket once in the Supabase dashboard (Storage -> New bucket)
 * before first deploy — see the Go-Live Guide for the exact name to use
 * (must match SUPABASE_STORAGE_BUCKET below, or the env var you set).
 */
const crypto = require('crypto');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'legal-genie-files';

// See server/store.js's comment on this same pattern — NODE_PATH can't be
// relied on to shadow the real (npm-installed) @supabase/supabase-js, so the
// local-mock package is required by its exact path instead, only when the
// local-mock sentinel SUPABASE_URL is set.
const { createClient } = SUPABASE_URL === 'http://local-mock'
  ? require(path.join(__dirname, '..', 'local-mock', 'node_modules', '@supabase', 'supabase-js'))
  : require('@supabase/supabase-js');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
    'Set them in your Vercel project settings — see the Go-Live Guide.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Decodes a base64 (optionally data-URI-prefixed) file upload and stores it
// in Supabase Storage under a random, collision-proof name. Returns that
// stored name (save it on the record — same role `filePath` played before).
async function saveBase64File(fileName, base64Content) {
  if (!base64Content) return null;
  const safeName = `${crypto.randomUUID()}-${(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const base64Data = base64Content.includes(',') ? base64Content.split(',').pop() : base64Content;
  const buffer = Buffer.from(base64Data, 'base64');
  const { error } = await supabase.storage.from(BUCKET).upload(safeName, buffer, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(`storage.saveBase64File: ${error.message}`);
  return safeName;
}

// Returns a Buffer of the stored file's contents, or null if it doesn't
// exist / can't be read (caller should treat that as a 404).
async function readFile(storedName) {
  if (!storedName) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(storedName);
  if (error) return null;
  return Buffer.from(await data.arrayBuffer());
}

module.exports = { saveBase64File, readFile };
