import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import winston from "winston";

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

// Logger setup
const logDir = path.join(process.cwd(), "logs");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "telegram-bot" },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

// Database interfaces
interface User {
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

interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  user_id: number;
  date: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  user_id: number;
  color: string;
  icon: string;
  created_at: string;
}

// Consolidated Database class
class ConsolidatedDatabase {
  private db: Database | null = null;

  async init(): Promise<void> {
    const dbPath = path.join(process.cwd(), "data", "finance.db");

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

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        user_id INTEGER NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT '💰',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, user_id, type)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK(amount > 0),
        category TEXT NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
    `);

    await this.insertDefaultCategories();
  }

  private async insertDefaultCategories(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const defaultIncomeCategories = [
      { name: "Salary", icon: "💼", color: "#10b981" },
      { name: "Freelance", icon: "💻", color: "#3b82f6" },
      { name: "Investment", icon: "📈", color: "#8b5cf6" },
      { name: "Business", icon: "🏢", color: "#f59e0b" },
      { name: "Gift", icon: "🎁", color: "#ec4899" },
      { name: "Other Income", icon: "💰", color: "#06b6d4" },
    ];

    const defaultExpenseCategories = [
      { name: "Food", icon: "🍔", color: "#ef4444" },
      { name: "Transport", icon: "🚗", color: "#f97316" },
      { name: "Shopping", icon: "🛍️", color: "#a855f7" },
      { name: "Entertainment", icon: "🎮", color: "#06b6d4" },
      { name: "Bills", icon: "📄", color: "#dc2626" },
      { name: "Healthcare", icon: "🏥", color: "#84cc16" },
      { name: "Education", icon: "📚", color: "#0ea5e9" },
      { name: "Rent", icon: "🏠", color: "#ea580c" },
      { name: "Utilities", icon: "💡", color: "#eab308" },
      { name: "Other Expense", icon: "💸", color: "#64748b" },
    ];

    const users = await this.db.all(
      "SELECT DISTINCT user_id FROM transactions WHERE user_id > 0",
    );

    for (const user of users) {
      const userId = user.user_id;

      for (const category of defaultIncomeCategories) {
        try {
          await this.db.run(
            "INSERT OR IGNORE INTO categories (name, type, user_id, icon, color) VALUES (?, ?, ?, ?, ?)",
            [category.name, "income", userId, category.icon, category.color],
          );
        } catch (error) {
          // Ignore duplicate errors
        }
      }

      for (const category of defaultExpenseCategories) {
        try {
          await this.db.run(
            "INSERT OR IGNORE INTO categories (name, type, user_id, icon, color) VALUES (?, ?, ?, ?, ?)",
            [category.name, "expense", userId, category.icon, category.color],
          );
        } catch (error) {
          // Ignore duplicate errors
        }
      }
    }
  }

  // User methods
  async addUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    await this.db.run(
      "INSERT OR REPLACE INTO users (telegram_id, username, first_name, last_name, last_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
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
      "UPDATE users SET message_count = message_count + 1, last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?",
      [telegramId],
    );
  }

  // Transaction methods
  async addTransaction(
    type: "income" | "expense",
    amount: number,
    category: string,
    description: string,
    userId: number,
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      "INSERT INTO transactions (type, amount, category, description, user_id) VALUES (?, ?, ?, ?, ?)",
      [type, amount, category, description, userId],
    );
    return result.lastID || 0;
  }

  async getTransactions(
    userId: number,
    limit: number = 10,
  ): Promise<Transaction[]> {
    if (!this.db) throw new Error("Database not initialized");
    const transactions = await this.db.all(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT ?",
      [userId, limit],
    );
    return transactions as Transaction[];
  }

  // Category methods
  async getCategories(
    userId: number,
    type?: "income" | "expense",
  ): Promise<Category[]> {
    if (!this.db) throw new Error("Database not initialized");
    let query = "SELECT * FROM categories WHERE user_id = ?";
    const params: any[] = [userId];
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    query += " ORDER BY name ASC";
    const categories = await this.db.all(query, params);
    return categories as Category[];
  }

  async addCategory(
    name: string,
    type: "income" | "expense",
    userId: number,
    icon: string = "💰",
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      "INSERT INTO categories (name, type, user_id, icon) VALUES (?, ?, ?, ?)",
      [name, type, userId, icon],
    );
    return result.lastID || 0;
  }

  // Statistics methods
  async getFinanceStats(userId: number): Promise<any> {
    if (!this.db) throw new Error("Database not initialized");

    const totalIncome = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"',
      [userId],
    );
    const totalExpense = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"',
      [userId],
    );
    const thisMonthIncome = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income" AND date >= datetime("now", "start of month")',
      [userId],
    );
    const thisMonthExpense = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense" AND date >= datetime("now", "start of month")',
      [userId],
    );

    return {
      totalIncome: totalIncome.total || 0,
      totalExpense: totalExpense.total || 0,
      balance: (totalIncome.total || 0) - (totalExpense.total || 0),
      thisMonthIncome: thisMonthIncome.total || 0,
      thisMonthExpense: thisMonthExpense.total || 0,
    };
  }
}

const db = new ConsolidatedDatabase();

// Consolidated Bot class
class FinanceBot {
  private bot: TelegramBot;
  private adminId: number;
  private userStates: Map<number, any> = new Map();

  constructor(bot: TelegramBot, adminId: number) {
    this.bot = bot;
    this.adminId = adminId;
  }

  // Parse amount with K support (e.g., "100K" = 100000)
  private parseAmount(amountStr: string): number | null {
    const cleanStr = amountStr.trim().toUpperCase();
    const match = cleanStr.match(/^(\d+(?:\.\d+)?)(K?)$/);
    if (!match) return null;

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return null;

    return match[2] === "K" ? amount * 1000 : amount;
  }

  // Show main menu with reply keyboard
  async showMainMenu(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const keyboard = {
      reply_markup: {
        keyboard: [
          ["💰 Add Income", "💸 Add Expense"],
          ["💳 Balance", "📊 Statistics"],
          ["📝 Recent", "📂 Categories"],
          ["➕ Add Category", "❓ Help"],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };

    await this.bot.sendMessage(
      chatId,
      "💰 *Finance Bot Main Menu*\n\nChoose an option below:",
      { parse_mode: "Markdown", ...keyboard },
    );
  }

  // Handle amount input
  async handleAmountInput(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) return;

    const userState = this.userStates.get(userId);
    if (!userState || userState.action !== "waiting_amount") return;

    const amount = this.parseAmount(text);
    if (amount === null) {
      await this.bot.sendMessage(
        chatId,
        "❌ *Invalid amount*\n\nPlease enter a valid number (e.g., 100, 50.5, 100K for 100,000)",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // Store amount and ask for description
    userState.amount = amount;
    userState.action = "waiting_description";
    this.userStates.set(userId, userState);

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Skip Description", callback_data: "skip_description" }],
        ],
      },
    };

    await this.bot.sendMessage(
      chatId,
      `💵 *Amount: ${amount.toLocaleString()}*\n\nEnter description (optional):`,
      { parse_mode: "Markdown", ...keyboard },
    );
  }

  // Handle description input
  async handleDescriptionInput(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId) return;

    const userState = this.userStates.get(userId);
    if (!userState || userState.action !== "waiting_description") return;

    userState.description = text || "";
    this.userStates.set(userId, userState);

    // Show category selection
    await this.showCategorySelection(
      chatId,
      userId,
      userState.type,
      userState.amount,
      userState.description,
    );
  }

  // Show category selection
  async showCategorySelection(
    chatId: number,
    userId: number,
    type: "income" | "expense",
    amount: number,
    description: string,
  ): Promise<void> {
    try {
      const categories = await db.getCategories(userId, type);

      if (categories.length === 0) {
        await this.bot.sendMessage(
          chatId,
          `❌ *No categories found*\n\nPlease add a ${type} category first.`,
          { parse_mode: "Markdown" },
        );
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: categories.map((cat) => [
            {
              text: `${cat.icon} ${cat.name}`,
              callback_data: `select_category_${type}_${cat.id}_${amount}_${description}`,
            },
          ]),
        },
      };

      await this.bot.sendMessage(
        chatId,
        `${type === "income" ? "💰" : "💸"} *Select Category*\n\nAmount: ${amount.toLocaleString()}\nDescription: ${description || "No description"}`,
        { parse_mode: "Markdown", ...keyboard },
      );
    } catch (error) {
      logger.error("Error showing category selection:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  // Handle callback queries
  async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = msg.chat.id;

    if (!msg || !data) return;

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id);

      if (data === "skip_description") {
        const userState = this.userStates.get(userId);
        if (userState) {
          userState.description = "";
          this.userStates.set(userId, userState);
          await this.showCategorySelection(
            chatId,
            userId,
            userState.type,
            userState.amount,
            "",
          );
        }
      } else if (data.startsWith("select_category_")) {
        await this.handleCategorySelection(data, chatId, userId);
      } else if (data.startsWith("add_category_type_")) {
        await this.handleAddCategoryType(data, chatId, userId);
      }
    } catch (error) {
      logger.error("Error handling callback query:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  // Handle category selection
  async handleCategorySelection(
    data: string,
    chatId: number,
    userId: number,
  ): Promise<void> {
    const parts = data.split("_");
    const type = parts[2] as "income" | "expense";
    const categoryId = parseInt(parts[3]);
    const amount = parseFloat(parts[4]);
    const description = parts.slice(5).join("_") || "";

    try {
      const categories = await db.getCategories(userId, type);
      const selectedCategory = categories.find((cat) => cat.id === categoryId);

      if (selectedCategory) {
        await db.addTransaction(
          type,
          amount,
          selectedCategory.name,
          description,
          userId,
        );

        await this.bot.sendMessage(
          chatId,
          `✅ *${type === "income" ? "Income" : "Expense"} Added!*\n\n` +
            `${type === "income" ? "💰" : "💸"} Amount: ${amount.toLocaleString()}\n` +
            `📂 Category: ${selectedCategory.icon} ${selectedCategory.name}\n` +
            `📝 Description: ${description || "No description"}`,
          { parse_mode: "Markdown" },
        );
      }

      // Clear user state
      this.userStates.delete(userId);
    } catch (error) {
      logger.error("Error handling category selection:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Failed to add transaction. Please try again.",
      );
    }
  }

  // Show balance
  async showBalance(chatId: number, userId: number): Promise<void> {
    try {
      const stats = await db.getFinanceStats(userId);
      const balanceText =
        `💳 *Current Balance*\n\n` +
        `💰 *Total Income:* ${stats.totalIncome.toLocaleString()}\n` +
        `💸 *Total Expenses:* ${stats.totalExpense.toLocaleString()}\n` +
        `💳 *Balance:* ${stats.balance.toLocaleString()}\n\n` +
        `📊 *This Month:*\n` +
        `💰 Income: ${stats.thisMonthIncome.toLocaleString()}\n` +
        `💸 Expenses: ${stats.thisMonthExpense.toLocaleString()}\n` +
        `💳 Net: ${(stats.thisMonthIncome - stats.thisMonthExpense).toLocaleString()}`;

      await this.bot.sendMessage(chatId, balanceText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error showing balance:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch balance. Please try again.",
      );
    }
  }

  // Show statistics
  async showStats(chatId: number, userId: number): Promise<void> {
    try {
      const stats = await db.getFinanceStats(userId);
      const statsText =
        `📊 *Finance Statistics*\n\n` +
        `💰 *Total Income:* ${stats.totalIncome.toLocaleString()}\n` +
        `💸 *Total Expenses:* ${stats.totalExpense.toLocaleString()}\n` +
        `💳 *Balance:* ${stats.balance.toLocaleString()}\n\n` +
        `📅 *This Month:*\n` +
        `💰 Income: ${stats.thisMonthIncome.toLocaleString()}\n` +
        `💸 Expenses: ${stats.thisMonthExpense.toLocaleString()}`;

      await this.bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error showing stats:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch statistics. Please try again.",
      );
    }
  }

  // Show recent transactions
  async showRecentTransactions(chatId: number, userId: number): Promise<void> {
    try {
      const transactions = await db.getTransactions(userId, 10);

      if (transactions.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "📝 *Recent Transactions*\n\nNo transactions found. Start by adding income or expense!",
          { parse_mode: "Markdown" },
        );
        return;
      }

      let recentText = `📝 *Recent ${transactions.length} Transactions*\n\n`;

      transactions.forEach((transaction, index) => {
        const icon = transaction.type === "income" ? "💰" : "💸";
        const date = new Date(transaction.date).toLocaleDateString();
        recentText += `${index + 1}. ${icon} ${transaction.amount.toLocaleString()} - ${transaction.category}\n`;
        recentText += `   📅 ${date}\n`;
        if (transaction.description) {
          recentText += `   📝 ${transaction.description}\n`;
        }
        recentText += "\n";
      });

      await this.bot.sendMessage(chatId, recentText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error showing recent transactions:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch recent transactions. Please try again.",
      );
    }
  }

  // Show categories
  async showCategories(chatId: number, userId: number): Promise<void> {
    try {
      const incomeCategories = await db.getCategories(userId, "income");
      const expenseCategories = await db.getCategories(userId, "expense");

      let categoriesText = `📂 *Categories*\n\n`;

      if (incomeCategories.length > 0) {
        categoriesText += `💰 *Income Categories:*\n`;
        incomeCategories.forEach((cat, index) => {
          categoriesText += `${index + 1}. ${cat.icon} ${cat.name}\n`;
        });
        categoriesText += "\n";
      }

      if (expenseCategories.length > 0) {
        categoriesText += `💸 *Expense Categories:*\n`;
        expenseCategories.forEach((cat, index) => {
          categoriesText += `${index + 1}. ${cat.icon} ${cat.name}\n`;
        });
      }

      categoriesText +=
        "\n💡 *Tip:* Use the main menu to add custom categories!";

      await this.bot.sendMessage(chatId, categoriesText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error showing categories:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch categories. Please try again.",
      );
    }
  }

  // Show add category options
  async showAddCategoryOptions(chatId: number, userId: number): Promise<void> {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💰 Income Category",
              callback_data: "add_category_type_income",
            },
            {
              text: "💸 Expense Category",
              callback_data: "add_category_type_expense",
            },
          ],
        ],
      },
    };

    await this.bot.sendMessage(
      chatId,
      "📂 *Add Category*\n\nSelect category type:",
      { parse_mode: "Markdown", ...keyboard },
    );
  }

  // Handle add category type selection
  async handleAddCategoryType(
    data: string,
    chatId: number,
    userId: number,
  ): Promise<void> {
    const type = data.split("_").pop() as "income" | "expense";
    const userState = { action: "waiting_category_name", type };
    this.userStates.set(userId, userState);

    await this.bot.sendMessage(
      chatId,
      `📂 *Add ${type === "income" ? "Income" : "Expense"} Category*\n\nEnter category name:`,
      { parse_mode: "Markdown" },
    );
  }

  // Handle category name input
  async handleCategoryNameInput(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) return;

    const userState = this.userStates.get(userId);
    if (!userState || userState.action !== "waiting_category_name") return;

    try {
      await db.addCategory(text, userState.type, userId);
      const icon = userState.type === "income" ? "💰" : "💸";

      await this.bot.sendMessage(
        chatId,
        `${icon} *Category Added!*\n\n${icon} ${text} (${userState.type}) has been added to your categories.`,
        { parse_mode: "Markdown" },
      );

      this.userStates.delete(userId);
    } catch (error) {
      logger.error("Error adding category:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Failed to add category. It might already exist.",
      );
    }
  }

  // Show help
  async showHelp(chatId: number): Promise<void> {
    const helpText =
      `💰 *Finance Bot Help*\n\n` +
      `📊 *Features:*\n` +
      `• 💰 Add Income\n` +
      `• 💸 Add Expenses\n` +
      `• 💳 View Balance\n` +
      `• 📊 Statistics\n` +
      `• 📝 Recent Transactions\n` +
      `• 📂 Manage Categories\n\n` +
      `💡 *Amount Input:*\n` +
      `• Enter numbers like: 100, 50.5\n` +
      `• Use K for thousands: 100K = 100,000\n\n` +
      `🚀 *Getting Started:*\n` +
      `1. Use the main menu buttons\n` +
      `2. Add income and expenses\n` +
      `3. Track your finances!`;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }
}

// Create bot and initialize
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

const financeBot = new FinanceBot(bot, adminId);

// Initialize database
db.init()
  .then(() => {
    logger.info("Database initialized successfully");
  })
  .catch((error) => {
    logger.error("Failed to initialize database:", error);
  });

// Handle messages
bot.on("message", async (msg) => {
  try {
    const userId = msg.from?.id;
    if (!userId) return;

    // Add/update user
    await db.addUser(
      userId,
      msg.from.username,
      msg.from.first_name,
      msg.from.last_name,
    );
    await db.updateUserStats(userId);

    const messageText = msg.text;
    if (!messageText) return;

    // Handle start command
    if (messageText === "/start") {
      await financeBot.showMainMenu(msg);
      return;
    }

    // Handle main menu buttons
    if (messageText === "💰 Add Income") {
      const userState = { action: "waiting_amount", type: "income" as const };
      financeBot["userStates"].set(userId, userState);

      await bot.sendMessage(
        msg.chat.id,
        "💰 *Add Income*\n\nEnter amount (e.g., 100, 50.5, 100K for 100,000):",
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (messageText === "💸 Add Expense") {
      const userState = { action: "waiting_amount", type: "expense" as const };
      financeBot["userStates"].set(userId, userState);

      await bot.sendMessage(
        msg.chat.id,
        "💸 *Add Expense*\n\nEnter amount (e.g., 100, 50.5, 100K for 100,000):",
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (messageText === "💳 Balance") {
      await financeBot.showBalance(msg.chat.id, userId);
      return;
    }

    if (messageText === "📊 Statistics") {
      await financeBot.showStats(msg.chat.id, userId);
      return;
    }

    if (messageText === "📝 Recent") {
      await financeBot.showRecentTransactions(msg.chat.id, userId);
      return;
    }

    if (messageText === "📂 Categories") {
      await financeBot.showCategories(msg.chat.id, userId);
      return;
    }

    if (messageText === "➕ Add Category") {
      await financeBot.showAddCategoryOptions(msg.chat.id, userId);
      return;
    }

    if (messageText === "❓ Help") {
      await financeBot.showHelp(msg.chat.id);
      return;
    }

    // Handle text input based on user state
    const userState = financeBot["userStates"].get(userId);
    if (userState) {
      if (userState.action === "waiting_amount") {
        await financeBot.handleAmountInput(msg);
      } else if (userState.action === "waiting_description") {
        await financeBot.handleDescriptionInput(msg);
      } else if (userState.action === "waiting_category_name") {
        await financeBot.handleCategoryNameInput(msg);
      }
      return;
    }

    // Default response
    await financeBot.showMainMenu(msg);
  } catch (error) {
    logger.error("Error handling message:", error);
    await bot.sendMessage(
      msg.chat.id,
      "❌ An error occurred. Please try again.",
    );
  }
});

// Handle callback queries
bot.on("callback_query", async (callbackQuery) => {
  await financeBot.handleCallbackQuery(callbackQuery);
});

console.log("✅ Finance Bot is running!");
