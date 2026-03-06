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
use Illuminate\Support\Facades\Storage;

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
            ->oldest('created_at')
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
                'dispute_reason' => $report->dispute_reason,
                'attachments_count' => $report->attachments()->count(),
                'stage_evaluations' => $stageEvaluations,
            ],
        ]);
    }

    public function publicDispute(string $trackingCode, Request $request): JsonResponse
    {
        $report = Report::query()
            ->where('reference_code', $trackingCode)
            ->orWhere('case_id', $trackingCode)
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'No case found for this tracking code.'], 404);
        }

        if ($report->status !== 'CLOSED') {
            return response()->json(['success' => false, 'message' => 'Only closed cases can be disputed.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason'     => ['required', 'string', 'min:10'],
            'evidence'   => ['nullable', 'array', 'max:10'],
            'evidence.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,mp3,wav,ogg,mp4,mov,avi,pdf,doc,docx,xls,xlsx,txt'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation error', 'errors' => $validator->errors()], 422);
        }

        try {
            DB::transaction(function () use ($report, $request) {
                $report->status         = 'DISPUTED';
                $report->dispute_reason = $request->input('reason');
                $report->last_updated   = now();
                $report->save();

                if ($request->hasFile('evidence')) {
                    foreach ($request->file('evidence') as $file) {
                        $stored = $file->store('dispute_evidence/' . $report->case_id, 'public');
                        $report->attachments()->create([
                            'original_name' => $file->getClientOriginalName(),
                            'file_name'     => $stored,
                            'mime_type'     => $file->getMimeType(),
                            'size'          => $file->getSize(),
                            'disk'          => 'public',
                            'created_by'    => null,
                        ]);
                    }
                }
            });

            $this->auditService->record(
                action: 'CASE_DISPUTED',
                subject: $report,
                reportId: $report->id,
                userId: null,
                details: 'Case disputed via public portal.',
                metadata: ['case_id' => $report->case_id],
            );

            $this->notificationService->notifyCaseEvent(
                $report,
                'CASE_DISPUTED',
                'Case Dispute Filed',
                "Case {$report->reference_code} has been disputed by the whistleblower.",
                ['case_id' => $report->case_id],
            );

            return response()->json(['success' => true, 'message' => 'Dispute submitted successfully.', 'data' => ['status' => 'DISPUTED']]);
        } catch (\Throwable $e) {
            Log::error('Failed to process public dispute', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Failed to process dispute. Please try again.'], 500);
        }
    }

    public function uploadEvidence(string $trackingCode, Request $request): JsonResponse
    {
        $report = Report::query()
            ->where('reference_code', $trackingCode)
            ->orWhere('case_id', $trackingCode)
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'No case found for this tracking code.'], 404);
        }

        if (in_array($report->status, ['CLOSED', 'DISPUTED'])) {
            return response()->json(['success' => false, 'message' => 'Evidence cannot be added to closed or disputed cases.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'files'   => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,mp3,wav,ogg,mp4,mov,avi,pdf,doc,docx,xls,xlsx,txt'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation error', 'errors' => $validator->errors()], 422);
        }

        try {
            $existingCount = $report->attachments()->count();
            $newFiles      = $request->file('files');

            if ($existingCount + count($newFiles) > 10) {
                return response()->json([
                    'success' => false,
                    'message' => "Maximum 10 files allowed. You already have {$existingCount} file(s) uploaded.",
                ], 422);
            }

            $uploaded = [];
            foreach ($newFiles as $file) {
                $stored = $file->store('evidence/' . $report->case_id, 'public');
                $attachment = $report->attachments()->create([
                    'original_name' => $file->getClientOriginalName(),
                    'file_name'     => $stored,
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                    'disk'          => 'public',
                    'created_by'    => null,
                ]);
                $uploaded[] = ['id' => $attachment->id, 'name' => $file->getClientOriginalName(), 'size' => $file->getSize(), 'mime_type' => $file->getMimeType()];
            }

            $this->auditService->record(
                action: 'EVIDENCE_UPLOADED',
                subject: $report,
                reportId: $report->id,
                userId: null,
                details: count($newFiles) . ' evidence file(s) uploaded via public portal.',
                metadata: ['case_id' => $report->case_id, 'count' => count($newFiles)],
            );

            return response()->json([
                'success' => true,
                'message' => count($uploaded) . ' file(s) uploaded successfully.',
                'data'    => ['uploaded' => $uploaded, 'total_attachments' => $existingCount + count($uploaded)],
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to upload evidence', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Failed to upload evidence. Please try again.'], 500);
        }
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
