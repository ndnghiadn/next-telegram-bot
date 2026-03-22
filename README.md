# 🚀 Advanced Next.js Telegram Bot Admin Dashboard

A powerful Next.js application with an enterprise-grade Telegram bot, featuring advanced user management, analytics, scheduled messaging, and comprehensive admin tools.

## ✨ Features

### 🤖 **Advanced Telegram Bot**
- **User Management**: Complete user database with statistics and permissions
- **Command Analytics**: Track all bot usage with detailed statistics
- **Admin System**: Role-based access control with admin-only commands
- **Scheduled Messages**: Cron-based message scheduling system
- **File Handling**: Upload/download support for multiple file types
- **Rate Limiting**: Anti-spam protection with configurable limits
- **Logging**: Comprehensive Winston-based logging system
- **Inline Keyboards**: Interactive bot interfaces with callback handling

### 📊 **Admin Dashboard**
- **Real-time Statistics**: Live bot metrics and user activity
- **User Management**: View, edit, and manage bot users
- **Message Broadcasting**: Send messages to all users
- **Command Analytics**: Detailed usage statistics and trends
- **File Management**: Handle file uploads and downloads
- **System Logs**: View bot activity and error logs

### 🛠 **Technical Features**
- **Database**: SQLite with complete ORM-like interface
- **TypeScript**: Full type safety throughout the application
- **Middleware**: Rate limiting, anti-spam, and user tracking
- **Scheduled Tasks**: Cron jobs for automated operations
- **Error Handling**: Comprehensive error catching and logging
- **Production Ready**: Docker and PM2 deployment configurations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd next-telegram-bot
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your tokens:
   # TELEGRAM_BOT_TOKEN=your_bot_token_here
   # ADMIN_ID=your_telegram_id_here
   ```

3. **Run the development server:**
   ```bash
   # Start the web dashboard
   npm run dev
   
   # In another terminal, start the advanced bot
   npm run bot
   ```

4. **Open your browser:**
   - Dashboard: http://localhost:3000
   - Bot commands: Start a chat with your bot on Telegram

## 📋 Bot Commands

### 👤 **User Commands**
- `/start` - Interactive welcome with inline keyboard
- `/help` - Complete command guide with role-based display
- `/info` - Bot and user information with statistics
- `/stats` - Global bot statistics and top commands
- `/mystats` - Personal usage statistics
- `/schedule <HH:MM> <message>` - Schedule messages
- `/time` - Current server time
- `/echo <message>` - Echo back your message
- `/upload` - File upload guide and instructions

### 🔧 **Admin Commands**
- `/admin` - Admin panel with inline controls
- `/users` - List all users with statistics
- `/broadcast <message>` - Send message to all users
- `/setadmin <user_id>` - Grant/revoke admin privileges
- `/logs` - View recent system logs
- `/stats_detailed` - Comprehensive analytics dashboard

### 📁 **File Features**
- **Supported Formats**: Images, documents, videos, archives
- **Automatic Detection**: File type identification and handling
- **Download Support**: File ID-based download system
- **Security**: File validation and safe handling

## 🏗 Architecture

### 📁 **Project Structure**
```
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/            # API routes for dashboard
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Dashboard page
│   └── bot/                # Telegram bot source
│       ├── index-upgraded.ts # Main bot logic
│       ├── database.ts     # SQLite database layer
│       ├── commands.ts     # Command handlers
│       ├── middleware.ts   # Rate limiting & auth
│       └── logger.ts       # Winston logging
├── data/                   # Database files
├── logs/                   # Log files
├── public/                 # Static assets
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # Docker image
├── ecosystem.config.js    # PM2 configuration
└── package.json           # Dependencies and scripts
```

### 🔧 **Core Components**

#### **Database Layer (`database.ts`)**
- SQLite database with TypeScript interfaces
- User management and statistics tracking
- Command usage analytics
- Scheduled message storage
- Comprehensive logging table

#### **Command System (`commands.ts`)**
- Modular command handlers
- Admin permission checks
- File upload/download processing
- Scheduled message management
- Cron job integration

#### **Middleware (`middleware.ts`)**
- Rate limiting (10 messages/minute)
- Anti-spam protection (20 messages/30s)
- User tracking and database updates
- Admin permission validation

#### **Logging (`logger.ts`)**
- Winston-based logging system
- File and console output
- Error tracking and debugging
- Production-ready log levels

## 🚀 Deployment

### **Docker (Recommended)**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f
```

### **PM2**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

### **Environment Variables**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_id_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📊 Features Overview

### **🔥 Advanced Features**
- ✅ User database with statistics
- ✅ Command usage tracking
- ✅ Admin permission system
- ✅ Scheduled messages (cron)
- ✅ File upload/download
- ✅ Rate limiting & anti-spam
- ✅ Comprehensive logging
- ✅ Inline keyboards & callbacks
- ✅ Real-time analytics
- ✅ Error handling & recovery

### **🛡 Security Features**
- Rate limiting per user
- Anti-spam detection
- File type validation
- Admin permission checks
- Input sanitization
- Error message filtering

### **📈 Analytics**
- Total users and messages
- Active user tracking
- Command usage statistics
- Daily/weekly reports
- User engagement metrics
- Performance monitoring

## 🔧 Development

### **Adding New Commands**
1. Add command handler in `commands.ts`:
```typescript
async newCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  
  await botDB.logCommand('/newcommand', userId || 0);
  await this.bot.sendMessage(chatId, 'New command response!');
}
```

2. Register in main bot file:
```typescript
case '/newcommand':
  await commands.newCommand(msg);
  break;
```

### **Database Queries**
```typescript
// Get user statistics
const user = await botDB.getUser(userId);
const stats = await botDB.getStats();
const commands = await botDB.getCommandStats(userId);
```

### **Logging**
```typescript
// Log events
logger.info('User action completed');
await botDB.log('user_action', 'Action description', userId);
```

## 📝 Roadmap

- [ ] Webhook support for better scalability
- [ ] Redis caching for performance
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] API rate limiting per command
- [ ] Plugin system for custom commands
- [ ] Chat group support
- [ ] Voice message handling

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions or support:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

**🚀 Built with Next.js 14, TypeScript, and modern bot development practices**
