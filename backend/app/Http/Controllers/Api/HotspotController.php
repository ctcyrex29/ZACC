<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HotspotController extends Controller
{
    /**
     * Zimbabwe provinces for mapping.
     */
    private const PROVINCES = [
        'Harare',
        'Bulawayo',
        'Manicaland',
        'Mashonaland Central',
        'Mashonaland East',
        'Mashonaland West',
        'Masvingo',
        'Matabeleland North',
        'Matabeleland South',
        'Midlands',
    ];

    /**
     * Get corruption hotspot data broken down by province, ministry/institution, and type.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        // By province (location field)
        $byProvince = $this->getByProvince();

        // By institution (top institutions with most reports)
        $byInstitution = Report::select('institution', DB::raw('COUNT(*) as total'))
            ->whereNotNull('institution')
            ->where('institution', '!=', '')
            ->groupBy('institution')
            ->orderByDesc('total')
            ->limit(20)
            ->get()
            ->map(fn($row) => [
                'name' => $row->institution,
                'total' => $row->total,
                'details' => $this->getInstitutionDetails($row->institution),
            ]);

        // By corruption type
        $byType = Report::select('type', DB::raw('COUNT(*) as total'))
            ->groupBy('type')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => [
                'name' => $row->type,
                'total' => $row->total,
            ]);

        // By status distribution
        $byStatus = Report::select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->get()
            ->pluck('total', 'status');

        // By priority distribution
        $byPriority = Report::select('priority', DB::raw('COUNT(*) as total'))
            ->groupBy('priority')
            ->get()
            ->pluck('total', 'priority');

        // Recent hotspot activity (last 30 days vs previous 30 days)
        $recentCount = Report::where('created_at', '>=', now()->subDays(30))->count();
        $previousCount = Report::whereBetween('created_at', [now()->subDays(60), now()->subDays(30)])->count();
        $trendPercent = $previousCount > 0
            ? round((($recentCount - $previousCount) / $previousCount) * 100, 1)
            : ($recentCount > 0 ? 100 : 0);

        // Top 5 critical hotspots (institutions with most CRITICAL/HIGH cases)
        $criticalHotspots = Report::select('institution', DB::raw('COUNT(*) as total'))
            ->whereIn('priority', ['CRITICAL', 'HIGH'])
            ->whereNotNull('institution')
            ->where('institution', '!=', '')
            ->groupBy('institution')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'by_province' => $byProvince,
                'by_institution' => $byInstitution,
                'by_type' => $byType,
                'by_status' => $byStatus,
                'by_priority' => $byPriority,
                'trend' => [
                    'recent_30_days' => $recentCount,
                    'previous_30_days' => $previousCount,
                    'change_percent' => $trendPercent,
                ],
                'critical_hotspots' => $criticalHotspots,
                'total_reports' => Report::count(),
            ],
        ]);
    }

    /**
     * Public hotspot summary (no auth, limited data).
     */
    public function publicHotspots(): JsonResponse
    {
        $byProvince = $this->getByProvince();

        $byType = Report::select('type', DB::raw('COUNT(*) as total'))
            ->groupBy('type')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => ['name' => $row->type, 'total' => $row->total]);

        $total = Report::count();

        return response()->json([
            'success' => true,
            'data' => [
                'by_province' => $byProvince,
                'by_type' => $byType,
                'total_reports' => $total,
            ],
        ]);
    }

    private function getByProvince(): array
    {
        $reports = Report::select('location', DB::raw('COUNT(*) as total'))
            ->whereNotNull('location')
            ->where('location', '!=', '')
            ->groupBy('location')
            ->get();

        $provinceData = [];

        foreach (self::PROVINCES as $province) {
            $count = 0;
            foreach ($reports as $report) {
                if (stripos($report->location, $province) !== false) {
                    $count += $report->total;
                }
            }

            // Also get breakdown for this province
            $typeBreakdown = Report::select('type', DB::raw('COUNT(*) as total'))
                ->where('location', 'LIKE', '%' . $province . '%')
                ->groupBy('type')
                ->get()
                ->pluck('total', 'type')
                ->toArray();

            $priorityBreakdown = Report::select('priority', DB::raw('COUNT(*) as total'))
                ->where('location', 'LIKE', '%' . $province . '%')
                ->groupBy('priority')
                ->get()
                ->pluck('total', 'priority')
                ->toArray();

            $provinceData[] = [
                'name' => $province,
                'total' => $count,
                'by_type' => $typeBreakdown,
                'by_priority' => $priorityBreakdown,
            ];
        }

        // Sort by total descending
        usort($provinceData, fn($a, $b) => $b['total'] - $a['total']);

        return $provinceData;
    }

    private function getInstitutionDetails(string $institution): array
    {
        $reports = Report::where('institution', $institution)->get();

        return [
            'by_type' => $reports->groupBy('type')->map->count()->toArray(),
            'by_status' => $reports->groupBy('status')->map->count()->toArray(),
            'by_priority' => $reports->groupBy('priority')->map->count()->toArray(),
            'avg_risk_score' => round($reports->avg('risk_score') ?? 0, 1),
        ];
    }
}
