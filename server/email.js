'use strict';
/**
 * Optional email notifications via Resend (https://resend.com), added
 * 2026-08-18 at Tiffany's request so the "follow up N days later" reminder
 * (see server/routes.js's syncDeadlineFollowUpTask) can actually email her
 * on the due date, instead of only showing up as a Task Management item /
 * Dashboard count she has to remember to go look at.
 *
 * DELIBERATELY OPTIONAL, same pattern as server/telegram.js and
 * server/ai.js's GEMINI_API_KEY: this module must NOT throw at require-time
 * if RESEND_API_KEY isn't set yet — the rest of the app has to keep working
 * normally even before email is configured. Only the actual send call fails
 * (caught and logged by the caller, never allowed to block or fail the
 * underlying request it's reporting on).
 *
 * Setup (one-time):
 *   1. Sign up at https://resend.com with the SAME email address you want
 *      reminders sent TO (e.g. weinnnning@gmail.com) — Resend's free tier
 *      lets you send from their shared "onboarding@resend.dev" address
 *      without verifying your own domain, but only to the email you signed
 *      up with. If you later verify your own domain in Resend, set
 *      RESEND_FROM_EMAIL to a real "From" address on that domain and you
 *      can send to anyone.
 *   2. Dashboard -> API Keys -> Create API Key -> copy it.
 *   3. Set that as the RESEND_API_KEY environment variable on wherever this
 *      server runs (Render's Environment tab, or a project-root .env file
 *      for local dev — see server/dotenv-lite.js).
 *   4. Enter the address reminders should go TO in Settings > Submission
 *      Settings > "Reminder Email" in the app itself (stored as
 *      settings.reminderEmail, NOT an environment variable, so it's
 *      changeable without a redeploy).
 *
 * Kept intentionally tiny (no npm dependency) — Resend's API is one plain
 * HTTPS POST, same "use Node's built-in global fetch" approach
 * server/telegram.js and server/ai.js already use.
 */
const RESEND_API_BASE = 'https://api.resend.com/emails';

/**
 * @param {string} to - the recipient email address (Settings > Submission
 *   Settings > Reminder Email).
 * @param {string} subject - plain-text email subject line.
 * @param {string} text - plain-text email body (Resend also accepts `html`,
 *   not used here — every caller so far is a short plain-text reminder).
 * @returns {Promise<object>} Resend's decoded JSON response.
 * @throws if RESEND_API_KEY isn't configured, `to` is missing, or the
 *   Resend API call itself fails/errors — callers are expected to catch
 *   this and treat it as best-effort, never let an email failure block the
 *   underlying save/check it's reporting on.
 */
async function sendReminderEmail(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured on the server.');
  if (!to) throw new Error('No reminder email address configured (Settings > Submission Settings).');
  const from = process.env.RESEND_FROM_EMAIL || 'Legal Genie <onboarding@resend.dev>';
  const res = await fetch(RESEND_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body — data stays {} */ }
  if (!res.ok) {
    throw new Error(`Resend API error: ${data.message || res.statusText || res.status}`);
  }
  return data;
}

module.exports = { sendReminderEmail };
