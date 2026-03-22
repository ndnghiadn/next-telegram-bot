"use client";

import { useState, useEffect } from "react";

export default function BotControl() {
  const [isRunning, setIsRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const response = await fetch("/api/bot/start");
      const data = await response.json();
      if (data.success) {
        setIsRunning(data.isRunning);
        setPid(data.pid);
      }
    } catch (error) {
      console.error("Error checking bot status:", error);
    }
  };

  const startBot = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bot/start", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setIsRunning(true);
        setPid(data.pid);
        alert("Bot started successfully!");
      } else {
        alert(data.error || "Failed to start bot");
      }
    } catch (error) {
      console.error("Error starting bot:", error);
      alert("Error starting bot");
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bot/start", {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setIsRunning(false);
        setPid(null);
        alert("Bot stopped successfully!");
      } else {
        alert(data.error || "Failed to stop bot");
      }
    } catch (error) {
      console.error("Error stopping bot:", error);
      alert("Error stopping bot");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bot Control</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Status:</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isRunning
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {isRunning ? "Running" : "Stopped"}
            </span>
          </div>
          {pid && <div className="mt-2 text-sm text-gray-600">PID: {pid}</div>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={startBot}
            disabled={isRunning || loading}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              isRunning || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? "Starting..." : "Start Bot"}
          </button>

          <button
            onClick={stopBot}
            disabled={!isRunning || loading}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              !isRunning || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {loading ? "Stopping..." : "Stop Bot"}
          </button>
        </div>

        <button
          onClick={checkStatus}
          disabled={loading}
          className="w-full mt-3 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
        >
          Refresh Status
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="font-medium text-blue-900 mb-2">Instructions:</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Start Bot" to run the Telegram bot</li>
          <li>• Status updates automatically every 5 seconds</li>
          <li>• Click "Stop Bot" to terminate the process</li>
          <li>• Bot process runs in background</li>
        </ul>
      </div>
    </div>
  );
}
