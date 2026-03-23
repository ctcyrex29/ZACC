<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Get all users (admin only) - excludes whistleblowers for privacy protection
     */
    public function index(): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $users = User::select('id', 'name', 'email', 'role', 'is_active', 'allowed_case_types', 'created_at', 'updated_at')
            ->where('role', '!=', User::ROLE_WHISTLEBLOWER)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Create a new user (admin only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'string', 'in:ADMIN,INVESTIGATOR'],
            'is_active' => ['sometimes', 'boolean'],
            'allowed_case_types' => ['sometimes', 'array'],
            'allowed_case_types.*' => ['string', 'in:Bribery,Procurement Fraud,Abuse of Office,Embezzlement,Nepotism,Other'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $newUser = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
                'is_active' => $request->input('is_active', true),
                'allowed_case_types' => $request->input('allowed_case_types'),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'data' => [
                    'id' => $newUser->id,
                    'name' => $newUser->name,
                    'email' => $newUser->email,
                    'role' => $newUser->role,
                    'is_active' => $newUser->is_active,
                    'allowed_case_types' => $newUser->allowed_case_types,
                    'created_at' => $newUser->created_at,
                ],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create user: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a user (admin only)
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $updateUser = User::find($id);

        if (!$updateUser) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'unique:users,email,' . $id],
            'role' => ['sometimes', 'string', 'in:ADMIN,INVESTIGATOR'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
            'is_active' => ['sometimes', 'boolean'],
            'allowed_case_types' => ['sometimes', 'nullable', 'array'],
            'allowed_case_types.*' => ['string', 'in:Bribery,Procurement Fraud,Abuse of Office,Embezzlement,Nepotism,Other'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $data = $request->only(['name', 'email', 'role', 'is_active', 'allowed_case_types']);

            if ($request->has('password') && $request->password) {
                $data['password'] = Hash::make($request->password);
            }

            $updateUser->update($data);

            return response()->json([
                'success' => true,
                'message' => 'User updated successfully',
                'data' => [
                    'id' => $updateUser->id,
                    'name' => $updateUser->name,
                    'email' => $updateUser->email,
                    'role' => $updateUser->role,
                    'is_active' => $updateUser->is_active,
                    'allowed_case_types' => $updateUser->allowed_case_types,
                    'updated_at' => $updateUser->updated_at,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a user (admin only)
     */
    public function destroy($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $deleteUser = User::find($id);

        if (!$deleteUser) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        // Prevent deleting the current admin
        if ($deleteUser->id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete your own account',
            ], 400);
        }

        try {
            $deleteUser->delete();

            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate a password reset token for a user (admin only).
     * Returns a temporary password the admin can share with the user.
     */
    public function resetPassword($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $targetUser = User::find($id);

        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        // Generate a temporary password
        $tempPassword = Str::random(12);
        $targetUser->password = Hash::make($tempPassword);
        $targetUser->password_reset_token = Str::random(64);
        $targetUser->password_reset_token_expires_at = now()->addHours(24);
        $targetUser->save();

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. Share the temporary password with the user.',
            'data' => [
                'temporary_password' => $tempPassword,
                'expires_in' => '24 hours',
            ],
        ]);
    }

    /**
     * Toggle active/inactive status (admin only).
     */
    public function toggleActive($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $targetUser = User::find($id);

        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        if ($targetUser->id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot deactivate your own account',
            ], 400);
        }

        $targetUser->is_active = !$targetUser->is_active;
        $targetUser->save();

        // Revoke tokens if deactivated
        if (!$targetUser->is_active) {
            $targetUser->tokens()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => $targetUser->is_active ? 'User activated successfully' : 'User deactivated successfully',
            'data' => [
                'id' => $targetUser->id,
                'is_active' => $targetUser->is_active,
            ],
        ]);
    }
}
