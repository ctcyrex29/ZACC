# ZACC Integrity Nexus - Full Stack Setup Complete ✅

## Quick Start (5 Minutes)

### Step 1: Prepare Laravel Backend

```bash
cd c:\Users\DJ Chris\Desktop\zacc

# Install composer dependencies (if not already done)
composer install

# Run migrations to set up database
php artisan migrate

# Install Laravel Sanctum for API authentication
php artisan install:api

# Start Laravel server on port 8000
php artisan serve
```

### Step 2: Start React Frontend

```bash
cd c:\Users\DJ Chris\Desktop\zacc\zacc

# Install npm dependencies (if not already done)
npm install

# Start dev server on port 3000
npm run dev
```

### Step 3: Access the Application

- Open browser to `http://localhost:3000`
- You should see the ZACC Integrity Nexus login page
- Create an account or login

---

## What's Been Set Up

### Backend (Laravel)

- ✅ **API Routes** - RESTful endpoints for authentication
- ✅ **Auth Controller** - Handles login, register, logout
- ✅ **CORS Configuration** - Allows React frontend requests
- ✅ **Sanctum Setup** - API token authentication
- ✅ **MySQL Database** - Already configured in `.env`

### Frontend (React)

- ✅ **API Client** - Located at `zacc/services/api.ts`
- ✅ **Updated Login Component** - Integrates with backend
- ✅ **Vite Proxy** - Routes `/api` calls to Laravel
- ✅ **Environment Config** - `.env` file with API URL

---

## API Endpoints

All endpoints are under `/api/` prefix:

### Authentication Routes

```
POST   /api/auth/login        → Login with email/password
POST   /api/auth/register     → Create new account
POST   /api/auth/logout       → Logout (requires token)
GET    /api/auth/user         → Get current user (requires token)
```

---

## Environment Variables

### Laravel (.env)

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=zacc
DB_USERNAME=root
DB_PASSWORD=

APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### React (zacc/.env)

```
VITE_API_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your_key_here
```

---

## Using the API Client in Components

Import and use the API client in your React components:

```typescript
import { apiClient } from "../services/api";

// Login
try {
    const response = await apiClient.login(email, password);
    // response.user and response.token available
} catch (error) {
    console.error(error.message);
}

// Register
await apiClient.register(name, email, password, passwordConfirm);

// Make authenticated requests
const userData = await apiClient.get("/api/endpoint");
const result = await apiClient.post("/api/endpoint", { data });

// Logout
await apiClient.logout();
```

---

## Troubleshooting

### "Port 8000 already in use"

```bash
# Use a different port
php artisan serve --port=8001

# Then update VITE_API_URL in zacc/.env
```

### "CORS error"

- Ensure `FRONTEND_URL` is set in `.env`
- Check that React is on `http://localhost:3000`
- Verify Vite config proxy is correct

### "Cannot connect to database"

```bash
# Check MySQL is running and create database if needed
mysql -u root
CREATE DATABASE zacc;
EXIT;

# Then run migrations
php artisan migrate
```

### React app won't start

```bash
# Clear node_modules and reinstall
cd zacc
rm -r node_modules
npm install
npm run dev
```

---

## Next Steps

### Add More API Endpoints

Edit `routes/api.php` to add new routes:

```php
Route::post('/reports', [ReportController::class, 'store']);
Route::get('/reports', [ReportController::class, 'index']);
```

### Create Database Models

```bash
php artisan make:model Report -m
php artisan make:controller Api/ReportController
```

### Build for Production

```bash
# React
cd zacc && npm run build

# Laravel
php artisan build
```

---

## File Structure

```
Backend (Laravel):
├── routes/api.php                          # API routes
├── app/Http/Controllers/Api/
│   └── AuthController.php                  # Auth logic
├── config/cors.php                         # CORS config
├── .env                                    # Environment variables
└── bootstrap/app.php                       # Updated for API

Frontend (React):
├── zacc/services/api.ts                    # API client
├── zacc/components/Login.tsx               # Updated for backend
├── zacc/.env                               # Frontend env
├── zacc/vite.config.ts                     # Updated with proxy
└── zacc/index.html                         # React entry point
```

---

## Key Features

1. **Secure Authentication** - Uses Laravel Sanctum for token-based auth
2. **CORS Enabled** - Allows frontend to make requests
3. **Type Safe** - Full TypeScript support
4. **Persistent Login** - Token stored in localStorage
5. **Error Handling** - Clear error messages for debugging
6. **API Proxy** - Vite proxies /api calls during development

---

## Architecture

```
React App (localhost:3000)
        ↓
Vite Dev Server (Proxy /api)
        ↓
Laravel API (localhost:8000/api)
        ↓
MySQL Database (localhost:3306)
```

---

## Support

For more details, see:

- [Laravel Documentation](https://laravel.com/docs)
- [React Documentation](https://react.dev)
- [Laravel Sanctum](https://laravel.com/docs/sanctum)
- [Vite Documentation](https://vitejs.dev)

---

**Setup completed on February 6, 2026**
