<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use App\Services\AuditService;
use App\Services\StakeholderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PublicReportController extends Controller
{
    public function __construct(
        protected AuditService $auditService,
        protected StakeholderNotificationService $notificationService,
    ) {}

    public function storeAnonymous(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => ['required', 'string', 'max:255'],
            'institution' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'min:20'],
            'priority' => ['required', 'string', 'in:LOW,MEDIUM,HIGH,CRITICAL'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        try {
            $report = DB::transaction(function () use ($validated, $request) {
                $adminWithKey = User::query()
                    ->where('role', User::ROLE_ADMIN)
                    ->whereNotNull('public_key')
                    ->first();

                $report = new Report([
                    'case_id' => Report::generateCaseId(),
                    'reference_code' => Report::generateReferenceCode(),
                    'user_id' => null,
                    'type' => $validated['type'],
                    'institution' => $validated['institution'],
                    'location' => $validated['location'] ?? null,
                    'status' => 'SUBMITTED',
                    'priority' => $validated['priority'],
                    'risk_score' => $this->calculateRiskScore($validated),
                    'last_updated' => now(),
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'is_anonymous' => true,
                    'is_encrypted' => true,
                ]);

                $report->setEncryptedData([
                    'description' => $validated['description'],
                    'location' => $validated['location'] ?? null,
                    'institution' => $validated['institution'],
                ], $adminWithKey?->public_key);

                $report->save();
                $report->submitToBlockchain();

                return $report;
            });

            $this->auditService->record(
                action: 'ANONYMOUS_REPORT_SUBMITTED',
                subject: $report,
                reportId: $report->id,
                userId: null,
                details: 'Anonymous report submitted via public portal',
                metadata: [
                    'case_id' => $report->case_id,
                    'reference_code' => $report->reference_code,
                ],
            );

            $this->notificationService->notifyCaseEvent(
                $report,
                'ANONYMOUS_REPORT_SUBMITTED',
                'New Anonymous Report Submitted',
                'A new anonymous case has been submitted and requires review.',
                [
                    'case_id' => $report->case_id,
                    'reference_code' => $report->reference_code,
                    'priority' => $report->priority,
                ],
            );

            return response()->json([
                'success' => true,
                'message' => 'Anonymous report submitted successfully',
                'data' => [
                    'case_id' => $report->case_id,
                    'reference_code' => $report->reference_code,
                    'status' => $report->status,
                    'risk_score' => $report->risk_score,
                    'priority' => $report->priority,
                    'created_at' => $report->created_at,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Failed to submit anonymous report', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to submit report. Please try again.',
            ], 500);
        }
    }

    public function track(string $trackingCode): JsonResponse
    {
        $report = Report::query()
            ->where('reference_code', $trackingCode)
            ->orWhere('case_id', $trackingCode)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'No case found for this tracking code.',
            ], 404);
        }

        $stageEvaluations = $report->stageEvaluations()
            ->latest('created_at')
            ->get(['id', 'stage', 'investigator_notes', 'expert_score', 'manual_score', 'final_score', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => [
                'case_id' => $report->case_id,
                'reference_code' => $report->reference_code,
                'status' => $report->status,
                'priority' => $report->priority,
                'risk_score' => $report->risk_score,
                'institution' => $report->institution,
                'type' => $report->type,
                'created_at' => $report->created_at,
                'last_updated' => $report->last_updated,
                'stage_evaluations' => $stageEvaluations,
            ],
        ]);
    }

    private function calculateRiskScore(array $data): int
    {
        $base = [
            'LOW' => 30,
            'MEDIUM' => 50,
            'HIGH' => 75,
            'CRITICAL' => 90,
        ][$data['priority']] ?? 50;

        $text = strtolower(($data['description'] ?? '') . ' ' . ($data['institution'] ?? '') . ' ' . ($data['location'] ?? ''));

        foreach (['bribe', 'fraud', 'embezzle', 'theft', 'coercion'] as $keyword) {
            if (str_contains($text, $keyword)) {
                $base += 5;
            }
        }

        return max(0, min(100, $base));
    }
}
