import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");
    const category = searchParams.get("category");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Check if finance database exists
    const dbPath = path.join(process.cwd(), "data", "finance.db");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json([]);
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    let query = "SELECT * FROM transactions WHERE user_id = ?";
    const params: any[] = [userId];

    if (type && ["income", "expense"].includes(type)) {
      query += " AND type = ?";
      params.push(type);
    }

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    query += " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const transactions = await db.all(query, params);
    await db.close();

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type, amount, category, description, userId, date } =
      await request.json();

    if (!type || !amount || !category || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: type, amount, category, userId" },
        { status: 400 },
      );
    }

    if (!["income", "expense"].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "income" or "expense"' },
        { status: 400 },
      );
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    // Check if finance database exists
    const dbPath = path.join(process.cwd(), "data", "finance.db");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Finance database not found. Please start the bot first." },
        { status: 400 },
      );
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const transactionDate = date || new Date().toISOString();

    const result = await db.run(
      "INSERT INTO transactions (type, amount, category, description, user_id, date) VALUES (?, ?, ?, ?, ?, ?)",
      [type, amount, category, description, userId, transactionDate],
    );

    await db.close();

    return NextResponse.json({
      success: true,
      id: result.lastID,
      message: "Transaction added successfully",
    });
  } catch (error) {
    console.error("Error adding transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 },
    );
  }
}
