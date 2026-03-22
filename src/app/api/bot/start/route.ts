import { NextRequest, NextResponse } from "next/server";
import { spawn, exec } from "child_process";
import path from "path";
import fs from "fs";

// Global variable to track bot process
let botProcess: any = null;
let botPid: number | null = null;

// File to store bot PID
const PID_FILE = path.join(process.cwd(), "data", "bot.pid");

function savePid(pid: number) {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(PID_FILE, pid.toString());
  } catch (error) {
    console.error("Error saving PID:", error);
  }
}

function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const content = fs.readFileSync(PID_FILE, "utf8").trim();
      const pid = parseInt(content);
      if (!isNaN(pid)) {
        return pid;
      }
    }
  } catch (error) {
    console.error("Error reading PID:", error);
  }
  return null;
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    console.error("Error removing PID file:", error);
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    // On Windows, use tasklist to check if process is running
    const { execSync } = require("child_process");
    const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
      encoding: "utf8",
    });
    return output.includes(pid.toString());
  } catch (error) {
    return false;
  }
}

export async function POST() {
  try {
    // Check if bot is already running
    const existingPid = readPid();
    if (existingPid && isProcessRunning(existingPid)) {
      return NextResponse.json({
        success: false,
        error: "Bot is already running",
        pid: existingPid,
      });
    }

    // Kill existing process if it exists
    if (botProcess) {
      try {
        process.kill(-botProcess.pid);
      } catch (error) {
        // Process might already be dead
      }
    }

    // Start bot process using cmd on Windows
    const isWindows = process.platform === "win32";

    botProcess = spawn("npm", ["run", "bot"], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    botPid = botProcess.pid;
    if (botPid) {
      savePid(botPid);
    }

    // Handle process events
    botProcess.on("exit", (code: number, signal: string) => {
      console.log(`Bot process exited with code ${code} and signal ${signal}`);
      botProcess = null;
      botPid = null;
      removePidFile();
    });

    botProcess.on("error", (error: Error) => {
      console.error("Bot process error:", error);
      botProcess = null;
      botPid = null;
      removePidFile();
    });

    // Don't wait for the process to complete
    botProcess.unref();

    return NextResponse.json({
      success: true,
      message: "Bot started successfully",
      pid: botPid,
    });
  } catch (error) {
    console.error("Error starting bot:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start bot: " + (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const pid = readPid();
    const isRunning = pid ? isProcessRunning(pid) : false;

    return NextResponse.json({
      success: true,
      isRunning,
      pid,
    });
  } catch (error) {
    console.error("Error checking bot status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check bot status" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const pid = readPid();

    // Kill the specific PID if we have one
    if (pid && isProcessRunning(pid)) {
      console.log(`Killing bot process PID: ${pid}`);
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: "utf8" });
      } catch (error) {
        console.error("Failed to kill specific PID:", error);
      }
    }

    // Also find and kill any npm/node processes running our bot
    try {
      // Get all node processes with command line
      const output = execSync(
        "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /format:csv",
        { encoding: "utf8" },
      );
      const lines = output.split("\n");

      for (const line of lines) {
        if (line.includes("npm") && line.includes("run bot")) {
          const match = line.match(/(\d+)/);
          if (match) {
            const nodePid = parseInt(match[1]);
            try {
              console.log(`Killing npm bot process PID: ${nodePid}`);
              execSync(`taskkill /F /PID ${nodePid}`, { encoding: "utf8" });
            } catch (error) {
              console.error("Failed to kill npm process:", error);
            }
          }
        }
      }

      // Also kill any node processes that might be our ts-node bot
      const tsNodeOutput = execSync(
        "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /format:csv",
        { encoding: "utf8" },
      );
      const tsNodeLines = tsNodeOutput.split("\n");

      for (const line of tsNodeLines) {
        if (line.includes("ts-node") && line.includes("index-consolidated")) {
          const match = line.match(/(\d+)/);
          if (match) {
            const tsNodePid = parseInt(match[1]);
            try {
              console.log(`Killing ts-node bot process PID: ${tsNodePid}`);
              execSync(`taskkill /F /PID ${tsNodePid}`, { encoding: "utf8" });
            } catch (error) {
              console.error("Failed to kill ts-node process:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error finding processes to kill:", error);
    }

    // Clean up any remaining batch files
    try {
      const batchFile = path.join(process.cwd(), "start-bot.bat");
      if (fs.existsSync(batchFile)) {
        fs.unlinkSync(batchFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    removePidFile();

    return NextResponse.json({
      success: true,
      message: "Bot stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping bot:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to stop bot: " + (error as Error).message,
      },
      { status: 500 },
    );
  }
}
