# React Frontend + Laravel Backend Integration Guide

## Setup Instructions

### 1. **Database Setup (MySQL)**

Your MySQL database is already configured in `.env`:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=zacc
DB_USERNAME=root
DB_PASSWORD=
```

Ensure MySQL is running and the `zacc` database exists.

### 2. **Laravel Backend Setup**

#### Run Migrations

```bash
cd c:\Users\DJ Chris\Desktop\zacc
php artisan migrate
```

#### Install & Configure Sanctum (for API authentication)

```bash
php artisan install:api
php artisan migrate
```

#### Start Laravel Development Server

```bash
# Terminal 1: Start Laravel (Port 8000)
php artisan serve
```

### 3. **React Frontend Setup**

#### Install Dependencies

```bash
cd c:\Users\DJ Chris\Desktop\zacc\zacc
npm install
```

#### Configure Environment Variables

Create/Update `.env` in the zacc folder:

```
VITE_API_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

#### Start Development Server

```bash
# Terminal 2: Start React (Port 3000)
npm run dev
```

### 4. **API Endpoints Available**

**Authentication:**

- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new user
- `POST /api/auth/logout` - Logout (requires auth)
- `GET /api/auth/user` - Get current user (requires auth)

### 5. **Using the API Client in React**

The API client is available at `services/api.ts`:

```typescript
import { apiClient } from "./services/api";

// Login
const response = await apiClient.login("user@example.com", "password");

// Register
const response = await apiClient.register(
    "John Doe",
    "john@example.com",
    "password123",
    "password123",
);

// Get current user
const user = await apiClient.getUser();

// Logout
await apiClient.logout();

// Generic requests
const data = await apiClient.get("/endpoint");
const result = await apiClient.post("/endpoint", { data });
```

### 6. **CORS Configuration**

CORS is configured in `config/cors.php` to allow requests from:

- `http://localhost:3000` (React frontend)

To add more origins, update the `allowed_origins` in the CORS config.

### 7. **Database Models & Migrations**

Create models and migrations as needed:

```bash
php artisan make:model Report -m
php artisan make:model Investigation -m
```

Then add your relationships and fields in the migration files before running `php artisan migrate`.

### 8. **Troubleshooting**

**CORS Errors:**

- Ensure `FRONTEND_URL` is set in `.env`
- Check that React is running on `http://localhost:3000`
- Clear browser cache and try again

**Database Connection Issues:**

- Ensure MySQL is running
- Verify credentials in `.env`
- Check that the `zacc` database exists

**Token/Authentication Issues:**

- Tokens are stored in `localStorage` as `nexus_token`
- Clear localStorage if experiencing auth problems
- Check Laravel logs: `storage/logs/laravel.log`

**API Proxy Issues:**

- Ensure Vite proxy is configured correctly (see `vite.config.ts`)
- Restart React dev server after config changes

### 9. **Useful Commands**

```bash
# Laravel
php artisan tinker  # Interactive shell
php artisan route:list  # View all routes
php artisan migrate:fresh --seed  # Reset & seed database

# React
npm run build  # Production build
npm run preview  # Preview production build
```

### 10. **Architecture Overview**

```
Frontend (React - Port 3000)
    ↓ (HTTP Requests)
Vite Dev Server (Proxy to /api)
    ↓
Laravel Backend (Port 8000)
    ↓
MySQL Database (Port 3306)
```

The React app uses the `apiClient` from `services/api.ts` to make authenticated requests to your Laravel API. The client automatically handles:

- Token management
- Authentication headers
- Error handling
- Request/response serialization
