import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  is_active: boolean;
  message_count: number;
  last_active: string;
  created_at: string;
}

export interface CommandStats {
  id: number;
  command: string;
  user_id: number;
  count: number;
  last_used: string;
}

export interface ScheduledMessage {
  id: number;
  user_id: number;
  message: string;
  schedule_time: string;
  is_sent: boolean;
  created_at: string;
}

class BotDatabase {
  private db: Database | null = null;

  async init(): Promise<void> {
    const dbPath = path.join(process.cwd(), "data", "bot.db");

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await this.createTables();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        is_admin BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        message_count INTEGER DEFAULT 0,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS command_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT,
        user_id INTEGER,
        count INTEGER DEFAULT 1,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (telegram_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT,
        schedule_time DATETIME,
        is_sent BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (telegram_id)
      );

      CREATE TABLE IF NOT EXISTS bot_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT,
        message TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async addUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run(
      `
      INSERT OR REPLACE INTO users (telegram_id, username, first_name, last_name, last_active)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      [telegramId, username, firstName, lastName],
    );
  }

  async getUser(telegramId: number): Promise<User | null> {
    if (!this.db) throw new Error("Database not initialized");

    const user = await this.db.get(
      "SELECT * FROM users WHERE telegram_id = ?",
      [telegramId],
    );
    return (user as User) || null;
  }

  async updateUserStats(telegramId: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run(
      `
      UPDATE users 
      SET message_count = message_count + 1, last_active = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `,
      [telegramId],
    );
  }

  async logCommand(command: string, userId: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run(
      `
      INSERT OR REPLACE INTO command_stats (command, user_id, count, last_used)
      VALUES (?, ?, COALESCE((SELECT count FROM command_stats WHERE command = ? AND user_id = ?), 0) + 1, CURRENT_TIMESTAMP)
    `,
      [command, userId, command, userId],
    );
  }

  async getCommandStats(userId?: number): Promise<CommandStats[]> {
    if (!this.db) throw new Error("Database not initialized");

    const query = userId
      ? "SELECT * FROM command_stats WHERE user_id = ? ORDER BY count DESC"
      : "SELECT * FROM command_stats ORDER BY count DESC LIMIT 50";

    const params = userId ? [userId] : [];

    const stats = await this.db.all(query, params);
    return stats as CommandStats[];
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.db) throw new Error("Database not initialized");

    const users = await this.db.all(
      "SELECT * FROM users ORDER BY last_active DESC",
    );
    return users as User[];
  }

  async setAdmin(telegramId: number, isAdmin: boolean): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run("UPDATE users SET is_admin = ? WHERE telegram_id = ?", [
      isAdmin,
      telegramId,
    ]);
  }

  async addScheduledMessage(
    userId: number,
    message: string,
    scheduleTime: string,
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.run(
      "INSERT INTO scheduled_messages (user_id, message, schedule_time) VALUES (?, ?, ?)",
      [userId, message, scheduleTime],
    );

    return result.lastID || 0;
  }

  async getPendingScheduledMessages(): Promise<ScheduledMessage[]> {
    if (!this.db) throw new Error("Database not initialized");

    const messages = await this.db.all(
      "SELECT * FROM scheduled_messages WHERE is_sent = 0 AND schedule_time <= CURRENT_TIMESTAMP",
    );
    return messages as ScheduledMessage[];
  }

  async markScheduledMessageAsSent(id: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run(
      "UPDATE scheduled_messages SET is_sent = 1 WHERE id = ?",
      [id],
    );
  }

  async log(level: string, message: string, userId?: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run(
      "INSERT INTO bot_logs (level, message, user_id) VALUES (?, ?, ?)",
      [level, message, userId],
    );
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalMessages: number;
    activeUsers: number;
  }> {
    if (!this.db) throw new Error("Database not initialized");

    const totalUsers = await this.db.get("SELECT COUNT(*) as count FROM users");
    const totalMessages = await this.db.get(
      "SELECT SUM(message_count) as count FROM users",
    );
    const activeUsers = await this.db.get(
      'SELECT COUNT(*) as count FROM users WHERE last_active >= datetime("now", "-1 day")',
    );

    return {
      totalUsers: totalUsers.count || 0,
      totalMessages: totalMessages.count || 0,
      activeUsers: activeUsers.count || 0,
    };
  }
}

export const botDB = new BotDatabase();
