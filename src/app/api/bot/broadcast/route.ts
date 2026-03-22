import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import TelegramBot from "node-telegram-bot-api";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Get bot token and admin ID from environment
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!telegramBotToken) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 },
      );
    }

    // Check database and get users
    const dbPath = path.join(process.cwd(), "data", "bot.db");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Database not found. Please start the bot first." },
        { status: 400 },
      );
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const users = await db.all("SELECT * FROM users WHERE is_active = 1");
    await db.close();

    if (users.length === 0) {
      return NextResponse.json(
        { error: "No active users found" },
        { status: 400 },
      );
    }

    // Create bot instance and send broadcast
    const bot = new TelegramBot(telegramBotToken);
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(
          user.telegram_id,
          `📢 *Broadcast:*\n\n${message}`,
          { parse_mode: "Markdown" },
        );
        successCount++;
      } catch (error) {
        failCount++;
        console.error(
          `Failed to send broadcast to ${user.telegram_id}:`,
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Broadcast sent successfully",
      stats: {
        totalUsers: users.length,
        successCount,
        failCount,
      },
    });
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 },
    );
  }
}
