# ZACC React Frontend ↔ Laravel Backend Integration - COMPLETE SETUP ✅

## Overview

Your ZACC Integrity Nexus application is now fully configured to work with:

- **Frontend**: React + TypeScript (Port 3000)
- **Backend**: Laravel with API routes (Port 8000)
- **Database**: MySQL (zacc database)
- **Authentication**: Laravel Sanctum token-based auth

---

## Files Modified/Created

### Backend (Laravel)

| File                                          | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `routes/api.php`                              | **NEW** - API routes for authentication     |
| `app/Http/Controllers/Api/AuthController.php` | **NEW** - Handles login, register, logout   |
| `app/Http/Kernel.php`                         | **NEW** - HTTP middleware configuration     |
| `config/cors.php`                             | **NEW** - CORS settings for React requests  |
| `bootstrap/app.php`                           | **UPDATED** - Added API route registration  |
| `.env`                                        | **UPDATED** - Added `FRONTEND_URL` variable |

### Frontend (React)

| File                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `zacc/services/api.ts`      | **NEW** - API client for backend communication |
| `zacc/components/Login.tsx` | **UPDATED** - Now uses backend authentication  |
| `zacc/.env`                 | **NEW** - Environment variables for React      |
| `zacc/vite.config.ts`       | **UPDATED** - Added API proxy configuration    |

### Documentation

| File                   | Purpose                               |
| ---------------------- | ------------------------------------- |
| `INTEGRATION_GUIDE.md` | Detailed setup and architecture guide |
| `QUICKSTART.md`        | Quick start instructions              |
| `SETUP_SUMMARY.md`     | This file - overview of changes       |

### Utilities

| File            | Purpose                                    |
| --------------- | ------------------------------------------ |
| `start-dev.bat` | Windows batch script to start both servers |
| `start-dev.ps1` | PowerShell script to start both servers    |

---

## How It Works

### 1. User Flow

```
User visits http://localhost:3000
         ↓
    Login Component
         ↓
    Enter email/password
         ↓
    API Client sends POST /api/auth/login
         ↓
    Vite proxy forwards to http://localhost:8000/api/auth/login
         ↓
    Laravel AuthController validates credentials
         ↓
    Returns user data + API token
         ↓
    Token stored in localStorage
         ↓
    User logged in ✅
```

### 2. Request Flow

```
React Component
    ↓
apiClient.get('/api/endpoint')
    ↓
Fetch to http://localhost:3000/api/endpoint (Vite dev server)
    ↓
Vite Proxy rewrites to http://localhost:8000/api/endpoint
    ↓
Laravel API processes request
    ↓
Response returned to React
    ↓
Component updates with data
```

### 3. Authentication Flow

```
Login:
  Email/Password → AuthController → Check credentials → Create token → Return

Authenticated Requests:
  Client stores token in localStorage
  All requests include: Authorization: Bearer {token}
  Laravel validates token with Sanctum middleware
  Request processed if valid, 401 if invalid
```

---

## Database Schema

Your MySQL database (`zacc`) currently has the default Laravel schema:

```sql
-- Core tables created by migrations
users                    -- User accounts
password_reset_tokens    -- Password reset tokens
sessions                 -- Session data
jobs                     -- Queued jobs
job_batches              -- Job batches
failed_jobs              -- Failed jobs

-- Add your custom tables:
reports                  -- Corruption reports
investigations           -- Investigation records
case_tracking            -- Case tracking data
-- etc.
```

---

## Running the Application

### Option 1: Easy Start Scripts

**Windows (Batch):**

```bash
cd c:\Users\DJ Chris\Desktop\zacc
start-dev.bat
```

**Windows (PowerShell):**

```powershell
cd c:\Users\DJ Chris\Desktop\zacc
.\start-dev.ps1
```

### Option 2: Manual Start (Recommended for Development)

**Terminal 1 - Laravel Backend:**

```bash
cd c:\Users\DJ Chris\Desktop\zacc
php artisan serve
```

**Terminal 2 - React Frontend:**

```bash
cd c:\Users\DJ Chris\Desktop\zacc\zacc
npm run dev
```

---

## API Usage Examples

### Login

```typescript
import { apiClient } from "./services/api";

const response = await apiClient.login("user@example.com", "password123");
// response.user: { id, name, email, ... }
// response.token: "1|abc..." (stored in localStorage)
```

### Register

```typescript
await apiClient.register(
    "John Doe",
    "john@example.com",
    "password123",
    "password123",
);
```

