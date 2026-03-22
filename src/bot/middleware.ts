import TelegramBot from "node-telegram-bot-api";
import { botDB } from "./database";
import logger from "./logger";

interface UserMessage {
  userId: number;
  timestamp: number;
}

class RateLimiter {
  private messages = new Map<number, UserMessage[]>();
  private readonly WINDOW_SIZE = 60000; // 1 minute
  private readonly MAX_MESSAGES = 10; // max 10 messages per minute

  isAllowed(userId: number): boolean {
    const now = Date.now();
    const userMessages = this.messages.get(userId) || [];

    // Remove old messages outside the window
    const validMessages = userMessages.filter(
      (msg) => now - msg.timestamp < this.WINDOW_SIZE,
    );

    if (validMessages.length >= this.MAX_MESSAGES) {
      return false;
    }

    validMessages.push({ userId, timestamp: now });
    this.messages.set(userId, validMessages);
    return true;
  }
}

class AntiSpam {
  private spamUsers = new Set<number>();
  private readonly SPAM_THRESHOLD = 20; // messages in 30 seconds
  private readonly SPAM_WINDOW = 30000;
  private messageCounts = new Map<number, number[]>();

  isSpam(userId: number): boolean {
    if (this.spamUsers.has(userId)) {
      return true;
    }

    const now = Date.now();
    const userMessages = this.messageCounts.get(userId) || [];
    const recentMessages = userMessages.filter(
      (time) => now - time < this.SPAM_WINDOW,
    );

    if (recentMessages.length >= this.SPAM_THRESHOLD) {
      this.spamUsers.add(userId);
      setTimeout(() => this.spamUsers.delete(userId), 300000); // 5 minutes ban
      return true;
    }

    recentMessages.push(now);
    this.messageCounts.set(userId, recentMessages);
    return false;
  }
}

export const rateLimiter = new RateLimiter();
export const antiSpam = new AntiSpam();

export async function userMiddleware(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<boolean> {
  const userId = msg.from?.id;
  if (!userId) return false;

  try {
    // Check rate limiting
    if (!rateLimiter.isAllowed(userId)) {
      await bot.sendMessage(
        msg.chat.id,
        "⚠️ *Rate Limit Exceeded*\n\nPlease wait a moment before sending another message.",
        { parse_mode: "Markdown" },
      );
      return false;
    }

    // Check anti-spam
    if (antiSpam.isSpam(userId)) {
      await bot.sendMessage(
        msg.chat.id,
        "🚫 *Spam Detection*\n\nYou have been temporarily restricted for spam-like behavior.",
        { parse_mode: "Markdown" },
      );
      logger.warn(`User ${userId} flagged for spam`);
      return false;
    }

    // Add/update user in database
    await botDB.addUser(
      userId,
      msg.from?.username,
      msg.from?.first_name,
      msg.from?.last_name,
    );

    // Update user stats
    await botDB.updateUserStats(userId);

    return true;
  } catch (error) {
    logger.error("Middleware error:", error);
    return true; // Allow message if middleware fails
  }
}

export async function adminMiddleware(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<boolean> {
  const userId = msg.from?.id;
  if (!userId) return false;

  const user = await botDB.getUser(userId);
  if (!user || !user.is_admin) {
    await bot.sendMessage(
      msg.chat.id,
      "🔒 *Access Denied*\n\nThis command is restricted to administrators only.",
      { parse_mode: "Markdown" },
    );
    return false;
  }

  return true;
}
