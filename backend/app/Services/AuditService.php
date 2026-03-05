<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    public function record(string $action, ?Model $subject = null, ?int $reportId = null, ?int $userId = null, string $details = '', array $metadata = []): ActivityLog
    {
        return ActivityLog::create([
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject?->getKey(),
            'report_id' => $reportId,
            'user_id' => $userId,
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
            'metadata' => $metadata,
        ]);
    }
}