### Make Authenticated Requests

```typescript
// Token is automatically added to all requests
const userData = await apiClient.get("/auth/user");
const data = await apiClient.post("/reports", { title: "Report Title" });
const updated = await apiClient.put("/reports/1", { title: "Updated" });
await apiClient.delete("/reports/1");
```

### Logout

```typescript
await apiClient.logout();
// Token removed from localStorage
```

---

## Environment Variables

### Laravel (.env)

```
# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=zacc
DB_USERNAME=root
DB_PASSWORD=

# URLs
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Other settings
APP_DEBUG=true
LOG_LEVEL=debug
```

### React (zacc/.env)

```
# API Configuration
VITE_API_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Extending the API

### Add a New Endpoint

**1. Create a Controller:**

```bash
php artisan make:controller Api/ReportController
```

**2. Add route to routes/api.php:**

```php
Route::post('/reports', [ReportController::class, 'store']);
Route::get('/reports', [ReportController::class, 'index']);
```

**3. Implement controller methods:**

```php
public function store(Request $request) {
    // Save report to database
    return response()->json(['message' => 'Report saved']);
}
```

**4. Use in React:**

```typescript
const response = await apiClient.post("/reports", {
    title: "Report Title",
    description: "Description",
});
```

---

## Troubleshooting

### Issue: "Cannot GET /api/auth/login"

- **Cause**: Laravel server not running
- **Fix**: Start Laravel with `php artisan serve`

### Issue: "CORS error: Access-Control-Allow-Origin"

- **Cause**: CORS not configured properly
- **Fix**: Check `config/cors.php` and ensure `FRONTEND_URL` is set

### Issue: "POST 401 Unauthorized"

- **Cause**: Token expired or invalid
- **Fix**: Clear localStorage and login again

### Issue: "Cannot find module 'api.ts'"

- **Cause**: API file not created
- **Fix**: Create `zacc/services/api.ts` with provided code

### Issue: React app won't compile

- **Cause**: TypeScript errors in Login component
- **Fix**: Check that api.ts exists in services folder

---

## Production Deployment

### Prepare for Production

**Laravel:**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize
```

**React:**

```bash
cd zacc
npm run build
# Creates zacc/dist/ folder with optimized build
```

### Set Environment Variables

- Update `.env` with production values
- Set `FRONTEND_URL` to your production domain
- Configure `APP_URL` for your server

### Security Considerations

- ✅ Use HTTPS in production
- ✅ Set proper CORS origins
- ✅ Implement rate limiting
- ✅ Use strong authentication tokens
- ✅ Validate all user input
- ✅ Keep dependencies updated

---

## Development Tips

### Enable API Response Logging

Add to `routes/api.php`:

```php
Route::middleware('log.requests')->group(function () {
    // Your routes
});
```

### Test API Endpoints

Use Postman or curl:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Debug React API Calls

Add logging to `zacc/services/api.ts`:

```typescript
console.log("Request:", endpoint, method, body);
console.log("Response:", response);
```

---

## Next Steps

1. ✅ Both servers are running
2. ✅ Database is configured
3. ✅ API client is ready
4. Next: **Create additional API endpoints** for your app features
5. Next: **Add database models** for reports, investigations, etc.
6. Next: **Implement React components** that use the API

---

## Useful Commands

```bash
# Laravel
php artisan migrate                    # Run database migrations
php artisan migrate:fresh --seed       # Reset database
php artisan tinker                     # Interactive shell
php artisan route:list                 # View all routes
php artisan make:model Report -m       # Create model + migration

# React
npm install axios                      # Add HTTP client
npm run build                          # Build for production
npm run preview                        # Preview production build
npm run lint                           # Run linter

# Database
mysql -u root zacc                     # Connect to database
CREATE TABLE ...                       # Create tables
```

---

## Support Resources

- [Laravel Documentation](https://laravel.com/docs)
- [Laravel Sanctum](https://laravel.com/docs/sanctum)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

## Summary

✅ **Frontend & Backend Connected**  
✅ **Authentication System Ready**  
✅ **Database Configured**  
✅ **API Client Available**  
✅ **Environment Variables Set**  
✅ **CORS Enabled**  
✅ **Development Servers Running**

**You're ready to build your ZACC Integrity Nexus application!** 🚀

---

**Setup Date**: February 6, 2026  
**Application**: ZACC Integrity Nexus v5.0  
**Status**: ✅ READY FOR DEVELOPMENT
