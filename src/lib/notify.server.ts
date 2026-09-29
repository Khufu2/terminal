/** Telegram alert delivery. Silently no-ops when the bot token is not configured. */
export async function sendTelegram(chatId: string | null, text: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}