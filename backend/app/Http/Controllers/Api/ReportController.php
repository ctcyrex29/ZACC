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
            // Investigators can see all reports to review dossiers
            $query->with(['user' => function ($q) {
                $q->select('id', 'name', 'email');
            }]);
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

        // Priority is assigned by the expert system, not by the reporter.
        $expertPriority = $this->determineExpertPriority($validated);

        try {
            // Start database transaction
            return DB::transaction(function () use ($validated, $user, $expertPriority) {
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
                ];

                // Create the report
                $report = new Report($reportData);

                // Encrypt sensitive data
                $report->setEncryptedData([
                    'description' => $validated['description'],
                    'location' => $validated['location'] ?? null,
                    'institution' => $validated['institution'],
                ], $user->public_key);

                // Save the report
                $report->save();

                // Handle file uploads if any
                if (isset($validated['attachments'])) {
                    $this->handleAttachments($report, $validated['attachments']);
                }

                // Submit to blockchain
                $report->submitToBlockchain();

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
                    'message' => 'Report submitted successfully',
                    'data' => [
                        'case_id' => $report->case_id,
                        'reference_code' => $report->reference_code,
                        'status' => $report->status,
                        'created_at' => $report->created_at,
                        'is_anonymous' => $report->is_anonymous,
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
                'message' => 'Failed to submit report. Please try again: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Expert system: automatically determines case priority from report attributes.
     * Uses multi-factor analysis: corruption type severity, keyword significance,
     * entity/amount detection, description quality, and cross-referencing heuristics.
     */
    private function determineExpertPriority(array $data): string
    {
        $type = strtolower($data['type'] ?? '');
        $description = $data['description'] ?? '';
        $institution = $data['institution'] ?? '';
        $location = $data['location'] ?? '';
        $text = strtolower($description . ' ' . $institution . ' ' . $location);

        $score = 0;

        // ── Factor 1: Corruption Type Severity ──
        $typeScores = [
            'embezzlement'      => 40,
            'procurement fraud' => 35,
            'abuse of office'   => 25,
            'bribery'           => 20,
            'nepotism'          => 12,
            'other'             => 8,
        ];

        foreach ($typeScores as $t => $pts) {
            if (str_contains($type, $t)) {
                $score += $pts;
                break;
            }
        }

        // ── Factor 2: High-value targets / senior officials ──
        $seniorOfficials = [
            'president',
            'vice president',
            'prime minister',
            'minister',
            'permanent secretary',
            'director general',
            'commissioner',
            'attorney general',
            'chief justice',
            'governor',
            'mayor',
            'secretary',
            'chief executive',
            'managing director',
            'board chairman',
            'deputy minister',
            'ambassador',
            'consul',
        ];
        foreach ($seniorOfficials as $kw) {
            if (str_contains($text, $kw)) {
                $score += 25;
            }
        }

        // ── Factor 3: Scale indicators (large financial amounts) ──
        $largeScaleKeywords = [
            'million' => 30,
            'billion' => 35,
            'trillion' => 40,
            'widespread' => 20,
            'systematic' => 22,
            'organised' => 20,
            'organized' => 20,
            'syndicate' => 25,
            'cartel' => 25,
            'network' => 15,
            'ring' => 15,
            'scheme' => 12,
            'hundreds of thousands' => 18,
        ];
        foreach ($largeScaleKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
            }
        }

        // ── Factor 4: Numeric amount detection (USD/ZWL amounts) ──
        if (preg_match('/\$\s*[\d,]+(?:\.\d+)?/', $text) || preg_match('/(?:usd|zwl|us\$|z\$)\s*[\d,]+/i', $text)) {
            $score += 15;
        }
        if (preg_match('/\b\d{6,}\b/', $text)) {
            $score += 12;
        }

        // ── Factor 5: Government/public institution involvement ──
        $govKeywords = [
            'government' => 10,
            'public funds' => 12,
            'taxpayer' => 12,
            'contract' => 8,
            'tender' => 10,
            'ministry' => 9,
            'department' => 7,
            'council' => 8,
            'authority' => 8,
            'state' => 7,
            'national' => 7,
            'parastatal' => 10,
            'police' => 9,
            'army' => 9,
            'military' => 9,
            'hospital' => 8,
            'school' => 7,
            'university' => 8,
            'zesa' => 10,
            'zinwa' => 10,
            'zimra' => 10,
            'nssa' => 10,
        ];
        foreach ($govKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
            }
        }

        // ── Factor 6: Crime severity keywords ──
        $crimeKeywords = [
            'bribe' => 7,
            'fraud' => 8,
            'theft' => 8,
            'steal' => 8,
            'coercion' => 10,
            'embezzle' => 9,
            'kickback' => 10,
            'extort' => 12,
            'misuse' => 6,
            'stolen' => 8,
            'siphon' => 10,
            'inflate' => 8,
            'phantom' => 12,
            'launder' => 15,
            'money laundering' => 18,
            'forgery' => 10,
            'forged' => 10,
            'falsified' => 10,
            'illegal' => 6,
            'illicit' => 8,
            'ghost workers' => 15,
            'fictitious' => 12,
            'collusion' => 12,
            'conspiracy' => 10,
            'intimidat' => 12,
            'threaten' => 10,
        ];
        foreach ($crimeKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
            }
        }

        // ── Factor 7: Evidence quality indicators ──
        $evidenceKeywords = [
            'document' => 5,
            'receipt' => 6,
            'invoice' => 6,
            'proof' => 4,
            'witness' => 6,
            'recording' => 8,
            'photo' => 5,
            'video' => 7,
            'screenshot' => 5,
            'bank statement' => 8,
            'audit' => 7,
            'email' => 5,
            'letter' => 4,
        ];
        $evidenceBonus = 0;
        foreach ($evidenceKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $evidenceBonus += $pts;
            }
        }
        $score += min($evidenceBonus, 25);

        // ── Factor 8: Temporal specificity (dates/times mentioned) ──
        $datePatterns = 0;
        if (preg_match('/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/', $text)) $datePatterns++;
        if (preg_match('/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i', $text)) $datePatterns++;
        if (preg_match('/\b20[12]\d\b/', $text)) $datePatterns++;
        if ($datePatterns > 0) {
            $score += min($datePatterns * 5, 15);
        }

        // ── Factor 9: Description quality / length ──
        $len = strlen($description);
        if ($len > 1000) {
            $score += 20;
        } elseif ($len > 500) {
            $score += 15;
        } elseif ($len > 250) {
            $score += 8;
        } elseif ($len > 100) {
            $score += 3;
        }

        // ── Factor 10: Urgency / ongoing nature ──
        $urgencyKeywords = ['ongoing', 'happening now', 'today', 'currently', 'right now', 'this week', 'this month', 'urgent'];
        foreach ($urgencyKeywords as $kw) {
            if (str_contains($text, $kw)) {
                $score += 8;
                break;
            }
        }

        Log::info('Expert system scoring', [
            'type' => $type,
            'total_score' => $score,
            'desc_length' => $len,
        ]);

        if ($score >= 80) {
            return 'CRITICAL';
        }
        if ($score >= 45) {
            return 'HIGH';
        }
        if ($score >= 22) {
            return 'MEDIUM';
        }

        return 'LOW';
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

        $report = Report::with('user')
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
            'status' => 'nullable|in:SUBMITTED,UNDER_REVIEW,INVESTIGATING,REFERRED,CLOSED,DISPUTED',
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
            'status' => 'required|in:SUBMITTED,UNDER_REVIEW,INVESTIGATING,REFERRED,CLOSED,DISPUTED',
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
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dispute submitted successfully',
            'data' => $report->load('user'),
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
