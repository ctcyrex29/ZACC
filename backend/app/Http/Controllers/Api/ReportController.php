<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use App\Services\BlockchainService;
use App\Services\StakeholderNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Api\ReportControllerHelpers;
use App\Http\Controllers\Api\AIController;

class ReportController extends Controller
{
    use ReportControllerHelpers;
    /**
     * Display a listing of reports.
     * Admins and Investigators see all reports, regular users see only their own.
     */
    /**
     * @var BlockchainService
     */
    protected $blockchainService;
    protected StakeholderNotificationService $notificationService;

    /**
     * Constructor
     *
     * @param BlockchainService $blockchainService
     */
    public function __construct(BlockchainService $blockchainService, StakeholderNotificationService $notificationService)
    {
        $this->blockchainService = $blockchainService;
        $this->notificationService = $notificationService;
    }

    /**
     * Display a listing of reports.
     * Admins see all reports, investigators see assigned reports, regular users see only their own.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Report::query();

        // Apply role-based filtering
        if ($user->isAdmin()) {
            // Admins can see all reports
            $query->with(['user' => function ($q) {
                $q->select('id', 'name', 'email');
            }]);
        } elseif ($user->isInvestigator()) {
            // Investigators can see reports matching their allowed case types
            $query->with(['user' => function ($q) {
                $q->select('id', 'name', 'email');
            }]);
            $allowed = $user->allowed_case_types;
            if (!empty($allowed)) {
                $query->whereIn('type', $allowed);
            } else {
                // No types assigned — investigator sees nothing until admin assigns types
                $query->whereRaw('1 = 0');
            }
        } else {
            // Regular users can only see their own reports
            $query->where('user_id', $user->id);
        }

        // Apply filters if provided
        $filters = $request->only(['status', 'priority', 'type']);
        foreach ($filters as $key => $value) {
            if ($value && $value !== 'ALL') {
                $query->where($key, $value);
            }
        }

        // Search
        if ($request->has('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('case_id', 'LIKE', $search)
                    ->orWhere('reference_code', 'LIKE', $search)
                    ->orWhere('institution', 'LIKE', $search);
            });
        }

        // Sorting
        $sortBy = in_array($request->sort_by, [
            'created_at',
            'updated_at',
            'status',
            'priority',
            'risk_score'
        ]) ? $request->sort_by : 'created_at';

        $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

        $reports = $query->orderBy($sortBy, $sortOrder)->get();

        $reports->loadCount(['attachments', 'stageEvaluations']);

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    /**
     * Store a newly created report in storage with encryption and blockchain integration.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'type' => ['required', 'string', 'max:255'],
            'institution' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'min:20'],
            'report_language' => ['sometimes', 'string', 'max:10'],
            'risk_score' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'is_anonymous' => ['sometimes', 'boolean'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:5120', 'mimes:pdf,doc,docx,jpg,jpeg,png,txt'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $typeInference = $this->inferCorruptionType($validated);
        $validated['type'] = $typeInference['resolved_type'];

        // Priority is assigned by the expert system, not by the reporter.
        $expertPriority = $this->determineExpertPriority($validated);

        // Text clarity check — reject clearly gibberish submissions
        $clarity = $this->lastClarityResult;
        if (!empty($clarity) && $clarity['score'] < 20) {
            return response()->json([
                'success' => false,
                'message' => 'Your report description appears to be unclear or contains unrecognizable text. Please write a clear description of the corruption incident in English, Shona, Ndebele, or Tonga.',
                'clarity' => [
                    'score' => $clarity['score'],
                    'issues' => $clarity['issues'] ?? [],
                ],
            ], 422);
        }

        // Always auto-detect language from text content, falling back to declared/default
        $detectedLang = $this->detectTextLanguage($validated['description']);
        $reportLanguage = $detectedLang ?: ($validated['report_language'] ?? 'en');
        $clarityScore = $clarity['score'] ?? 50;

        try {
            // Start database transaction
            return DB::transaction(function () use ($validated, $user, $expertPriority, $reportLanguage, $clarityScore, $typeInference) {
                // Generate unique IDs
                $caseId = Report::generateCaseId();
                $referenceCode = 'REF-' . strtoupper(Str::random(8));

                // Determine if report is anonymous
                $isAnonymous = (bool) ($validated['is_anonymous'] ?? false);

                // Create report data
                $reportData = [
                    'case_id' => $caseId,
                    'reference_code' => $referenceCode,
                    'user_id' => $isAnonymous ? null : $user->id,
                    'type' => $validated['type'],
                    'institution' => $validated['institution'],
                    'location' => $validated['location'] ?? null,
                    'status' => 'SUBMITTED',
                    'priority' => $expertPriority,
                    'risk_score' => $this->calculateRiskScore(array_merge($validated, ['priority' => $expertPriority])),
                    'last_updated' => now(),
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'is_anonymous' => $isAnonymous,
                    'is_encrypted' => true,
                    'report_language' => $reportLanguage,
                    'text_clarity_score' => $clarityScore,
                ];

                // Create the report
                $report = new Report($reportData);

                // Encrypt sensitive data (AES-256 via Laravel Crypt)
                $report->setEncryptedData([
                    'description' => $validated['description'],
                    'location' => $validated['location'] ?? null,
                    'institution' => $validated['institution'],
                ]);

                // Save the report
                $report->save();

                // Handle file uploads if any
                if (isset($validated['attachments'])) {
                    $this->handleAttachments($report, $validated['attachments']);

                    // Re-score with file content + attachment bonus
                    $this->recalculateReportPriority($report);

                    // Refresh inference after evidence-aware recalculation.
                    $typeInference = $this->lastTypeInference ?: $typeInference;
                }

                // Persist inference metadata for audit and future tuning.
                $report->ai_summary = array_merge(
                    is_array($report->ai_summary) ? $report->ai_summary : [],
                    [
                        'type_inference' => [
                            'selected_type' => $typeInference['selected_type'] ?? $report->type,
                            'inferred_type' => $typeInference['inferred_type'] ?? $report->type,
                            'resolved_type' => $typeInference['resolved_type'] ?? $report->type,
                            'was_corrected' => (bool) ($typeInference['was_corrected'] ?? false),
                            'confidence' => (int) ($typeInference['confidence'] ?? 0),
                            'captured_at' => now()->toIso8601String(),
                        ],
                    ]
                );
                $report->save();

                // Submit to blockchain
                $report->submitToBlockchain();

                // Run AI classification (non-blocking — stores results in ai_summary)
                $this->runAIClassification($report, $validated);

                $this->logReportAction($report, 'REPORT_SUBMITTED', 'Report submitted successfully', [
                    'status' => $report->status,
                    'priority' => $report->priority,
                    'is_anonymous' => $report->is_anonymous,
                ]);

                $this->notificationService->notifyCaseEvent(
                    $report,
                    'NEW_CASE_SUBMITTED',
                    'New Case Submitted',
                    "New case {$report->reference_code} submitted with {$report->priority} priority.",
                    [
                        'case_id' => $report->case_id,
                        'reference_code' => $report->reference_code,
                        'priority' => $report->priority,
                        'risk_score' => $report->risk_score,
                    ]
                );

                return response()->json([
                    'success' => true,
                    'message' => $clarityScore < 60
                        ? 'Report submitted, but the description may be unclear. A clearer description helps investigators prioritize your case.'
                        : 'Report submitted successfully',
                    'data' => [
                        'case_id' => $report->case_id,
                        'reference_code' => $report->reference_code,
                        'status' => $report->status,
                        'priority' => $report->priority,
                        'risk_score' => $report->risk_score,
                        'type' => $report->type,
                        'type_selected' => $typeInference['selected_type'] ?? $report->type,
                        'type_corrected' => $typeInference['was_corrected'] ?? false,
                        'type_confidence' => $typeInference['confidence'] ?? null,
                        'created_at' => $report->created_at,
                        'is_anonymous' => $report->is_anonymous,
                        'report_language' => $report->report_language,
                        'text_clarity_score' => $report->text_clarity_score,
                    ],
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Error creating report: ' . $e->getMessage(), [
                'exception' => $e,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to submit report. Please try again.',
            ], 500);
        }
    }

    /**
     * Verify the specified report on blockchain.
     *
     * @param string $id
     * @return JsonResponse
     */
    public function verify($id)
    {
        $report = Report::where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        $verified = $report->verifyOnBlockchain();

        return response()->json([
            'success' => true,
            'verified' => $verified,
            'tx_hash' => $report->blockchain_tx_hash,
            'block_number' => $report->blockchain_block_number,
        ]);
    }

