import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";

export interface Transaction {
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

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  user_id: number;
  color: string;
  icon: string;
  created_at: string;
}

export interface Budget {
  id: number;
  category_id: number;
  amount: number;
  period: "daily" | "weekly" | "monthly" | "yearly";
  user_id: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  topIncomeCategory: string;
  topExpenseCategory: string;
  thisMonthIncome: number;
  thisMonthExpense: number;
  lastMonthIncome: number;
  lastMonthExpense: number;
}

class FinanceDatabase {
  private db: Database | null = null;

  async init(): Promise<void> {
    const dbPath = path.join(process.cwd(), "data", "finance.db");

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

      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL CHECK(amount > 0),
        period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly', 'yearly')),
        user_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
    `);

    // Insert default categories for new users
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

    // Get all users to add default categories for each
    const users = await this.db.all(
      "SELECT DISTINCT user_id FROM transactions WHERE user_id > 0",
    );

    for (const user of users) {
      const userId = user.user_id;

      // Insert default income categories
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

      // Insert default expense categories
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

  // Transaction methods
  async addTransaction(
    type: "income" | "expense",
    amount: number,
    category: string,
    description: string,
    userId: number,
    date?: string,
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const transactionDate = date || new Date().toISOString();

    const result = await this.db.run(
      "INSERT INTO transactions (type, amount, category, description, user_id, date) VALUES (?, ?, ?, ?, ?, ?)",
      [type, amount, category, description, userId, transactionDate],
    );

    return result.lastID || 0;
  }

  async getTransactions(
    userId: number,
    limit: number = 50,
    offset: number = 0,
    type?: "income" | "expense",
    category?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Transaction[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = "SELECT * FROM transactions WHERE user_id = ?";
    const params: any[] = [userId];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }

    query += " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const transactions = await this.db.all(query, params);
    return transactions as Transaction[];
  }

  async updateTransaction(
    id: number,
    type?: "income" | "expense",
    amount?: number,
    category?: string,
    description?: string,
    date?: string,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const updates: string[] = [];
    const params: any[] = [];

    if (type) {
      updates.push("type = ?");
      params.push(type);
    }

    if (amount !== undefined) {
      updates.push("amount = ?");
      params.push(amount);
    }

    if (category) {
      updates.push("category = ?");
      params.push(category);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }

    if (date) {
      updates.push("date = ?");
      params.push(date);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await this.db.run(
      `UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );
  }

  async deleteTransaction(id: number, userId: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ]);
  }

  // Category methods
  async addCategory(
    name: string,
    type: "income" | "expense",
    userId: number,
    icon: string = "💰",
    color: string = "#6366f1",
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.run(
      "INSERT INTO categories (name, type, user_id, icon, color) VALUES (?, ?, ?, ?, ?)",
      [name, type, userId, icon, color],
    );

    return result.lastID || 0;
  }

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

  async deleteCategory(id: number, userId: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ]);
  }

  // Statistics methods
  async getFinanceStats(
    userId: number,
    period: string = "month",
  ): Promise<FinanceStats> {
    if (!this.db) throw new Error("Database not initialized");

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
    const totalIncome = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income"',
      [userId],
    );

    const totalExpense = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense"',
      [userId],
    );

    const transactionCount = await this.db.get(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?",
      [userId],
    );

    // This month stats
    const thisMonthIncome = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income" AND date >= ?',
      [userId, startDate.toISOString()],
    );

    const thisMonthExpense = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense" AND date >= ?',
      [userId, startDate.toISOString()],
    );

    // Last month stats
    const lastMonthIncome = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "income" AND date >= ? AND date <= ?',
      [userId, lastMonthStart.toISOString(), lastMonthEnd.toISOString()],
    );

    const lastMonthExpense = await this.db.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "expense" AND date >= ? AND date <= ?',
      [userId, lastMonthStart.toISOString(), lastMonthEnd.toISOString()],
    );

    // Top categories
    const topIncomeCategory = await this.db.get(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "income" GROUP BY category ORDER BY total DESC LIMIT 1',
      [userId],
    );

    const topExpenseCategory = await this.db.get(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "expense" GROUP BY category ORDER BY total DESC LIMIT 1',
      [userId],
    );

    return {
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
  }

  async getCategoryStats(
    userId: number,
    period: string = "month",
  ): Promise<any[]> {
    if (!this.db) throw new Error("Database not initialized");

    const now = new Date();
    let startDate: Date;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const stats = await this.db.all(
      `SELECT 
        category, 
        type,
        SUM(amount) as total,
        COUNT(*) as count,
        c.icon,
        c.color
      FROM transactions t
      LEFT JOIN categories c ON t.category = c.name AND t.user_id = c.user_id
      WHERE t.user_id = ? AND t.date >= ?
      GROUP BY category, type
      ORDER BY total DESC`,
      [userId, startDate.toISOString()],
    );

    return stats;
  }

  // Budget methods
  async addBudget(
    categoryId: number,
    amount: number,
    period: "daily" | "weekly" | "monthly" | "yearly",
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.run(
      "INSERT INTO budgets (category_id, amount, period, user_id, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
      [categoryId, amount, period, userId, startDate, endDate],
    );

    return result.lastID || 0;
  }

  async getBudgets(userId: number): Promise<Budget[]> {
    if (!this.db) throw new Error("Database not initialized");

    const budgets = await this.db.all(
      "SELECT * FROM budgets WHERE user_id = ? AND end_date >= CURRENT_DATE ORDER BY created_at DESC",
      [userId],
    );

    return budgets as Budget[];
  }

  async getBudgetStatus(userId: number): Promise<any[]> {
    if (!this.db) throw new Error("Database not initialized");

    const budgets = await this.db.all(
      `SELECT 
        b.*,
        c.name as category_name,
        c.icon,
        c.color,
        COALESCE(SUM(t.amount), 0) as spent
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN transactions t ON t.category = c.name AND t.user_id = b.user_id 
        AND t.date >= b.start_date AND t.date <= b.end_date AND t.type = 'expense'
      WHERE b.user_id = ? AND b.end_date >= CURRENT_DATE
      GROUP BY b.id
      ORDER BY b.created_at DESC`,
      [userId],
    );

    return budgets.map((budget) => ({
      ...budget,
      remaining: budget.amount - (budget.spent || 0),
      percentage: Math.round(((budget.spent || 0) / budget.amount) * 100),
      isOverBudget: (budget.spent || 0) > budget.amount,
    }));
  }
}

export const financeDB = new FinanceDatabase();
