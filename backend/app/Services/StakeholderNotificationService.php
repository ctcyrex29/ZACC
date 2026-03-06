<?php

namespace App\Services;

use App\Models\Report;
use App\Models\StakeholderNotification;
use App\Models\User;

class StakeholderNotificationService
{
    public function notifyCaseEvent(Report $report, string $type, string $title, string $message, array $payload = []): void
    {
        $recipientIds = [];

        if (!empty($report->user_id)) {
            $recipientIds[] = (int) $report->user_id;
        }

        if (!empty($report->assigned_to)) {
            $recipientIds[] = (int) $report->assigned_to;
        }

        $adminIds = User::query()
            ->where('role', User::ROLE_ADMIN)
            ->limit(5)
            ->pluck('id')
            ->all();

        $recipientIds = array_unique(array_merge($recipientIds, $adminIds));

        // New-case events should proactively notify investigators.
        if (in_array($type, ['NEW_CASE_SUBMITTED', 'ANONYMOUS_REPORT_SUBMITTED'])) {
            $investigatorIds = User::query()
                ->where('role', User::ROLE_INVESTIGATOR)
                ->limit(50)
                ->pluck('id')
                ->all();

            $recipientIds = array_unique(array_merge($recipientIds, $investigatorIds));
        }

        if (empty($recipientIds)) {
            StakeholderNotification::create([
                'report_id' => $report->id,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'payload' => $payload,
                'sent_at' => now(),
            ]);
            return;
        }

        foreach ($recipientIds as $recipientId) {
            StakeholderNotification::create([
                'report_id' => $report->id,
                'user_id' => $recipientId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'payload' => $payload,
                'sent_at' => now(),
            ]);
        }
    }
}