    /**
     * Display the specified report.
     */
    public function show($id)
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $report = Report::with([
            'user',
            'attachments' => fn ($query) => $query->latest('created_at'),
            'stageEvaluations' => fn ($query) => $query->with('investigator:id,name,email')->latest('created_at'),
        ])
            ->where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        // Check authorization: admins, investigators, or report owners can view
        if (!($user->isAdmin() || $user->isInvestigator() || $report->user_id === $user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }

    /**
     * Download an attachment belonging to a report.
     */
    public function downloadAttachment(Request $request, string $id, string $attachmentId)
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $report = Report::query()
            ->where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        if (!($user->isAdmin() || $user->isInvestigator() || $report->user_id === $user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $attachment = $report->attachments()->find($attachmentId);

        if (!$attachment) {
            return response()->json([
                'success' => false,
                'message' => 'Attachment not found',
            ], 404);
        }

        // Determine which storage disk and base path to use
        if ($attachment->disk === 'public') {
            $disk = Storage::disk('public');
            $basePath = 'app/public';
        } else {
            $disk = Storage::disk('local');
            $basePath = 'app/private';
        }

        $path = $attachment->file_name;

        if (!$disk->exists($path)) {
            // Try legacy path format
            $legacyPath = "reports/{$report->id}/attachments/{$attachment->file_name}";
            if ($disk->exists($legacyPath)) {
                $path = $legacyPath;
            }
        }

        if (!$disk->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'Attachment file is missing',
            ], 404);
        }

        return response()->download(
            storage_path($basePath . '/' . ltrim((string) $path, '/')),
            (string) $attachment->original_name
        );
    }

