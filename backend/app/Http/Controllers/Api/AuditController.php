<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $query = ActivityLog::query()->with(['user:id,name,email']);

        if ($request->filled('report_id')) {
            $query->where('report_id', $request->integer('report_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->string('action')->toString());
        }

        $logs = $query->latest('created_at')->limit(200)->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }
}
