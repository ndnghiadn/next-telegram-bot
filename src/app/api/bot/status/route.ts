import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

export async function GET() {
  try {
    // Check if database exists and get real stats
    const dbPath = path.join(process.cwd(), "data", "bot.db");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({
        status: "offline",
        stats: {
          totalUsers: 0,
          totalMessages: 0,
          activeChats: 0,
        },
      });
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Get real stats from database
    const totalUsers = await db.get("SELECT COUNT(*) as count FROM users");
    const totalMessages = await db.get(
      "SELECT SUM(message_count) as count FROM users",
    );
    const activeUsers = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE last_active >= datetime("now", "-1 day")',
    );

    await db.close();

    const stats = {
      totalUsers: totalUsers.count || 0,
      totalMessages: totalMessages.count || 0,
      activeChats: activeUsers.count || 0,
    };

    return NextResponse.json({
      status: "online",
      stats,
    });
  } catch (error) {
    console.error("Error getting bot status:", error);
    return NextResponse.json(
      {
        status: "offline",
        stats: {
          totalUsers: 0,
          totalMessages: 0,
          activeChats: 0,
        },
      },
      { status: 500 },
    );
  }
}
