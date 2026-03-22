"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Users,
  MessageSquare,
  Activity,
  Send,
  Settings,
} from "lucide-react";

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<"offline" | "online">("offline");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    activeChats: 0,
  });
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkBotStatus = async () => {
    try {
      const response = await fetch("/api/bot/status");
      if (response.ok) {
        const data = await response.json();
        setBotStatus(data.status);
        setStats(data.stats);
      }
    } catch (error) {
      setBotStatus("offline");
    }
  };

  const startBot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/bot/start", { method: "POST" });
      if (response.ok) {
        setTimeout(checkBotStatus, 2000);
      }
    } catch (error) {
      console.error("Failed to start bot:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/bot/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastMessage }),
      });

      if (response.ok) {
        setBroadcastMessage("");
        alert("Broadcast sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      alert("Failed to send broadcast");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Telegram Bot Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage and monitor your Telegram bot
          </p>
        </div>

        {/* Bot Status */}
        <div className="mb-8">
          <div
            className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              botStatus === "online"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                botStatus === "online" ? "bg-green-400" : "bg-red-400"
              }`}
            />
            Bot {botStatus === "online" ? "Online" : "Offline"}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Messages
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalMessages}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Today
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeChats}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot Controls */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Bot Controls
            </h2>
            <div className="space-y-4">
              <button
                onClick={startBot}
                disabled={botStatus === "online" || isLoading}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                <Bot className="h-4 w-4 mr-2" />
                {isLoading
                  ? "Starting..."
                  : botStatus === "online"
                    ? "Bot Running"
                    : "Start Bot"}
              </button>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Next Steps:</strong>
                </p>
                <ol className="text-sm text-gray-600 mt-1 list-decimal list-inside">
                  <li>Create a bot with @BotFather on Telegram</li>
                  <li>Copy your bot token</li>
                  <li>Create .env.local with your token</li>
                  <li>Get your Telegram User ID for admin access</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Broadcast */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Broadcast Message
            </h2>
            <div className="space-y-4">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter message to broadcast to all users..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
              />
              <button
                onClick={sendBroadcast}
                disabled={
                  !broadcastMessage.trim() ||
                  botStatus !== "online" ||
                  isLoading
                }
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                <Send className="h-4 w-4 mr-2" />
                {isLoading ? "Sending..." : "Send Broadcast"}
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Setup Instructions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-2">1. Create .env.local file:</p>
              <code className="block bg-blue-100 p-2 rounded text-xs">
                TELEGRAM_BOT_TOKEN=your_token_here
                <br />
                ADMIN_ID=your_telegram_id
                <br />
                NEXT_PUBLIC_APP_URL=http://localhost:3000
              </code>
            </div>
            <div>
              <p className="font-medium mb-2">2. Start the bot:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click "Start Bot" button above</li>
                <li>
                  Or run:{" "}
                  <code className="bg-blue-100 px-1 rounded">npm run bot</code>
                </li>
                <li>Bot will run in background automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
