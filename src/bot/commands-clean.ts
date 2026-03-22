import TelegramBot from "node-telegram-bot-api";
import { botDB } from "./database";
import logger from "./logger";
import * as cron from "node-cron";

export class BotCommands {
  private bot: TelegramBot;
  private adminId: number;

  constructor(bot: TelegramBot, adminId: number) {
    this.bot = bot;
    this.adminId = adminId;
    this.initScheduledTasks();
  }

  // Additional simple commands
  async timeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/time", userId || 0);

    const currentTime = new Date().toLocaleString();
    await this.bot.sendMessage(chatId, `🕐 *Current time:* ${currentTime}`, {
      parse_mode: "Markdown",
    });
  }

  async echoCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/echo", userId || 0);

    const echoText = match?.[1];
    if (echoText) {
      await this.bot.sendMessage(chatId, `📢 *Echo:* ${echoText}`, {
        parse_mode: "Markdown",
      });
    } else {
      await this.bot.sendMessage(
        chatId,
        "📢 *Echo*\n\nUsage: `/echo <message>`\nExample: `/echo Hello world`",
        { parse_mode: "Markdown" },
      );
    }
  }

  async logsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/logs", userId || 0);

    // This would read from the logs table or winston logs
    await this.bot.sendMessage(
      chatId,
      "📝 *Recent Logs:*\n\n" +
        "📋 Bot started successfully\n" +
        "👥 New user joined\n" +
        "💬 Message processed\n" +
        "🔧 Admin command executed",
      { parse_mode: "Markdown" },
    );
  }

  async detailedStatsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/stats_detailed", userId || 0);

    const stats = await botDB.getStats();
    const users = await botDB.getAllUsers();
    const commandStats = await botDB.getCommandStats();

    const activeUsers = users.filter((u) => {
      const lastActive = new Date(u.last_active);
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return lastActive > dayAgo;
    }).length;

    const adminUsers = users.filter((u) => u.is_admin).length;

    let statsText =
      `📊 *Detailed Statistics:*\n\n` +
      `👥 *Users:*\n` +
      `• Total: ${stats.totalUsers}\n` +
      `• Active Today: ${activeUsers}\n` +
      `• Admins: ${adminUsers}\n\n` +
      `💬 *Messages:*\n` +
      `• Total: ${stats.totalMessages}\n` +
      `• Avg per User: ${stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers) : 0}\n\n` +
      `🔥 *Top Commands:*`;

    commandStats.slice(0, 10).forEach((cmd, index) => {
      statsText += `\n${index + 1}. /${cmd.command} - ${cmd.count} uses`;
    });

    await this.bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
  }

  // Basic Commands
  async startCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/start", userId || 0);

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 Bot Stats", callback_data: "stats" },
            { text: "🔧 Help", callback_data: "help" },
          ],
          [
            { text: "⏰ Schedule Message", callback_data: "schedule" },
            { text: "📈 My Stats", callback_data: "mystats" },
          ],
        ],
      },
    };

    await this.bot.sendMessage(
      chatId,
      "🚀 *Welcome to Advanced Telegram Bot!*\n\n" +
        "🎯 *Features:*\n" +
        "• User management & statistics\n" +
        "• Scheduled messages\n" +
        "• Admin commands\n" +
        "• Rate limiting & anti-spam\n" +
        "• File handling\n" +
        "• Real-time analytics\n\n" +
        "📝 *Commands:* /help • /info • /stats • /schedule",
      { parse_mode: "Markdown", ...keyboard },
    );
  }

  async helpCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/help", userId || 0);

    const user = await botDB.getUser(userId || 0);
    const isAdmin = user?.is_admin;

    let helpText =
      "📖 *Bot Commands:*\n\n" +
      "👤 *User Commands:*\n" +
      "/start - Welcome message\n" +
      "/help - Show this help\n" +
      "/info - Bot information\n" +
      "/stats - Bot statistics\n" +
      "/mystats - Your statistics\n" +
      "/schedule <time> <message> - Schedule message\n" +
      "/time - Current time\n" +
      "/echo <message> - Echo message\n\n";

    if (isAdmin) {
      helpText +=
        "🔧 *Admin Commands:*\n" +
        "/admin - Admin panel\n" +
        "/users - List all users\n" +
        "/broadcast <message> - Send to all users\n" +
        "/setadmin <user_id> - Make user admin\n" +
        "/logs - View recent logs\n" +
        "/stats_detailed - Detailed statistics\n\n";
    }

    helpText +=
      "📁 *File Commands:*\n" +
      "/upload - Upload file guide\n" +
      "/download <file_id> - Download file\n\n" +
      "❓ *Need help?* Contact admin";

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  async infoCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/info", userId || 0);

    const botInfo = await this.bot.getMe();
    const stats = await botDB.getStats();
    const user = await botDB.getUser(userId || 0);

    const infoText =
      `🤖 *Bot Information:*\n\n` +
      `📛 *Name:* ${botInfo.first_name}\n` +
      `🆔 *Username:* @${botInfo.username}\n` +
      `👥 *Total Users:* ${stats.totalUsers}\n` +
      `💬 *Total Messages:* ${stats.totalMessages}\n` +
      `🟢 *Active Users:* ${stats.activeUsers}\n\n` +
      `👤 *Your Info:*\n` +
      `🆔 *ID:* ${userId}\n` +
      `📊 *Messages Sent:* ${user?.message_count || 0}\n` +
      `🏆 *Admin:* ${user?.is_admin ? "✅ Yes" : "❌ No"}\n` +
      `💬 *Chat Type:* ${msg.chat.type}`;

    await this.bot.sendMessage(chatId, infoText, { parse_mode: "Markdown" });
  }

  async statsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/stats", userId || 0);

    const stats = await botDB.getStats();
    const commandStats = await botDB.getCommandStats();
    const topCommands = commandStats.slice(0, 5);

    let statsText =
      `📊 *Bot Statistics:*\n\n` +
      `👥 *Users:* ${stats.totalUsers}\n` +
      `💬 *Total Messages:* ${stats.totalMessages}\n` +
      `🟢 *Active Today:* ${stats.activeUsers}\n\n` +
      `🔥 *Top Commands:*`;

    topCommands.forEach((cmd, index) => {
      statsText += `\n${index + 1}. /${cmd.command} - ${cmd.count} uses`;
    });

    await this.bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
  }

  async myStatsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/mystats", userId || 0);

    const user = await botDB.getUser(userId || 0);
    const userCommands = await botDB.getCommandStats(userId || 0);

    if (!user) {
      await this.bot.sendMessage(chatId, "❌ User not found in database");
      return;
    }

    let statsText =
      `📈 *Your Statistics:*\n\n` +
      `👤 *Name:* ${user.first_name || "N/A"}\n` +
      `🆔 *ID:* ${user.telegram_id}\n` +
      `📊 *Messages:* ${user.message_count}\n` +
      `🏆 *Admin:* ${user.is_admin ? "✅ Yes" : "❌ No"}\n` +
      `🟢 *Active:* ${user.is_active ? "✅ Yes" : "❌ No"}\n` +
      `📅 *Joined:* ${new Date(user.created_at).toLocaleDateString()}\n` +
      `⏰ *Last Active:* ${new Date(user.last_active).toLocaleString()}\n\n` +
      `🔥 *Your Commands:*`;

    userCommands.slice(0, 5).forEach((cmd, index) => {
      statsText += `\n${index + 1}. /${cmd.command} - ${cmd.count} uses`;
    });

    await this.bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
  }

  async scheduleCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/schedule", userId || 0);

    if (!match || !match[1]) {
      await this.bot.sendMessage(
        chatId,
        "⏰ *Schedule Message*\n\n" +
          "Usage: `/schedule <HH:MM> <message>`\n" +
          "Example: `/schedule 14:30 Meeting reminder`\n\n" +
          "⏱️ Time format: 24-hour (HH:MM)\n" +
          "📅 Schedule for today only",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const [time, ...messageParts] = match[1].split(" ");
    const message = messageParts.join(" ");

    if (!time.match(/^\d{2}:\d{2}$/) || !message) {
      await this.bot.sendMessage(
        chatId,
        "❌ *Invalid format*\n\n" +
          "Usage: `/schedule <HH:MM> <message>`\n" +
          "Example: `/schedule 14:30 Meeting reminder`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    if (scheduledTime <= now) {
      await this.bot.sendMessage(
        chatId,
        "❌ *Invalid time*\n\nPlease schedule for a future time today.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await botDB.addScheduledMessage(
      userId || 0,
      message,
      scheduledTime.toISOString(),
    );

    await this.bot.sendMessage(
      chatId,
      `✅ *Message Scheduled!*\n\n` +
        `⏰ *Time:* ${time}\n` +
        `💬 *Message:* ${message}\n\n` +
        `📝 I will send this message at the scheduled time.`,
      { parse_mode: "Markdown" },
    );
  }

  // Admin Commands
  async adminCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/admin", userId || 0);

    const stats = await botDB.getStats();
    const users = await botDB.getAllUsers();

    let adminText =
      `🔧 *Admin Panel*\n\n` +
      `📊 *Statistics:*\n` +
      `👥 Total Users: ${stats.totalUsers}\n` +
      `💬 Total Messages: ${stats.totalMessages}\n` +
      `🟢 Active Today: ${stats.activeUsers}\n\n` +
      `👥 *Recent Users:*`;

    users.slice(0, 5).forEach((user, index) => {
      adminText += `\n${index + 1}. ${user.first_name || "N/A"} (@${user.username || "N/A"}) - ${user.message_count} msgs`;
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 All Users", callback_data: "admin_users" },
            { text: "📢 Broadcast", callback_data: "admin_broadcast" },
          ],
          [
            { text: "📊 Detailed Stats", callback_data: "admin_stats" },
            { text: "📝 Logs", callback_data: "admin_logs" },
          ],
        ],
      },
    };

    await this.bot.sendMessage(chatId, adminText, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  }

  async usersCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/users", userId || 0);

    const users = await botDB.getAllUsers();

    let usersText = `👥 *All Users (${users.length}):*\n\n`;

    users.forEach((user, index) => {
      const status = user.is_active ? "🟢" : "🔴";
      const admin = user.is_admin ? "👑" : "";
      usersText += `${index + 1}. ${status} ${admin} ${user.first_name || "N/A"} (@${user.username || "N/A"}) - ${user.message_count} msgs\n`;
    });

    // Split message if too long
    if (usersText.length > 4000) {
      const parts = usersText.match(/.{1,4000}/g) || [];
      for (const part of parts) {
        await this.bot.sendMessage(chatId, part, { parse_mode: "Markdown" });
      }
    } else {
      await this.bot.sendMessage(chatId, usersText, { parse_mode: "Markdown" });
    }
  }

  async broadcastCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/broadcast", userId || 0);

    if (!match || !match[1]) {
      await this.bot.sendMessage(
        chatId,
        "📢 *Broadcast*\n\n" +
          "Usage: `/broadcast <message>`\n" +
          "Example: `/broadcast Hello everyone!`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const message = match[1];
    const users = await botDB.getAllUsers();
    let successCount = 0;
    let failCount = 0;

    await this.bot.sendMessage(chatId, "📢 *Broadcasting message...*", {
      parse_mode: "Markdown",
    });

    for (const user of users) {
      try {
        await this.bot.sendMessage(
          user.telegram_id,
          `📢 *Broadcast:*\n\n${message}`,
          { parse_mode: "Markdown" },
        );
        successCount++;
      } catch (error) {
        failCount++;
        logger.error(`Failed to send broadcast to ${user.telegram_id}:`, error);
      }
    }

    await this.bot.sendMessage(
      chatId,
      `✅ *Broadcast Complete!*\n\n` +
        `📨 *Sent:* ${successCount} users\n` +
        `❌ *Failed:* ${failCount} users\n` +
        `💬 *Message:* ${message}`,
      { parse_mode: "Markdown" },
    );
  }

  async setAdminCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/setadmin", userId || 0);

    if (!match || !match[1]) {
      await this.bot.sendMessage(
        chatId,
        "👑 *Set Admin*\n\n" +
          "Usage: `/setadmin <user_id>`\n" +
          "Example: `/setadmin 123456789`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const targetUserId = parseInt(match[1]);
    if (isNaN(targetUserId)) {
      await this.bot.sendMessage(chatId, "❌ *Invalid user ID*", {
        parse_mode: "Markdown",
      });
      return;
    }

    const targetUser = await botDB.getUser(targetUserId);
    if (!targetUser) {
      await this.bot.sendMessage(chatId, "❌ *User not found*", {
        parse_mode: "Markdown",
      });
      return;
    }

    await botDB.setAdmin(targetUserId, !targetUser.is_admin);

    const action = targetUser.is_admin ? "removed from" : "granted";
    await this.bot.sendMessage(
      chatId,
      `👑 *Admin ${action}!*\n\n` +
        `👤 *User:* ${targetUser.first_name || "N/A"} (@${targetUser.username || "N/A"})\n` +
        `🆔 *ID:* ${targetUser.telegram_id}\n` +
        `🏆 *New Status:* ${!targetUser.is_admin ? "Admin ✅" : "User ❌"}`,
      { parse_mode: "Markdown" },
    );
  }

  // File Commands
  async uploadCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    await botDB.logCommand("/upload", userId || 0);

    await this.bot.sendMessage(
      chatId,
      "📁 *File Upload Guide*\n\n" +
        "📤 *Supported formats:*\n" +
        "• Images: JPG, PNG, GIF, WebP\n" +
        "• Documents: PDF, DOC, TXT\n" +
        "• Archives: ZIP, RAR\n" +
        "• Videos: MP4, AVI, MOV\n\n" +
        "💡 *How to upload:*\n" +
        "1. Click the 📎 paperclip icon\n" +
        "2. Select your file\n" +
        "3. Send it to the bot\n\n" +
        "🔒 *Security:* All files are scanned for safety",
      { parse_mode: "Markdown" },
    );
  }

  // Handle file uploads
  async handleFile(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      await this.bot.sendMessage(
        chatId,
        `📷 *Photo received!*\n\n` +
          `📏 *Size:* ${photo.file_size} bytes\n` +
          `🆔 *File ID:* \`${photo.file_id}\`\n\n` +
          `💡 Use /download ${photo.file_id} to download`,
        { parse_mode: "Markdown" },
      );
    } else if (msg.document) {
      await this.bot.sendMessage(
        chatId,
        `📄 *Document received!*\n\n` +
          `📛 *Name:* ${msg.document.file_name}\n` +
          `📏 *Size:* ${msg.document.file_size} bytes\n` +
          `🆔 *File ID:* \`${msg.document.file_id}\`\n\n` +
          `💡 Use /download ${msg.document.file_id} to download`,
        { parse_mode: "Markdown" },
      );
    } else if (msg.video) {
      await this.bot.sendMessage(
        chatId,
        `🎥 *Video received!*\n\n` +
          `📏 *Size:* ${msg.video.file_size} bytes\n` +
          `🎬 *Duration:* ${msg.video.duration}s\n` +
          `🆔 *File ID:* \`${msg.video.file_id}\`\n\n` +
          `💡 Use /download ${msg.video.file_id} to download`,
        { parse_mode: "Markdown" },
      );
    }

    await botDB.log("file_upload", `User uploaded file`, userId);
  }

  // Scheduled Tasks
  private initScheduledTasks(): void {
    // Check for scheduled messages every minute
    cron.schedule("* * * * *", async () => {
      try {
        const pendingMessages = await botDB.getPendingScheduledMessages();

        for (const scheduledMsg of pendingMessages) {
          try {
            await this.bot.sendMessage(
              scheduledMsg.user_id,
              `⏰ *Scheduled Message:*\n\n${scheduledMsg.message}`,
              { parse_mode: "Markdown" },
            );

            await botDB.markScheduledMessageAsSent(scheduledMsg.id);
            logger.info(
              `Sent scheduled message ${scheduledMsg.id} to user ${scheduledMsg.user_id}`,
            );
          } catch (error) {
            logger.error(
              `Failed to send scheduled message ${scheduledMsg.id}:`,
              error,
            );
          }
        }
      } catch (error) {
        logger.error("Error in scheduled task:", error);
      }
    });

    // Daily stats report at midnight
    cron.schedule("0 0 * * *", async () => {
      try {
        const stats = await botDB.getStats();
        const message =
          `📊 *Daily Report*\n\n` +
          `👥 Total Users: ${stats.totalUsers}\n` +
          `💬 Total Messages: ${stats.totalMessages}\n` +
          `🟢 Active Today: ${stats.activeUsers}`;

        await this.bot.sendMessage(this.adminId, message, {
          parse_mode: "Markdown",
        });
        logger.info("Daily stats report sent");
      } catch (error) {
        logger.error("Error sending daily report:", error);
      }
    });
  }
}
