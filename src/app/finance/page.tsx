"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Filter,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

interface FinanceStats {
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

export default function FinanceDashboard() {
  const [stats, setStats] = useState<FinanceStats>({
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

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "",
    description: "",
    userId: "123456789", // Default user ID - in real app this would come from auth
  });

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch(
        `/api/finance/stats?userId=${formData.userId}`,
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch recent transactions
      const transactionsResponse = await fetch(
        `/api/finance/transactions?userId=${formData.userId}&limit=10`,
      );
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.category) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (response.ok) {
        // Reset form
        setFormData({
          ...formData,
          amount: "",
          category: "",
          description: "",
        });
        setShowAddForm(false);

        // Refresh data
        fetchFinanceData();

        alert("Transaction added successfully!");
      } else {
        alert("Failed to add transaction");
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const monthlyChange = stats.thisMonthIncome - stats.lastMonthIncome;
  const expenseChange = stats.thisMonthExpense - stats.lastMonthExpense;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            💰 Finance Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Track your income, expenses, and financial goals
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Balance
                </p>
                <p
                  className={`text-2xl font-bold ${stats.balance >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(stats.balance)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Income
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalIncome)}
                </p>
                {monthlyChange !== 0 && (
                  <p
                    className={`text-xs mt-1 ${monthlyChange > 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {monthlyChange > 0 ? "+" : ""}
                    {formatCurrency(monthlyChange)} this month
                  </p>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Expenses
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats.totalExpense)}
                </p>
                {expenseChange !== 0 && (
                  <p
                    className={`text-xs mt-1 ${expenseChange > 0 ? "text-red-500" : "text-green-500"}`}
                  >
                    {expenseChange > 0 ? "+" : ""}
                    {formatCurrency(expenseChange)} this month
                  </p>
                )}
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Transactions
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.transactionCount}
                </p>
              </div>
              <PieChart className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </button>

              <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </button>
            </div>

            <div className="flex gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                Top Income: {stats.topIncomeCategory}
              </div>
              <div className="flex items-center">
                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                Top Expense: {stats.topExpenseCategory}
              </div>
            </div>
          </div>
        </div>

        {/* Add Transaction Form */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Transaction
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as "income" | "expense",
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="expense">💸 Expense</option>
                    <option value="income">💰 Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., Food, Salary, Transport"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Transactions
            </h3>
          </div>

          {transactions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="mb-4">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto" />
              </div>
              <p>No transactions yet</p>
              <p className="text-sm mt-2">
                Start by adding your first income or expense!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-full ${
                          transaction.type === "income"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {transaction.category}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.description || "No description"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            💡 Finance Bot Commands
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-2">Basic Commands:</p>
              <ul className="space-y-1">
                <li>
                  •{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    /income 5000 Salary
                  </code>{" "}
                  - Add income
                </li>
                <li>
                  •{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    /expense 50 Groceries
                  </code>{" "}
                  - Add expense
                </li>
                <li>
                  • <code className="bg-blue-100 px-1 rounded">/balance</code> -
                  Check balance
                </li>
                <li>
                  • <code className="bg-blue-100 px-1 rounded">/stats</code> -
                  View statistics
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">Management:</p>
              <ul className="space-y-1">
                <li>
                  • <code className="bg-blue-100 px-1 rounded">/recent 10</code>{" "}
                  - Recent transactions
                </li>
                <li>
                  •{" "}
                  <code className="bg-blue-100 px-1 rounded">/categories</code>{" "}
                  - List categories
                </li>
                <li>
                  •{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    /addcategory income Freelance
                  </code>
                </li>
                <li>
                  • <code className="bg-blue-100 px-1 rounded">/fhelp</code> -
                  Finance help
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
