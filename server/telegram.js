'use strict';
/**
 * Optional Telegram Bot notifications — added 2026-08-12 at Tiffany's
 * request. When a PAGCOR case's Stage changes, notifyCaseStageChange() in
 * routes.js calls sendTelegramMessage() here to post an update directly
 * into that case's Provider's own Telegram group, instead of Tiffany having
 * to type the same update out by hand in every vendor group every time a
 * status changes.
 *
 * DELIBERATELY OPTIONAL, same pattern as server/ai.js's GEMINI_API_KEY:
 * this module must NOT throw at require-time if TELEGRAM_BOT_TOKEN isn't
 * set yet — the rest of the app has to keep working normally even before
 * Telegram is configured. Only the actual send call fails (caught and
 * logged by the caller in routes.js, never allowed to block or fail the
 * underlying case-stage-change save).
 *
 * Setup (one-time):
 *   1. Message @BotFather on Telegram, send /newbot, follow the prompts —
 *      free, takes about a minute, gives you back a token that looks like
 *      123456789:AAExampleTokenTextGoesHere.
 *   2. Set that token as the TELEGRAM_BOT_TOKEN environment variable on
 *      wherever this server runs (locally, or in Vercel's Project Settings
 *      -> Environment Variables — same place GEMINI_API_KEY lives).
 *   3. Add the bot to each Provider's Telegram group as a member (it needs
 *      permission to send messages — if the group has "who can send
 *      messages" restricted to admins, make the bot an admin too).
 *   4. Get that group's chat ID: the simplest way is to send any message in
 *      the group, then visit
 *      https://api.telegram.org/bot<token>/getUpdates in a browser and
 *      look for that group's "chat":{"id": ...} — group IDs are negative
 *      numbers (e.g. -1001234567890).
 *   5. Enter that chat ID against the Provider's name in Settings >
 *      Telegram Notifications.
 *
 * Kept intentionally tiny (no npm dependency) — Telegram's Bot API is one
 * plain HTTPS POST, same "use Node's built-in global fetch" approach
 * server/ai.js already uses for Gemini.
 *
 * Also used since 2026-08-19 by two more features, reusing this same bot
 * (one Telegram bot can belong to any number of chats — no need for a
 * separate bot per feature):
 *   - Personal follow-up reminders (server/routes.js's
 *     checkAndSendFollowUpReminders) — sent to a User's own private Chat ID
 *     (Settings > Users), gotten the same getUpdates way as step 4 above,
 *     except a private chat's ID is a plain positive number.
 *   - The group Q&A bot (server/routes.js's POST /api/telegram/webhook) —
 *     every message posted in a Provider's group is run past
 *     server/ai.js's answerGroupQuestion() to see if it's a real question
 *     about that Provider's cases OR a general PAGCOR/regulatory question
 *     answerable from an 'Active' (company-approved) Knowledge Base FAQ
 *     entry (see Knowledge Base > FAQ in the app; added 2026-08-25, at
 *     Tiffany's request) — never both from general AI knowledge, only from
 *     that Provider's own case data or an approved FAQ entry, so nothing
 *     unreviewed ever gets quoted back to a Provider. setWebhook() below is
 *     how this app tells Telegram where to deliver those incoming messages.
 *     One-time setup:
 *     call POST /api/telegram/register-webhook (as an Admin, from a logged-
 *     in browser tab — see that route in routes.js) once, after
 *     TELEGRAM_BOT_TOKEN is configured and the app is deployed somewhere
 *     with a real public HTTPS URL (a local `node server.js` cannot receive
 *     Telegram's webhook calls — this only works on the deployed Vercel
 *     site). Optionally also set TELEGRAM_WEBHOOK_SECRET first (any random
 *     string) so the webhook route can verify incoming calls really came
 *     from Telegram.
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * @param {string} chatId - a Provider's Telegram group chat ID (see setup
 *   notes above), as configured in Settings > Telegram Notifications — or,
 *   since 2026-08-19, a User's own private Chat ID (Settings > Users) for
 *   the personal follow-up reminders in routes.js's
 *   checkAndSendFollowUpReminders.
 * @param {string} text - plain-text message body to post into that group.
 *   Sent with NO parse_mode (Telegram's default, literal plain text) —
 *   deliberately not 'HTML' or 'Markdown': callers never actually use any
 *   formatting, and either parse mode requires escaping characters that
 *   appear all the time in ordinary case data (a game title with an "&",
 *   "<", "*", "_", etc.) or Telegram rejects the whole message outright.
 *   That used to be a real bug here — parse_mode: 'HTML' was set with
 *   unescaped text, so a game titled e.g. "Fish & Dragon" would silently
 *   and permanently fail to notify anyone.
 * @param {{replyToMessageId?: number|string}} [opts] - added 2026-08-19 for
 *   the group Q&A bot (see server/routes.js's telegram webhook handler):
 *   when set, the message is sent as an in-Telegram reply to that specific
 *   message instead of a bare new message, so it's visually clear in a busy
 *   group which question the bot is answering.
 * @returns {Promise<object>} the Telegram API's decoded JSON response.
 * @throws if TELEGRAM_BOT_TOKEN isn't configured, chatId is missing, or the
 *   Telegram API call itself fails/errors — callers are expected to catch
 *   this and treat it as best-effort (see notifyCaseStageChange in
 *   routes.js), never let a Telegram failure block the actual save/request
 *   it's reporting on.
 */
async function sendTelegramMessage(chatId, text, opts) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server.');
  if (!chatId) throw new Error('No Telegram chat ID configured for this Provider.');
  const body = { chat_id: chatId, text };
  if (opts && opts.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;
  const res = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body — data stays {} */ }
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram API error: ${data.description || res.statusText || res.status}`);
  }
  return data;
}

/**
 * Registers (or clears) this bot's webhook URL with Telegram — a one-time
 * admin action, called from the new POST /api/telegram/register-webhook
 * route in server/routes.js rather than requiring Tiffany to hand-craft a
 * curl command with her own bot token in it. Idempotent: calling this again
 * with the same URL is a harmless no-op on Telegram's side.
 * @param {string} url - the public HTTPS URL Telegram should POST updates
 *   to (this app's POST /api/telegram/webhook route) — must be a real
 *   internet-reachable HTTPS URL, e.g. the production Vercel domain; a
 *   localhost URL will be rejected by Telegram.
 * @param {string} [secretToken] - optional shared secret; when set, Telegram
 *   includes it as the X-Telegram-Bot-Api-Secret-Token header on every
 *   webhook call, and the webhook route checks it matches
 *   TELEGRAM_WEBHOOK_SECRET before trusting the request actually came from
 *   Telegram (rather than anyone who finds the URL).
 * @returns {Promise<object>} Telegram's decoded JSON response.
 */
async function setWebhook(url, secretToken) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server.');
  if (!url) throw new Error('No webhook URL provided.');
  const body = { url };
  if (secretToken) body.secret_token = secretToken;
  const res = await fetch(`${TELEGRAM_API_BASE}${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body — data stays {} */ }
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram API error: ${data.description || res.statusText || res.status}`);
  }
  return data;
}

module.exports = { sendTelegramMessage, setWebhook };
