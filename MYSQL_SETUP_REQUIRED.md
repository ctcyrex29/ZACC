# ZACC Quick Setup Guide

## ⚠️ Important: MySQL Required

Your backend API is complete, but **MySQL must be installed and running** before the application will work.

## Quick Setup Steps

### 1. Install MySQL

**Option A: Standalone MySQL**

- Download: https://dev.mysql.com/downloads/installer/
- Install and start the MySQL service

**Option B: XAMPP (Recommended for Windows)**

- Download: https://www.apachefriends.org/
- Install XAMPP
- Start MySQL from XAMPP Control Panel

### 2. Create Database

```bash
mysql -u root -p
CREATE DATABASE zacc;
EXIT;
```

### 3. Run Migrations

```bash
cd c:\Users\DJ Chris\Desktop\zacc
php artisan migrate:fresh
```

### 4. Start Servers

**Terminal 1:**

```bash
cd c:\Users\DJ Chris\Desktop\zacc
php artisan serve
```

**Terminal 2:**

```bash
cd c:\Users\DJ Chris\Desktop\zacc\zacc
npm run dev
```

### 5. Access Application

Open browser: `http://localhost:3000`

## Optional: Create Admin User

```bash
php artisan tinker
```

```php
$user = new App\Models\User();
$user->name = 'Admin';
$user->email = 'admin@zacc.com';
$user->password = bcrypt('password');
$user->role = 'admin';
$user->save();
exit
```

## What's Been Implemented

✅ Complete Laravel backend API
✅ Database migrations for reports & users
✅ Report model with relationships
✅ ReportController with full CRUD
✅ API routes with Sanctum auth
✅ Frontend integrated with API
✅ Error handling & loading states

## Troubleshooting

**"No connection could be made"**
→ MySQL is not running. Start MySQL service.

**"Access denied for user 'root'"**
→ Update `.env` file with correct MySQL password.

**"Table 'zacc.reports' doesn't exist"**
→ Run migrations: `php artisan migrate:fresh`

---

For detailed documentation, see `walkthrough.md`
