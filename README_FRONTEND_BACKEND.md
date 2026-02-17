# ZACC Integrity Nexus - Full Stack Application

A secure, anonymous whistleblower and corruption reporting platform with AI-powered case analysis and investigation management.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           ZACC Integrity Nexus v5.0                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (React + TypeScript)    Backend (Laravel API)     │
│  ├─ Port 3000                     ├─ Port 8000              │
│  ├─ Vite Dev Server               ├─ PHP/Laravel            │
│  ├─ Real-time UI                  ├─ REST API               │
│  └─ Client-side Auth              └─ Sanctum Auth           │
│                                                              │
│         ↓ HTTP/WebSocket ↓         ↓ SQL Queries ↓          │
│                                                              │
│                    MySQL Database (localhost:3306)          │
│                    ├─ Users & Authentication                │
│                    ├─ Reports & Cases                       │
│                    └─ Investigation Logs                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- PHP 8.1+ with Laravel 11
- Node.js 18+ with npm
- MySQL 5.7+
- Composer

### Setup (2 commands)

**1. Backend Setup:**

```bash
cd c:\Users\DJ Chris\Desktop\zacc
composer install
php artisan migrate
php artisan serve
```

**2. Frontend Setup (new terminal):**

```bash
cd c:\Users\DJ Chris\Desktop\zacc\zacc
npm install
npm run dev
```

Visit `http://localhost:3000` 🎉

### Or Use Easy Start Script

```bash
cd c:\Users\DJ Chris\Desktop\zacc
start-dev.bat          # Windows Batch
# or
.\start-dev.ps1        # Windows PowerShell
```

## 📁 Project Structure

```
zacc/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       └── AuthController.php    ← API endpoints
│   │   └── Kernel.php
│   └── Models/
│       └── User.php
│
├── routes/
│   ├── api.php          ← REST API routes
│   └── web.php
│
├── config/
│   ├── cors.php         ← CORS settings
│   └── database.php
│
├── database/
│   ├── migrations/      ← Database schema
│   └── factories/
│
├── zacc/                ← React Frontend
│   ├── src/
│   ├── components/
│   │   ├── Login.tsx                     ← Auth UI
│   │   ├── Dashboard.tsx
│   │   ├── ReportForm.tsx
│   │   ├── AIChatbot.tsx
│   │   └── ...
│   ├── services/
│   │   ├── api.ts       ← API client
│   │   └── gemini.ts    ← AI services
│   ├── vite.config.ts   ← Vite proxy config
│   └── .env             ← Frontend env vars
│
├── bootstrap/
├── storage/
├── tests/
├── .env                 ← Backend env vars
├── artisan
├── composer.json
└── package.json
```

## 🔌 API Reference

### Authentication Endpoints

| Method | Endpoint             | Description                      |
| ------ | -------------------- | -------------------------------- |
| `POST` | `/api/auth/login`    | Login with email/password        |
| `POST` | `/api/auth/register` | Create new account               |
| `POST` | `/api/auth/logout`   | Logout (requires auth)           |
| `GET`  | `/api/auth/user`     | Get current user (requires auth) |

### Request/Response Example

**Login Request:**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response:**

```json
{
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "user@example.com"
    },
    "token": "1|Fqc7bV..."
}
```

## 💻 Frontend Usage

### Using the API Client

```typescript
import { apiClient } from "./services/api";

// Login
const response = await apiClient.login(email, password);

// Make authenticated requests
const user = await apiClient.getUser();
const data = await apiClient.get("/api/endpoint");

// Post data
await apiClient.post("/api/reports", { title: "Report" });

// Logout
await apiClient.logout();
```

## 🗄️ Database

### Current Schema

- `users` - User accounts & authentication
- `sessions` - Session management
- `password_reset_tokens` - Password resets
- `jobs` - Background jobs
- Custom tables: Reports, Investigations, Case Tracking

### Run Migrations

```bash
php artisan migrate              # Run migrations
php artisan migrate:fresh --seed # Reset database
php artisan make:migration create_reports_table  # New migration
```

## 🔐 Security Features

- ✅ **Sanctum Token Auth** - Secure API authentication
- ✅ **CORS Protection** - Only trusted origins
- ✅ **Password Hashing** - bcrypt encryption
- ✅ **HTTPS Ready** - Built for SSL/TLS
- ✅ **Rate Limiting** - API throttling
- ✅ **Input Validation** - Form validation
- ✅ **CSRF Protection** - Web routes protected

## 📊 Features

### Whistleblower Portal

- Anonymous report submission
- Real-time case tracking
- Secure message encryption
- Document uploads

### Investigator Dashboard

- Case management interface
- Report analysis tools
- Team collaboration
- Investigation tracking

### AI Integration

- Automated case categorization
- Risk assessment scoring
- Entity extraction
- Pattern recognition

## 🧪 Testing

```bash
# Run tests
php artisan test

# Run specific test
php artisan test tests/Feature/AuthTest.php

# Coverage report
php artisan test --coverage
```

## 📝 Environment Configuration

### .env (Backend)

```
APP_NAME=ZACC
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=zacc
DB_USERNAME=root
DB_PASSWORD=
```

### .env (Frontend - zacc/)

```
VITE_API_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your_api_key_here
```

## 🚢 Production Deployment

### Build Frontend

```bash
cd zacc
npm run build
# Creates dist/ folder for deployment
```

### Prepare Backend

```bash
php artisan config:cache
php artisan route:cache
php artisan optimize
```

## 🐛 Troubleshooting

| Issue                | Solution                             |
| -------------------- | ------------------------------------ |
| Port 8000 in use     | `php artisan serve --port=8001`      |
| CORS errors          | Check `config/cors.php` and `.env`   |
| DB connection failed | Verify MySQL running and credentials |
| npm packages missing | `npm install` in zacc/               |
| Can't find module    | Check imports and file paths         |

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - 5-minute setup guide
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Detailed architecture
- [SETUP_SUMMARY.md](./SETUP_SUMMARY.md) - Complete change summary

## 🛠️ Development Commands

```bash
# Laravel
php artisan serve              # Start server
php artisan tinker             # Interactive shell
php artisan route:list         # View routes
php artisan make:controller    # Create controller
php artisan make:model         # Create model

# React
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview               # Preview build
npm run lint                  # Run linter

# Database
php artisan migrate           # Run migrations
php artisan migrate:fresh     # Reset database
php artisan seed              # Seed database
```

## 📞 Support

- **Issues**: Check documentation files
- **API Docs**: See INTEGRATION_GUIDE.md
- **React Docs**: https://react.dev
- **Laravel Docs**: https://laravel.com/docs
- **Vite Docs**: https://vitejs.dev

## 📄 License

Proprietary - ZACC Organization

## 👥 Team

**Project**: ZACC Integrity Nexus v5.0  
**Status**: ✅ Active Development  
**Last Updated**: February 6, 2026

---

**Ready to build? Start with `start-dev.bat` or the commands above!** 🚀
