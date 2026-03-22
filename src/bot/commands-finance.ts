import TelegramBot from "node-telegram-bot-api";
import { financeDB } from "./database-finance";
import logger from "./logger";

export class FinanceCommands {
  private bot: TelegramBot;
  private adminId: number;

  constructor(bot: TelegramBot, adminId: number) {
    this.bot = bot;
    this.adminId = adminId;
  }

  // Basic finance commands
  async incomeCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!match || !match[1]) {
      await this.showIncomeHelp(chatId);
      return;
    }

    const parts = match[1].trim().split(" ");
    if (parts.length < 2) {
      await this.showIncomeHelp(chatId);
      return;
    }

    const amount = parseFloat(parts[0]);
    const description = parts.slice(1).join(" ");

    if (isNaN(amount) || amount <= 0) {
      await this.bot.sendMessage(
        chatId,
        "❌ *Invalid amount*\n\nPlease enter a valid positive number.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    try {
      // Get income categories
      const categories = await financeDB.getCategories(userId || 0, "income");

      if (categories.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "💰 *Add Income*\n\nNo income categories found. Please add a category first using /addcategory.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      // Create category selection keyboard
      const keyboard = {
        reply_markup: {
          inline_keyboard: categories.map((cat) => [
            {
              text: `${cat.icon} ${cat.name}`,
              callback_data: `income_select_${amount}_${cat.id}`,
            },
          ]),
        },
      };

      await this.bot.sendMessage(
        chatId,
        `💰 *Select Category for $${amount.toFixed(2)}*\n\nDescription: ${description}`,
        { parse_mode: "Markdown", ...keyboard },
      );

      // Store transaction data temporarily
      await this.storeTempData(userId || 0, "income", { amount, description });
    } catch (error) {
      logger.error("Error in income command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  async expenseCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!match || !match[1]) {
      await this.showExpenseHelp(chatId);
      return;
    }

    const parts = match[1].trim().split(" ");
    if (parts.length < 2) {
      await this.showExpenseHelp(chatId);
      return;
    }

    const amount = parseFloat(parts[0]);
    const description = parts.slice(1).join(" ");

    if (isNaN(amount) || amount <= 0) {
      await this.bot.sendMessage(
        chatId,
        "❌ *Invalid amount*\n\nPlease enter a valid positive number.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    try {
      // Get expense categories
      const categories = await financeDB.getCategories(userId || 0, "expense");

      if (categories.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "💸 *Add Expense*\n\nNo expense categories found. Please add a category first using /addcategory.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      // Create category selection keyboard
      const keyboard = {
        reply_markup: {
          inline_keyboard: categories.map((cat) => [
            {
              text: `${cat.icon} ${cat.name}`,
              callback_data: `expense_select_${amount}_${cat.id}`,
            },
          ]),
        },
      };

      await this.bot.sendMessage(
        chatId,
        `💸 *Select Category for $${amount.toFixed(2)}*\n\nDescription: ${description}`,
        { parse_mode: "Markdown", ...keyboard },
      );

      // Store transaction data temporarily
      await this.storeTempData(userId || 0, "expense", { amount, description });
    } catch (error) {
      logger.error("Error in expense command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  async balanceCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      const stats = await financeDB.getFinanceStats(userId || 0);

      const balanceText =
        `💳 *Current Balance*\n\n` +
        `💰 *Total Income:* $${stats.totalIncome.toFixed(2)}\n` +
        `💸 *Total Expenses:* $${stats.totalExpense.toFixed(2)}\n` +
        `💳 *Balance:* $${stats.balance.toFixed(2)}\n\n` +
        `📊 *This Month:*\n` +
        `💰 Income: $${stats.thisMonthIncome.toFixed(2)}\n` +
        `💸 Expenses: $${stats.thisMonthExpense.toFixed(2)}\n` +
        `💳 Net: $${(stats.thisMonthIncome - stats.thisMonthExpense).toFixed(2)}`;

      await this.bot.sendMessage(chatId, balanceText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error in balance command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch balance. Please try again.",
      );
    }
  }

  async statsCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    const period = match?.[1] || "month";

    try {
      const stats = await financeDB.getFinanceStats(userId || 0, period);
      const categoryStats = await financeDB.getCategoryStats(
        userId || 0,
        period,
      );

      let statsText =
        `📊 *Finance Statistics (${period})*\n\n` +
        `💰 *Total Income:* $${stats.totalIncome.toFixed(2)}\n` +
        `💸 *Total Expenses:* $${stats.totalExpense.toFixed(2)}\n` +
        `💳 *Balance:* $${stats.balance.toFixed(2)}\n` +
        `📝 *Transactions:* ${stats.transactionCount}\n\n` +
        `🏆 *Top Categories:*`;

      const incomeCategories = categoryStats
        .filter((cat) => cat.type === "income")
        .slice(0, 3);
      const expenseCategories = categoryStats
        .filter((cat) => cat.type === "expense")
        .slice(0, 3);

      if (incomeCategories.length > 0) {
        statsText += "\n\n💰 *Income:*";
        incomeCategories.forEach((cat, index) => {
          statsText += `\n${index + 1}. ${cat.icon || "💰"} ${cat.category}: $${cat.total.toFixed(2)}`;
        });
      }

      if (expenseCategories.length > 0) {
        statsText += "\n\n💸 *Expenses:*";
        expenseCategories.forEach((cat, index) => {
          statsText += `\n${index + 1}. ${cat.icon || "💸"} ${cat.category}: $${cat.total.toFixed(2)}`;
        });
      }

      await this.bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("Error in stats command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch statistics. Please try again.",
      );
    }
  }

  async recentCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    const limit = match?.[1] ? parseInt(match[1]) : 10;
    const actualLimit = Math.min(Math.max(limit, 1), 50); // Between 1 and 50

    try {
      const transactions = await financeDB.getTransactions(
        userId || 0,
        actualLimit,
      );

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
        recentText += `${index + 1}. ${icon} $${transaction.amount.toFixed(2)} - ${transaction.category}\n`;
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
      logger.error("Error in recent command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch recent transactions. Please try again.",
      );
    }
  }

  async categoriesCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      const incomeCategories = await financeDB.getCategories(
        userId || 0,
        "income",
      );
      const expenseCategories = await financeDB.getCategories(
        userId || 0,
        "expense",
      );

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

      if (incomeCategories.length === 0 && expenseCategories.length === 0) {
        categoriesText +=
          "No categories found. Use /addcategory to create one!";
      }

      categoriesText +=
        "\n💡 *Tip:* Use /addcategory to create custom categories!";

      await this.bot.sendMessage(chatId, categoriesText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error in categories command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch categories. Please try again.",
      );
    }
  }

  async addCategoryCommand(
    msg: TelegramBot.Message,
    match: RegExpMatchArray | null,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!match || !match[1]) {
      await this.showAddCategoryHelp(chatId);
      return;
    }

    const parts = match[1].trim().split(" ");
    if (parts.length < 2) {
      await this.showAddCategoryHelp(chatId);
      return;
    }

    const type = parts[0].toLowerCase();
    const name = parts.slice(1).join(" ");

    if (!["income", "expense"].includes(type)) {
      await this.showAddCategoryHelp(chatId);
      return;
    }

    try {
      await financeDB.addCategory(
        name,
        type as "income" | "expense",
        userId || 0,
      );

      const icon = type === "income" ? "💰" : "💸";
      await this.bot.sendMessage(
        chatId,
        `${icon} *Category Added!*\n\n${icon} ${name} (${type}) has been added to your categories.`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      logger.error("Error in addcategory command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Failed to add category. It might already exist.",
      );
    }
  }

  async budgetCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      const budgetStatus = await financeDB.getBudgetStatus(userId || 0);

      if (budgetStatus.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "📊 *Budget Status*\n\nNo budgets set. Use /setbudget to create a budget!",
          { parse_mode: "Markdown" },
        );
        return;
      }

      let budgetText = `📊 *Budget Status*\n\n`;

      budgetStatus.forEach((budget) => {
        const percentage = Math.round((budget.spent / budget.amount) * 100);
        const statusIcon = budget.isOverBudget
          ? "🔴"
          : percentage > 80
            ? "🟡"
            : "🟢";

        budgetText += `${statusIcon} ${budget.icon} ${budget.category_name}\n`;
        budgetText += `   💰 Budget: $${budget.amount.toFixed(2)}\n`;
        budgetText += `   💸 Spent: $${budget.spent.toFixed(2)}\n`;
        budgetText += `   📊 ${percentage}% used\n`;
        budgetText += `   💳 Remaining: $${budget.remaining.toFixed(2)}\n\n`;
      });

      await this.bot.sendMessage(chatId, budgetText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error in budget command:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Unable to fetch budget status. Please try again.",
      );
    }
  }

  async helpCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const helpText =
      `💰 *Finance Bot Commands*\n\n` +
      `📊 *View & Track:*\n` +
      `/balance - Show current balance\n` +
      `/stats [period] - Finance statistics (month/year)\n` +
      `/recent [count] - Recent transactions\n` +
      `/categories - List all categories\n` +
      `/budget - Show budget status\n\n` +
      `💰 *Add Transactions:*\n` +
      `/income <amount> <description> - Add income\n` +
      `/expense <amount> <description> - Add expense\n\n` +
      `📂 *Manage Categories:*\n` +
      `/addcategory <type> <name> - Add category\n` +
      `Types: income, expense\n\n` +
      `💡 *Examples:*\n` +
      `/income 5000 Salary for March\n` +
      `/expense 50 Grocery shopping\n` +
      `/addcategory income Freelance\n` +
      `/stats year\n` +
      `/recent 5`;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  // Helper methods
  private async showIncomeHelp(chatId: number): Promise<void> {
    const helpText =
      `💰 *Add Income*\n\n` +
      `Usage: \`/income <amount> <description>\`\n\n` +
      `Examples:\n` +
      `• /income 5000 Salary for March\n` +
      `• /income 250 Freelance project\n` +
      `• /income 100 Gift from friend`;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  private async showExpenseHelp(chatId: number): Promise<void> {
    const helpText =
      `💸 *Add Expense*\n\n` +
      `Usage: \`/expense <amount> <description>\`\n\n` +
      `Examples:\n` +
      `• /expense 50 Grocery shopping\n` +
      `• /expense 25 Gas for car\n` +
      `• /expense 15 Coffee with friends`;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  private async showAddCategoryHelp(chatId: number): Promise<void> {
    const helpText =
      `📂 *Add Category*\n\n` +
      `Usage: \`/addcategory <type> <name>\`\n\n` +
      `Types: income, expense\n\n` +
      `Examples:\n` +
      `• /addcategory income Freelance\n` +
      `• /addcategory expense Transportation\n` +
      `• /addcategory income Investment\n` +
      `• /addcategory expense Entertainment`;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  private async storeTempData(
    userId: number,
    type: string,
    data: any,
  ): Promise<void> {
    // This is a simplified version - in production, you'd use Redis or a temp table
    // For now, we'll store it in memory (this will be lost on restart)
    if (!global.tempFinanceData) {
      global.tempFinanceData = {};
    }
    global.tempFinanceData[userId] = { type, data, timestamp: Date.now() };
  }

  private getTempData(userId: number): any {
    if (!global.tempFinanceData) return null;
    return global.tempFinanceData[userId];
  }

  private clearTempData(userId: number): void {
    if (global.tempFinanceData) {
      delete global.tempFinanceData[userId];
    }
  }

  // Handle callback queries for category selection
  async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (!msg || !data) return;

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id);

      if (data.startsWith("income_select_")) {
        const parts = data.split("_");
        const amount = parseFloat(parts[2]);
        const categoryId = parseInt(parts[3]);

        const tempData = this.getTempData(userId);
        if (!tempData || tempData.type !== "income") return;

        const category = await financeDB.getCategories(userId, "income");
        const selectedCategory = category.find((cat) => cat.id === categoryId);

        if (selectedCategory) {
          await financeDB.addTransaction(
            "income",
            amount,
            selectedCategory.name,
            tempData.data.description,
            userId,
          );

          await this.bot.sendMessage(
            msg.chat.id,
            `✅ *Income Added!*\n\n` +
              `💰 Amount: $${amount.toFixed(2)}\n` +
              `📂 Category: ${selectedCategory.icon} ${selectedCategory.name}\n` +
              `📝 Description: ${tempData.data.description}`,
            { parse_mode: "Markdown" },
          );
        }

        this.clearTempData(userId);
      } else if (data.startsWith("expense_select_")) {
        const parts = data.split("_");
        const amount = parseFloat(parts[2]);
        const categoryId = parseInt(parts[3]);

        const tempData = this.getTempData(userId);
        if (!tempData || tempData.type !== "expense") return;

        const category = await financeDB.getCategories(userId, "expense");
        const selectedCategory = category.find((cat) => cat.id === categoryId);

        if (selectedCategory) {
          await financeDB.addTransaction(
            "expense",
            amount,
            selectedCategory.name,
            tempData.data.description,
            userId,
          );

          await this.bot.sendMessage(
            msg.chat.id,
            `✅ *Expense Added!*\n\n` +
              `💸 Amount: $${amount.toFixed(2)}\n` +
              `📂 Category: ${selectedCategory.icon} ${selectedCategory.name}\n` +
              `📝 Description: ${tempData.data.description}`,
            { parse_mode: "Markdown" },
          );
        }

        this.clearTempData(userId);
      }
    } catch (error) {
      logger.error("Error handling callback query:", error);
      await this.bot.sendMessage(
        msg.chat.id,
        "❌ An error occurred. Please try again.",
      );
    }
  }
}

// Type declaration for global temp data
declare global {
  var tempFinanceData: Record<string, any> | undefined;
}
