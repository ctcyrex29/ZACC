<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ReportGenerationController extends Controller
{
    /**
     * Generate a summary of all cases grouped by category:
     * - successful (CLOSED without dispute)
     * - in_progress (SUBMITTED, UNDER_REVIEW, INVESTIGATING, REFERRED)
     * - closed (all CLOSED including disputed-then-closed)
     * - disputed (DISPUTED)
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $filters = $request->only(['date_from', 'date_to', 'type', 'institution', 'province']);

        $query = Report::query();
        $this->applyFilters($query, $filters);

        $all = $query->get();

        $successful = $all->filter(fn($r) => $r->status === 'SUCCESSFUL');
        $inProgress = $all->filter(fn($r) => in_array($r->status, ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'REFERRED']));
        $closed = $all->filter(fn($r) => $r->status === 'CLOSED');
        $disputed = $all->filter(fn($r) => $r->status === 'DISPUTED');

        $total = $all->count();
        $avgRisk = $total > 0 ? round($all->avg('risk_score'), 1) : 0;

        // Priority breakdown
        $byPriority = $all->groupBy('priority')->map->count();

        // Type breakdown
        $byType = $all->groupBy('type')->map->count();

        // Monthly trend (last 12 months)
        $monthlyTrend = Report::select(
            DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN status = 'SUCCESSFUL' THEN 1 ELSE 0 END) as successful"),
            DB::raw("SUM(CASE WHEN status IN ('SUBMITTED','UNDER_REVIEW','INVESTIGATING','REFERRED') THEN 1 ELSE 0 END) as in_progress"),
            DB::raw("SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed"),
            DB::raw("SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed")
        )
            ->where('created_at', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'overview' => [
                    'total' => $total,
                    'successful' => $successful->count(),
                    'in_progress' => $inProgress->count(),
                    'closed' => $closed->count(),
                    'disputed' => $disputed->count(),
                    'avg_risk_score' => $avgRisk,
                    'resolution_rate' => $total > 0 ? round(($closed->count() / $total) * 100, 1) : 0,
                    'success_rate' => $total > 0 ? round(($successful->count() / $total) * 100, 1) : 0,
                ],
                'by_priority' => $byPriority,
                'by_type' => $byType,
                'monthly_trend' => $monthlyTrend,
                'successful_cases' => $successful->take(50)->map(fn($r) => $this->formatCase($r))->values(),
                'in_progress_cases' => $inProgress->take(50)->map(fn($r) => $this->formatCase($r))->values(),
                'closed_cases' => $closed->take(50)->map(fn($r) => $this->formatCase($r))->values(),
                'disputed_cases' => $disputed->take(50)->map(fn($r) => $this->formatCase($r))->values(),
            ],
        ]);
    }

    /**
     * Export cases as downloadable data (JSON format for frontend PDF generation).
     */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $category = $request->input('category', 'all');

        $query = Report::query();
        $this->applyFilters($query, $request->only(['date_from', 'date_to', 'type', 'institution']));

        switch ($category) {
            case 'successful':
                $query->where('status', 'SUCCESSFUL');
                break;
            case 'in_progress':
                $query->whereIn('status', ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'REFERRED']);
                break;
            case 'closed':
                $query->where('status', 'CLOSED');
                break;
            case 'disputed':
                $query->where('status', 'DISPUTED');
                break;
        }

        $cases = $query->orderBy('created_at', 'desc')->get()
            ->map(fn($r) => $this->formatCase($r));

        return response()->json([
            'success' => true,
            'data' => [
                'category' => $category,
                'generated_at' => now()->toISOString(),
                'total' => $cases->count(),
                'cases' => $cases,
            ],
        ]);
    }

    private function applyFilters($query, array $filters): void
    {
        if (!empty($filters['date_from'])) {
            $query->where('created_at', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('created_at', '<=', $filters['date_to']);
        }
        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (!empty($filters['institution'])) {
            $query->where('institution', 'LIKE', '%' . $filters['institution'] . '%');
        }
        if (!empty($filters['province'])) {
            $query->where('location', 'LIKE', '%' . $filters['province'] . '%');
        }
    }

    private function formatCase($report): array
    {
        $stageEvals = $report->stageEvaluations()
            ->with('investigator:id,name,email')
            ->orderBy('created_at')
            ->get()
            ->map(fn($s) => [
                'stage'              => $s->stage,
                'investigator_name'  => $s->investigator?->name ?? 'System',
                'investigator_email' => $s->investigator?->email ?? '',
                'notes'              => $s->investigator_notes,
                'final_score'        => $s->final_score,
                'performed_at'       => $s->created_at?->toISOString(),
            ])
            ->toArray();

        // Gather evidence summary
        $attachments = $report->attachments()->get();
        $evidenceCount = $attachments->count();
        $evidenceTypes = [];
        foreach ($attachments as $att) {
            $mime = strtolower($att->mime_type ?? '');
            if (str_contains($mime, 'image'))      $evidenceTypes['Images'] = ($evidenceTypes['Images'] ?? 0) + 1;
            elseif (str_contains($mime, 'video'))   $evidenceTypes['Videos'] = ($evidenceTypes['Videos'] ?? 0) + 1;
            elseif (str_contains($mime, 'audio'))   $evidenceTypes['Audio'] = ($evidenceTypes['Audio'] ?? 0) + 1;
            elseif (str_contains($mime, 'pdf'))     $evidenceTypes['PDFs'] = ($evidenceTypes['PDFs'] ?? 0) + 1;
            elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel'))
                                                    $evidenceTypes['Spreadsheets'] = ($evidenceTypes['Spreadsheets'] ?? 0) + 1;
            elseif (str_contains($mime, 'text') || str_contains($mime, 'json'))
                                                    $evidenceTypes['Text files'] = ($evidenceTypes['Text files'] ?? 0) + 1;
            else                                    $evidenceTypes['Documents'] = ($evidenceTypes['Documents'] ?? 0) + 1;
        }

        return [
            'case_id'        => $report->case_id,
            'reference_code' => $report->reference_code,
            'type'           => $report->type,
            'institution'    => $report->institution,
            'location'       => $report->location,
            'status'         => $report->status,
            'priority'       => $report->priority,
            'risk_score'     => $report->risk_score,
            'is_anonymous'   => $report->is_anonymous,
            'created_at'     => $report->created_at?->toISOString(),
            'last_updated'   => $report->last_updated,
            'dispute_reason' => $report->dispute_reason,
            'stage_history'  => $stageEvals,
            'evidence_count' => $evidenceCount,
            'evidence_types' => $evidenceTypes,
        ];
    }
}
