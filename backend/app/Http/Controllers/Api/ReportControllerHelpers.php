<?php

namespace App\Http\Controllers\Api;

use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Helper methods for ReportController
 */
trait ReportControllerHelpers
{
    /**
     * Handle file attachments for reports.
     *
     * @param Report $report
     * @param array $attachments
     * @return void
     */
    protected function handleAttachments(Report $report, array $attachments): void
    {
        foreach ($attachments as $file) {
            if ($file->isValid()) {
                $path = $file->store("reports/{$report->id}/attachments", 'private');

                $report->attachments()->create([
                    'original_name' => $file->getClientOriginalName(),
                    'file_name' => $path,
                    'mime_type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                    'disk' => 'private',
                    'created_by' => Auth::id(),
                ]);
            }
        }
    }

    /**
     * Calculate risk score based on report data.
     *
     * @param array $data
     * @return int
     */
    protected function calculateRiskScore(array $data): int
    {
        $score = 50; // Base score

        // Adjust based on priority
        $priorityScores = [
            'LOW' => 30,
            'MEDIUM' => 50,
            'HIGH' => 75,
            'CRITICAL' => 100,
        ];

        $score = $priorityScores[$data['priority']] ?? $score;

        // Adjust based on content (simplified example)
        $highRiskKeywords = ['bribe', 'fraud', 'theft', 'embezzle', 'murder', 'assault'];
        $text = strtolower($data['description'] . ' ' . ($data['location'] ?? '') . ' ' . ($data['institution'] ?? ''));

        foreach ($highRiskKeywords as $keyword) {
            if (str_contains($text, $keyword)) {
                $score = min(100, $score + 20);
            }
        }

        return min(100, max(0, $score)); // Ensure score is between 0-100
    }

    /**
     * Generate a reference code for a report.
     *
     * @return string
     */
    protected function generateReferenceCode(): string
    {
        do {
            $code = 'ZACC-' . strtoupper(Str::random(8));
        } while (Report::where('reference_code', $code)->exists());

        return $code;
    }

    /**
     * Log an action for a report.
     *
     * @param Report $report
     * @param string $action
     * @param string $details
     * @param array $metadata
     * @return void
     */
    protected function logReportAction(Report $report, string $action, string $details, array $metadata = []): void
    {
        try {
            $report->activityLogs()->create([
                'report_id' => $report->id,
                'user_id' => Auth::id(),
                'action' => $action,
                'details' => $details,
                'ip_address' => request()->ip(),
                'metadata' => $metadata,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log report action: ' . $e->getMessage(), [
                'report_id' => $report->id,
                'action' => $action,
                'exception' => $e,
            ]);
        }
    }

    /**
     * Validate report status transition.
     *
     * @param string $currentStatus
     * @param string $newStatus
     * @param User $user
     * @return bool
     */
    protected function isValidStatusTransition(string $currentStatus, string $newStatus, User $user): bool
    {
        $validTransitions = [
            'SUBMITTED' => ['UNDER_REVIEW', 'INVESTIGATING', 'CLOSED'],
            'UNDER_REVIEW' => ['INVESTIGATING', 'CLOSED'],
            'INVESTIGATING' => ['REFERRED', 'CLOSED', 'DISPUTED'],
            'REFERRED' => ['CLOSED', 'DISPUTED'],
            'DISPUTED' => ['UNDER_REVIEW', 'INVESTIGATING', 'CLOSED'],
        ];

        // Admins can do anything
        if ($user->isAdmin()) {
            return true;
        }

        // Investigators have limited permissions
        if ($user->isInvestigator()) {
            // Investigators can't close or refer cases
            if (in_array($newStatus, ['CLOSED', 'REFERRED'])) {
                return false;
            }
        }

        // Regular users can only submit disputes
        if ($user->isWhistleblower() && $newStatus !== 'DISPUTED') {
            return false;
        }

        // Check if the transition is valid
        return in_array($newStatus, $validTransitions[$currentStatus] ?? []);
    }
}
