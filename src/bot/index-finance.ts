import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Import our modules
import { botDB } from "./database";
import { financeDB } from "./database-finance";
import logger from "./logger";
import { userMiddleware, adminMiddleware } from "./middleware";
import { BotCommands } from "./commands";
import { FinanceCommands } from "./commands-finance";

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

console.log("💰 Finance Telegram Bot starting...");

// Initialize commands handlers
const commands = new BotCommands(bot, adminId);
const financeCommands = new FinanceCommands(bot, adminId);

// Initialize databases
Promise.all([botDB.init(), financeDB.init()])
  .then(() => {
    logger.info("Databases initialized successfully");

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
    logger.error("Failed to initialize databases:", error);
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

      // Finance commands (priority)
      switch (command) {
        case "/income":
          await financeCommands.incomeCommand(
            msg,
            messageText.match(/\/income\s+(.+)/),
          );
          break;

        case "/expense":
          await financeCommands.expenseCommand(
            msg,
            messageText.match(/\/expense\s+(.+)/),
          );
          break;

        case "/balance":
          await financeCommands.balanceCommand(msg);
          break;

        case "/stats":
          await financeCommands.statsCommand(
            msg,
            messageText.match(/\/stats\s+(.+)/),
          );
          break;

        case "/recent":
          await financeCommands.recentCommand(
            msg,
            messageText.match(/\/recent\s+(.+)/),
          );
          break;

        case "/categories":
          await financeCommands.categoriesCommand(msg);
          break;

        case "/addcategory":
          await financeCommands.addCategoryCommand(
            msg,
            messageText.match(/\/addcategory\s+(.+)/),
          );
          break;

        case "/budget":
          await financeCommands.budgetCommand(msg);
          break;

        case "/fhelp":
          await financeCommands.helpCommand(msg);
          break;

        // Original bot commands
        case "/start":
          await commands.startCommand(msg);
          break;

        case "/help":
          await commands.helpCommand(msg);
          break;

        case "/info":
          await commands.infoCommand(msg);
          break;

        case "/bstats": // Bot stats (different from finance stats)
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
            `❓ *Unknown command:* ${command}\n\nType /help for bot commands or /fhelp for finance commands.`,
            { parse_mode: "Markdown" },
          );
      }
    } else {
      // Handle non-command messages
      await bot.sendMessage(
        msg.chat.id,
        `💬 You said: "${messageText}"\n\n💰 *Finance Commands:* /fhelp\n📱 *Bot Commands:* /help`,
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
    // Handle finance callback queries first
    if (
      data.startsWith("income_select_") ||
      data.startsWith("expense_select_")
    ) {
      await financeCommands.handleCallbackQuery(callbackQuery);
      return;
    }

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
        `👋 Welcome ${member.first_name || "User"}! 💰\n\n` +
          `I'm your Finance Bot! Here's how to get started:\n\n` +
          `💰 *Add your first income:* /income 5000 Salary\n` +
          `💸 *Add your first expense:* /expense 50 Groceries\n` +
          `💳 *Check balance:* /balance\n` +
          `📊 *View stats:* /stats\n` +
          `❓ *Get help:* /fhelp`,
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
  logger.info("Shutting down Finance Telegram bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down Finance Telegram bot...");
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

console.log("✅ Finance Telegram Bot started successfully!");
logger.info("Finance bot started with all features");

export default bot;
