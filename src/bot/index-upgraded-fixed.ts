import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Import our modules
import { botDB } from "./database";
import logger from "./logger";
import { userMiddleware, adminMiddleware } from "./middleware";
import { BotCommands } from "./commands";

// Load environment variables
dotenv.config({ path: ".env.local" });

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : 0;

if (!telegramBotToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set in environment variables");
  process.exit(1);
}

// Create data and logs directories
["data", "logs"].forEach((dir) => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Create a bot that uses "polling" to fetch new updates
const bot = new TelegramBot(telegramBotToken, {
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
});

console.log("🚀 Advanced Telegram Bot starting...");

// Initialize commands handler
const commands = new BotCommands(bot, adminId);

// Initialize database
botDB
  .init()
  .then(() => {
    logger.info("Database initialized successfully");

    // Set first user as admin if no admin exists
    if (adminId === 0) {
      botDB.getAllUsers().then((users) => {
        if (users.length > 0 && !users.some((u) => u.is_admin)) {
          botDB.setAdmin(users[0].telegram_id, true);
          logger.info(`Set ${users[0].telegram_id} as admin`);
        }
      });
    }
  })
  .catch((error) => {
    logger.error("Failed to initialize database:", error);
  });

// Middleware for all messages
bot.on("message", async (msg) => {
  try {
    // Apply user middleware
    const allowed = await userMiddleware(bot, msg);
    if (!allowed) return;

    // Handle file uploads
    if (msg.photo || msg.document || msg.video || msg.audio || msg.voice) {
      await commands.handleFile(msg);
      return;
    }

    // Handle text messages
    const messageText = msg.text;
    if (!messageText) return;

    // Log all messages
    await botDB.log("message", messageText, msg.from?.id);

    // Handle commands
    if (messageText.startsWith("/")) {
      const [command, ...args] = messageText.split(" ");
      const argString = args.join(" ");

      switch (command) {
        case "/start":
          await commands.startCommand(msg);
          break;

        case "/help":
          await commands.helpCommand(msg);
          break;

        case "/info":
          await commands.infoCommand(msg);
          break;

        case "/stats":
          await commands.statsCommand(msg);
          break;

        case "/mystats":
          await commands.myStatsCommand(msg);
          break;

        case "/schedule":
          await commands.scheduleCommand(
            msg,
            messageText.match(/\/schedule\s+(.+)/),
          );
          break;

        case "/time":
          await commands.timeCommand(msg);
          break;

        case "/echo":
          await commands.echoCommand(msg, messageText.match(/\/echo\s+(.+)/));
          break;

        case "/upload":
          await commands.uploadCommand(msg);
          break;

        // Admin commands
        case "/admin":
          if (await adminMiddleware(bot, msg)) {
            await commands.adminCommand(msg);
          }
          break;

        case "/users":
          if (await adminMiddleware(bot, msg)) {
            await commands.usersCommand(msg);
          }
          break;

        case "/broadcast":
          if (await adminMiddleware(bot, msg)) {
            await commands.broadcastCommand(
              msg,
              messageText.match(/\/broadcast\s+(.+)/),
            );
          }
          break;

        case "/setadmin":
          if (await adminMiddleware(bot, msg)) {
            await commands.setAdminCommand(
              msg,
              messageText.match(/\/setadmin\s+(.+)/),
            );
          }
          break;

        case "/logs":
          if (await adminMiddleware(bot, msg)) {
            await commands.logsCommand(msg);
          }
          break;

        case "/stats_detailed":
          if (await adminMiddleware(bot, msg)) {
            await commands.detailedStatsCommand(msg);
          }
          break;

        default:
          await bot.sendMessage(
            msg.chat.id,
            `❓ *Unknown command:* ${command}\n\nType /help to see available commands.`,
            { parse_mode: "Markdown" },
          );
      }
    } else {
      // Handle non-command messages
      await bot.sendMessage(
        msg.chat.id,
        `💬 You said: "${messageText}"\n\nType /help to see available commands.`,
      );
    }
  } catch (error) {
    logger.error("Error handling message:", error);
    await bot.sendMessage(
      msg.chat.id,
      "❌ An error occurred while processing your message.",
    );
  }
});

// Handle callback queries (inline keyboards)
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  if (!msg || !data) return;

  try {
    await bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case "stats":
        await commands.statsCommand(msg);
        break;

      case "help":
        await commands.helpCommand(msg);
        break;

      case "schedule":
        await bot.sendMessage(
          msg.chat.id,
          "⏰ *Schedule Message*\n\n" +
            "Usage: `/schedule <HH:MM> <message>`\n" +
            "Example: `/schedule 14:30 Meeting reminder`",
          { parse_mode: "Markdown" },
        );
        break;

      case "mystats":
        await commands.myStatsCommand(msg);
        break;

      case "admin_users":
        if (await adminMiddleware(bot, msg)) {
          await commands.usersCommand(msg);
        }
        break;

      case "admin_broadcast":
        if (await adminMiddleware(bot, msg)) {
          await bot.sendMessage(
            msg.chat.id,
            "📢 *Broadcast*\n\n" +
              "Usage: `/broadcast <message>`\n" +
              "Example: `/broadcast Hello everyone!`",
            { parse_mode: "Markdown" },
          );
        }
        break;

      case "admin_stats":
        if (await adminMiddleware(bot, msg)) {
          await commands.detailedStatsCommand(msg);
        }
        break;

      case "admin_logs":
        if (await adminMiddleware(bot, msg)) {
          await commands.logsCommand(msg);
        }
        break;

      default:
        await bot.sendMessage(msg.chat.id, "❌ Unknown action");
    }
  } catch (error) {
    logger.error("Error handling callback query:", error);
  }
});

// Handle errors
bot.on("polling_error", (error) => {
  logger.error("Telegram bot polling error:", error);
});

bot.on("webhook_error", (error) => {
  logger.error("Telegram bot webhook error:", error);
});

// Handle new chat members
bot.on("new_chat_members", async (msg) => {
  if (msg.new_chat_members) {
    for (const member of msg.new_chat_members) {
      await botDB.addUser(
        member.id,
        member.username,
        member.first_name,
        member.last_name,
      );
      await bot.sendMessage(
        msg.chat.id,
        `👋 Welcome ${member.first_name || "User"}! Use /start to begin.`,
        { parse_mode: "Markdown" },
      );
    }
  }
});

// Handle left chat members
bot.on("left_chat_member", async (msg) => {
  if (msg.left_chat_member) {
    await botDB.log(
      "user_left",
      `User ${msg.left_chat_member.first_name} left the chat`,
      msg.left_chat_member.id,
    );
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down Telegram bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down Telegram bot...");
  bot.stopPolling();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

console.log("✅ Advanced Telegram Bot started successfully!");
logger.info("Bot started with advanced features");

export default bot;
