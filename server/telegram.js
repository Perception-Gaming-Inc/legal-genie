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
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * @param {string} chatId - a Provider's Telegram group chat ID (see setup
 *   notes above), as configured in Settings > Telegram Notifications.
 * @param {string} text - plain-text message body to post into that group.
 *   Sent with NO parse_mode (Telegram's default, literal plain text) —
 *   deliberately not 'HTML' or 'Markdown': the caller (notifyProviderTelegram
 *   in routes.js) never actually uses any formatting, and either parse mode
 *   requires escaping characters that appear all the time in ordinary case
 *   data (a game title with an "&", "<", "*", "_", etc.) or Telegram
 *   rejects the whole message outright. That used to be a real bug here —
 *   parse_mode: 'HTML' was set with unescaped text, so a game titled e.g.
 *   "Fish & Dragon" would silently and permanently fail to notify anyone.
 * @returns {Promise<object>} the Telegram API's decoded JSON response.
 * @throws if TELEGRAM_BOT_TOKEN isn't configured, chatId is missing, or the
 *   Telegram API call itself fails/errors — callers are expected to catch
 *   this and treat it as best-effort (see notifyCaseStageChange in
 *   routes.js), never let a Telegram failure block the actual save it's
 *   reporting on.
 */
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server.');
  if (!chatId) throw new Error('No Telegram chat ID configured for this Provider.');
  const res = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body — data stays {} */ }
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram API error: ${data.description || res.statusText || res.status}`);
  }
  return data;
}

module.exports = { sendTelegramMessage };
