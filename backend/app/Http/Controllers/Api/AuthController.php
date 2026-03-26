<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are invalid.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account is currently inactive. Please contact an administrator.'],
            ]);
        }

        // Check if login is via password reset token
        if ($user->password_reset_token && $user->password_reset_token_expires_at && $user->password_reset_token_expires_at->isFuture()) {
            $user->password_reset_token = null;
            $user->password_reset_token_expires_at = null;
            $user->save();
        }

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('api-token')->plainTextToken,
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'string', 'min:8', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
        ]);

        // Public registration is always WHISTLEBLOWER — admin/investigator accounts
        // must be created via the admin-only UserController::store()
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => User::ROLE_WHISTLEBLOWER,
        ]);

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('api-token')->plainTextToken,
        ], 201);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }
}
