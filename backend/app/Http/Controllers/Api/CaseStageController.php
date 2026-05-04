<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use App\Services\AuditService;
use App\Services\ExpertEvaluationService;
use App\Services\StakeholderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseStageController extends Controller
{
    private const CASE_TYPES = [
        'Bribery',
        'Procurement Fraud',
        'Abuse of Office',
        'Embezzlement',
        'Nepotism',
        'Other',
    ];

    private const STAGE_TRANSITIONS = [
        'SUBMITTED' => ['UNDER_REVIEW'],
        'UNDER_REVIEW' => ['INVESTIGATING', 'CLOSED'],
        'INVESTIGATING' => ['REFERRED', 'SUCCESSFUL', 'CLOSED'],
        'REFERRED' => ['REFERRED', 'SUCCESSFUL', 'CLOSED'],
        'SUCCESSFUL' => ['CLOSED'],
        'DISPUTED' => ['UNDER_REVIEW', 'INVESTIGATING', 'REFERRED', 'CLOSED'],
        'CLOSED' => [],
    ];

    public function __construct(
        protected ExpertEvaluationService $expertEvaluationService,
        protected StakeholderNotificationService $notificationService,
        protected AuditService $auditService,
    ) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $report = Report::query()->where('id', $id)->orWhere('case_id', $id)->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        $user = $request->user();
        if (!($user->isAdmin() || $user->isInvestigator() || $report->user_id === $user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $stages = $report->stageEvaluations()
            ->with('investigator:id,name,email')
            ->latest('created_at')
            ->get();

        return response()->json(['success' => true, 'data' => $stages]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!($user->isAdmin() || $user->isInvestigator())) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $report = Report::query()->where('id', $id)->orWhere('case_id', $id)->first();
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        if ($user->isInvestigator() && $report->assigned_to && (int) $report->assigned_to !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'You are not assigned to this report'], 403);
        }

        $validationRules = [
            'stage' => 'required|in:SUBMITTED,UNDER_REVIEW,INVESTIGATING,REFERRED,SUCCESSFUL,CLOSED,DISPUTED',
            'investigator_notes' => 'required|string|min:10',
            'manual_score' => 'nullable|integer|min:0|max:100',
            'resolved_case_type' => 'nullable|string|in:Bribery,Procurement Fraud,Abuse of Office,Embezzlement,Nepotism,Other',
        ];

        if ((string) $request->input('stage') === 'REFERRED') {
            $validationRules = array_merge($validationRules, [
                'referral_authority' => 'required|string|min:3|max:255',
                'referral_legal_basis' => 'required|string|min:10|max:1000',
                'referral_reference' => 'required|string|min:3|max:255',
                'referral_transmission_date' => 'required|date',
            ]);
        }

        $validated = $request->validate($validationRules);

        $currentStage = (string) $report->status;
        $requestedStage = (string) $validated['stage'];
        $allowedNextStages = self::STAGE_TRANSITIONS[$currentStage] ?? [];

        if (!in_array($requestedStage, $allowedNextStages, true)) {
            return response()->json([
                'success' => false,
                'message' => "Invalid stage transition from {$currentStage} to {$requestedStage}. Past stages are locked once completed.",
                'data' => [
                    'current_stage' => $currentStage,
                    'allowed_next_stages' => $allowedNextStages,
                ],
            ], 422);
        }

        $formalReferral = null;
        $investigatorNotes = (string) $validated['investigator_notes'];
        if ($requestedStage === 'REFERRED') {
            $formalReferral = [
                'authority' => (string) $validated['referral_authority'],
                'legal_basis' => (string) $validated['referral_legal_basis'],
                'reference' => (string) $validated['referral_reference'],
                'transmission_date' => (string) $validated['referral_transmission_date'],
            ];

            $investigatorNotes = trim($investigatorNotes)
                . "\n\n--- Formal Referral Record ---"
                . "\nReferral Authority: " . $formalReferral['authority']
                . "\nLegal Basis: " . $formalReferral['legal_basis']
                . "\nReferral Reference: " . $formalReferral['reference']
                . "\nTransmission Date: " . $formalReferral['transmission_date'];
        }

        $expert = $this->expertEvaluationService->evaluateStage(
            $report,
            $validated['stage'],
            $investigatorNotes,
        );

        $manualScore = isset($validated['manual_score']) ? (int) $validated['manual_score'] : null;
        $finalScore = $manualScore === null
            ? (int) $expert['score']
            : (int) round(($manualScore + (int) $expert['score']) / 2);

        $selectedCaseType = null;
        if ($currentStage === 'UNDER_REVIEW' && $requestedStage === 'INVESTIGATING') {
            $selectedCaseType = isset($validated['resolved_case_type'])
                ? trim((string) $validated['resolved_case_type'])
                : null;

            if (!$selectedCaseType || !in_array($selectedCaseType, self::CASE_TYPES, true)) {
                $selectedCaseType = (string) $report->type;
            }
        }

        $typeResolution = null;
        if ($selectedCaseType !== null) {
            $typeResolution = [
                'selected_type' => $selectedCaseType,
                'previous_type' => (string) $report->type,
                'was_corrected' => $selectedCaseType !== (string) $report->type,
                'selected_by_user_id' => (int) $user->id,
                'selected_at' => now()->toIso8601String(),
            ];
        }

        $stageEvaluation = $report->stageEvaluations()->create([
            'investigator_id' => $user->id,
            'stage' => $validated['stage'],
            'investigator_notes' => $investigatorNotes,
            'expert_score' => (int) $expert['score'],
            'manual_score' => $manualScore,
            'final_score' => $finalScore,
            'expert_context' => array_merge($expert, [
                'formal_referral' => $formalReferral,
                'type_resolution' => $typeResolution,
            ]),
        ]);

        $updateData = [
            'status' => $validated['stage'],
            'risk_score' => $finalScore,
            'last_updated' => now(),
        ];

        // Record the stage at which the case was closed (for dispute re-entry)
        if ($validated['stage'] === 'CLOSED') {
            $updateData['closed_at_stage'] = $currentStage;
        }

        $assignedInvestigatorId = null;
        if ($selectedCaseType !== null) {
            $updateData['type'] = $selectedCaseType;
            $assignedInvestigatorId = $this->resolveInvestigatorAssignment($selectedCaseType, $user);
            if ($assignedInvestigatorId !== null) {
                $updateData['assigned_to'] = $assignedInvestigatorId;
            }
        }

        $report->update($updateData);
        $report->refresh();

        $this->auditService->record(
            action: 'STAGE_EVALUATION_RECORDED',
            subject: $report,
            reportId: $report->id,
            userId: $user->id,
            details: 'Case stage evaluation recorded by investigator',
            metadata: [
                'stage' => $validated['stage'],
                'expert_score' => (int) $expert['score'],
                'manual_score' => $manualScore,
                'final_score' => $finalScore,
                'formal_referral' => $formalReferral,
                'type_resolution' => $typeResolution,
                'assigned_to' => $assignedInvestigatorId,
            ],
        );

        $this->notificationService->notifyCaseEvent(
            $report,
            'CASE_STAGE_UPDATED',
            'Case Stage Updated',
            "Case {$report->reference_code} moved to {$validated['stage']} with expert score {$expert['score']}",
            [
                'stage' => $validated['stage'],
                'expert_score' => (int) $expert['score'],
                'final_score' => $finalScore,
                'urgency' => $expert['urgency'] ?? 'MEDIUM',
                'resolved_case_type' => $selectedCaseType,
                'assigned_to' => $assignedInvestigatorId,
            ],
        );

        return response()->json([
            'success' => true,
            'message' => 'Stage report recorded successfully',
            'data' => $stageEvaluation,
            'expert_system' => $expert,
            'report' => [
                'id' => $report->id,
                'case_id' => $report->case_id,
                'status' => $report->status,
                'type' => $report->type,
                'assigned_to' => $report->assigned_to,
            ],
        ], 201);
    }

    private function resolveInvestigatorAssignment(string $caseType, User $actingUser): ?int
    {
        $actingAllowedTypes = is_array($actingUser->allowed_case_types)
            ? $actingUser->allowed_case_types
            : [];

        if (
            $actingUser->isInvestigator()
            && (empty($actingAllowedTypes) || in_array($caseType, $actingAllowedTypes, true))
        ) {
            return (int) $actingUser->id;
        }

        $eligible = User::query()
            ->where('role', User::ROLE_INVESTIGATOR)
            ->where('is_active', true)
            ->get()
            ->filter(function (User $investigator) use ($caseType) {
                $allowed = is_array($investigator->allowed_case_types)
                    ? $investigator->allowed_case_types
                    : [];

                return empty($allowed) || in_array($caseType, $allowed, true);
            })
            ->values();

        if ($eligible->isEmpty()) {
            return null;
        }

        $eligibleIds = $eligible->pluck('id')->all();
        $openLoad = Report::query()
            ->whereIn('assigned_to', $eligibleIds)
            ->whereNotIn('status', ['CLOSED', 'SUCCESSFUL'])
            ->selectRaw('assigned_to, COUNT(*) as total')
            ->groupBy('assigned_to')
            ->pluck('total', 'assigned_to');

        $selected = $eligible
            ->sortBy(function (User $investigator) use ($openLoad) {
                return (int) ($openLoad[$investigator->id] ?? 0);
            })
            ->first();

        return $selected ? (int) $selected->id : null;
    }

    public function notifications(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = \App\Models\StakeholderNotification::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id);
                // System-wide notifications (user_id=null) only visible to admins/investigators
                if ($user->isAdmin() || $user->isInvestigator()) {
                    $query->orWhereNull('user_id');
                }
            })
            ->latest('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $notifications,
        ]);
    }
}
