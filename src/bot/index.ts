import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

if (!telegramBotToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set in environment variables");
  process.exit(1);
}

// Create a bot that uses "polling" to fetch new updates
const bot = new TelegramBot(telegramBotToken, { polling: true });

console.log("Telegram bot started...");

// Basic bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "👋 Welcome to the bot!\n\n" +
      "Available commands:\n" +
      "/help - Show this help message\n" +
      "/info - Get bot information\n" +
      "/echo <message> - Echo back your message",
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "📖 *Bot Commands:*\n\n" +
      "/start - Start the bot\n" +
      "/help - Show this help message\n" +
      "/info - Get bot information\n" +
      "/echo <message> - Echo back your message\n" +
      "/time - Get current time",
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/info/, async (msg) => {
  const chatId = msg.chat.id;
  const botInfo = await bot.getMe();
  bot.sendMessage(
    chatId,
    `🤖 *Bot Information:*\n\n` +
      `Name: ${botInfo.first_name}\n` +
      `Username: @${botInfo.username}\n` +
      `Your ID: ${msg.from?.id}\n` +
      `Chat Type: ${msg.chat.type}`,
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const echoText = match?.[1];
  if (echoText) {
    bot.sendMessage(chatId, `📢 Echo: ${echoText}`);
  }
});

bot.onText(/\/time/, (msg) => {
  const chatId = msg.chat.id;
  const currentTime = new Date().toLocaleString();
  bot.sendMessage(chatId, `🕐 Current time: ${currentTime}`);
});

// Handle any other messages
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // Ignore commands that are already handled
  if (messageText && messageText.startsWith("/")) {
    return;
  }

  // Simple echo for non-command messages
  if (messageText) {
    bot.sendMessage(
      chatId,
      `💬 You said: "${messageText}"\n\nType /help to see available commands.`,
    );
  }
});

// Handle errors
bot.on("polling_error", (error) => {
  console.error("Telegram bot polling error:", error);
});

// Handle successful connection
bot.on("webhook_error", (error) => {
  console.error("Telegram bot webhook error:", error);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down Telegram bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down Telegram bot...");
  bot.stopPolling();
  process.exit(0);
});

export default bot;