    /**
     * Update the specified report (admin/investigator only).
     */
    public function update(Request $request, $id)
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Investigator or Admin access required.',
            ], 403);
        }

        $report = Report::where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        $validated = $request->validate([
            'status' => 'nullable|in:SUBMITTED,UNDER_REVIEW,INVESTIGATING,REFERRED,SUCCESSFUL,CLOSED,DISPUTED',
            'priority' => 'nullable|in:LOW,MEDIUM,HIGH,CRITICAL',
            'risk_score' => 'nullable|integer|min:0|max:100',
            // only admins may set assignment via this endpoint
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        // Only allow admin to assign investigators
        if (isset($validated['assigned_to']) && !$user->isAdmin()) {
            unset($validated['assigned_to']);
        }

        $report->update(array_merge($validated, ['last_updated' => now()]));

        return response()->json([
            'success' => true,
            'message' => 'Report updated successfully',
            'data' => $report->load('user'),
        ]);
    }

    /**
     * Update the status of a report (admin/investigator only).
     */
    public function updateStatus(Request $request, $id)
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Investigator or Admin access required.',
            ], 403);
        }

        $report = Report::where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        $validated = $request->validate([
            'status' => 'required|in:SUBMITTED,UNDER_REVIEW,INVESTIGATING,REFERRED,SUCCESSFUL,CLOSED,DISPUTED',
            'comment' => 'nullable|string|min:3',
        ]);

        // If investigator is performing the transition, require a comment
        if ($user->isInvestigator()) {
            // investigator must be assigned to act
            if (!$report->assigned_to || $report->assigned_to !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to this report',
                ], 403);
            }

            if (empty($validated['comment'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Investigators must provide a comment when changing status.',
                ], 422);
            }
        }
        $previousStatus = $report->status;

        $report->update([
            'status' => $validated['status'],
            'last_updated' => now(),
        ]);

        // Log the status change and comment if provided
        if (!empty($validated['comment'])) {
            $this->logReportAction($report, 'STATUS_CHANGE', $validated['comment'], [
                'from' => $previousStatus,
                'to' => $validated['status'],
            ]);
        } else {
            $this->logReportAction($report, 'STATUS_CHANGE', 'Status changed', [
                'from' => $previousStatus,
                'to' => $validated['status'],
            ]);
        }

        // If the report is closed, run AI expert analysis and log the output
        if ($validated['status'] === 'CLOSED') {
            try {
                $decrypted = $report->decrypted_data;
                $description = $decrypted['description'] ?? $report->description ?? '';

                $aiController = new AIController();
                $aiRequest = new Request(['description' => $description]);
                $aiResponse = $aiController->analyzeReport($aiRequest);

                $aiData = [];
                if ($aiResponse instanceof JsonResponse) {
                    $respArr = $aiResponse->getData(true);
                    $aiData = $respArr['data'] ?? [];
                }

                // Store AI analysis in activity log and persist to report.ai_summary
                $this->logReportAction($report, 'AI_ANALYSIS', 'AI final analysis generated', [
                    'ai' => $aiData,
                ]);

                try {
                    $existingSummary = is_array($report->ai_summary) ? $report->ai_summary : [];
                    if (isset($existingSummary['type_inference']) && !isset($aiData['type_inference'])) {
                        $aiData['type_inference'] = $existingSummary['type_inference'];
                    }
                    $report->ai_summary = $aiData;
                    $report->save();
                } catch (\Exception $e) {
                    Log::warning('Failed to save AI summary to report: ' . $e->getMessage());
                }
            } catch (\Exception $e) {
                Log::error('AI analysis on close failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Status updated successfully',
            'data' => $report->load('user'),
        ]);
    }

    /**
     * Submit a dispute for a closed case.
     */
    public function dispute(Request $request, $id)
    {
        $user = Auth::user();
        $report = Report::where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
            ], 404);
        }

        // Check authorization - only the report owner can dispute
        if ($report->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. You can only dispute your own reports.',
            ], 403);
        }

        // Can only dispute closed cases
        if ($report->status !== 'CLOSED') {
            return response()->json([
                'success' => false,
                'message' => 'Only closed cases can be disputed',
            ], 400);
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:10',
        ]);

        $report->update([
            'status' => 'DISPUTED',
            'priority' => 'CRITICAL',
            'dispute_reason' => $validated['reason'],
            'last_updated' => now(),
        ]);

        $this->logReportAction($report, 'REPORT_DISPUTED', 'Whistleblower disputed final outcome', [
            'reason' => $validated['reason'],
            'closed_at_stage' => $report->closed_at_stage,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dispute submitted successfully',
            'data' => $report->load('user'),
        ]);
    }

    /**
     * Recalculate priority and risk_score for all reports using the latest
     * expert system scoring.  Admin-only endpoint.
     */
    public function recalculatePriorities(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Admin access required',
            ], 403);
        }

        $reports = Report::with('attachments')->get();
        $total   = $reports->count();
        $updated = 0;
        $details = [];

        foreach ($reports as $report) {
            $oldPriority = $report->priority;
            $oldRisk     = $report->risk_score;
            $changed     = $this->recalculateReportPriority($report);
            if ($changed) {
                $updated++;
                $details[] = [
                    'case_id'      => $report->case_id,
                    'old_priority' => $oldPriority,
                    'new_priority' => $report->priority,
                    'old_risk'     => $oldRisk,
                    'new_risk'     => $report->risk_score,
                ];
            }
        }

        return response()->json([
            'success'  => true,
            'message'  => "{$updated} of {$total} reports updated.",
            'total'    => $total,
            'updated'  => $updated,
            'details'  => $details,
        ]);
    }

    /**
     * Audit feed for expert type auto-corrections.
     * Accessible to admins and investigators.
     */
    public function typeCorrectionAudit(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !($user->isAdmin() || $user->isInvestigator())) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $limit = max(1, min(200, (int) $request->query('limit', 50)));
        $scanLimit = max(80, min(800, $limit * 6));

        $reports = Report::query()
            ->with(['user:id,name,email'])
            ->latest('created_at')
            ->take($scanLimit)
            ->get();

        $items = $reports
            ->filter(function (Report $report) {
                $summary = is_array($report->ai_summary) ? $report->ai_summary : [];
                return (bool) ($summary['type_inference']['was_corrected'] ?? false);
            })
            ->take($limit)
            ->map(function (Report $report) {
                $summary = is_array($report->ai_summary) ? $report->ai_summary : [];
                $inf = $summary['type_inference'] ?? [];

                return [
                    'case_id' => $report->case_id,
                    'reference_code' => $report->reference_code,
                    'priority' => $report->priority,
                    'status' => $report->status,
                    'selected_type' => $inf['selected_type'] ?? null,
                    'inferred_type' => $inf['inferred_type'] ?? null,
                    'resolved_type' => $inf['resolved_type'] ?? $report->type,
                    'confidence' => $inf['confidence'] ?? null,
                    'captured_at' => $inf['captured_at'] ?? optional($report->created_at)->toIso8601String(),
                    'created_at' => optional($report->created_at)->toIso8601String(),
                    'reporter' => $report->user ? [
                        'id' => $report->user->id,
                        'name' => $report->user->name,
                        'email' => $report->user->email,
                    ] : null,
                    'is_anonymous' => (bool) $report->is_anonymous,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'count' => $items->count(),
                'limit' => $limit,
                'scan_limit' => $scanLimit,
            ],
        ]);
    }

    /**
     * Get statistics for the dashboard.
     */
    public function stats()
    {
        $user = Auth::user();
        $cacheKey = 'report_stats_' . $user->id;

        $statsData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function () use ($user) {
            $query = Report::query();

            if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
                $query->where('user_id', $user->id);
            }

            $stats = $query->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN priority = 'CRITICAL' OR status = 'DISPUTED' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed,
                SUM(CASE WHEN status NOT IN ('CLOSED', 'DISPUTED') THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as resolved
            ")->first();

            $total = (int) $stats->total;
            $resolved = (int) $stats->resolved;
            $resolutionRate = $total > 0 ? round(($resolved / $total) * 100) : 0;

            return [
                'total' => $total,
                'critical' => (int) $stats->critical,
                'unsolvedDisputed' => (int) $stats->disputed,
                'active' => (int) $stats->active,
                'resolutionRate' => $resolutionRate,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $statsData,
        ]);
    }
}
