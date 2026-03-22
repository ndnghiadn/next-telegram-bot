import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const period = searchParams.get("period") || "month";

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Check if finance database exists
    const dbPath = path.join(process.cwd(), "data", "finance.db");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        transactionCount: 0,
        topIncomeCategory: "N/A",
        topExpenseCategory: "N/A",
        thisMonthIncome: 0,
        thisMonthExpense: 0,
        lastMonthIncome: 0,
        lastMonthExpense: 0,
      });
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const now = new Date();
    let startDate: Date;
    let lastMonthStart: Date;
    let lastMonthEnd: Date;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
      lastMonthStart = new Date(now.getFullYear() - 1, 0, 1);
      lastMonthEnd = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      lastMonthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      lastMonthEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    }

    // Total stats
    const totalIncome = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"',
      [userId],
    );

    const totalExpense = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"',
      [userId],
    );

    const transactionCount = await db.get(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?",
      [userId],
    );

    // This month stats
    const thisMonthIncome = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income" AND date >= ?',
      [userId, startDate.toISOString()],
    );

    const thisMonthExpense = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense" AND date >= ?',
      [userId, startDate.toISOString()],
    );

    // Last month stats
    const lastMonthIncome = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income" AND date >= ? AND date <= ?',
      [userId, lastMonthStart.toISOString(), lastMonthEnd.toISOString()],
    );

    const lastMonthExpense = await db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense" AND date >= ? AND date <= ?',
      [userId, lastMonthStart.toISOString(), lastMonthEnd.toISOString()],
    );

    // Top categories
    const topIncomeCategory = await db.get(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "income" GROUP BY category ORDER BY total DESC LIMIT 1',
      [userId],
    );

    const topExpenseCategory = await db.get(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "expense" GROUP BY category ORDER BY total DESC LIMIT 1',
      [userId],
    );

    await db.close();

    const stats = {
      totalIncome: totalIncome.total || 0,
      totalExpense: totalExpense.total || 0,
      balance: (totalIncome.total || 0) - (totalExpense.total || 0),
      transactionCount: transactionCount.count || 0,
      topIncomeCategory: topIncomeCategory?.category || "N/A",
      topExpenseCategory: topExpenseCategory?.category || "N/A",
      thisMonthIncome: thisMonthIncome.total || 0,
      thisMonthExpense: thisMonthExpense.total || 0,
      lastMonthIncome: lastMonthIncome.total || 0,
      lastMonthExpense: lastMonthExpense.total || 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching finance stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch finance stats" },
      { status: 500 },
    );
  }
}
