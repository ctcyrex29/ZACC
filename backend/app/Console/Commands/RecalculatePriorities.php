<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ReportControllerHelpers;
use App\Models\Report;
use Illuminate\Console\Command;

class RecalculatePriorities extends Command
{
    use ReportControllerHelpers;

    protected $signature = 'reports:recalculate-priorities {--case= : Recalculate a single case ID}';
    protected $description = 'Recalculate priority and risk score for all (or one) existing reports using the latest expert system.';

    public function handle(): int
    {
        $caseId = $this->option('case');

        if ($caseId) {
            $report = Report::where('case_id', $caseId)->orWhere('id', $caseId)->first();
            if (!$report) {
                $this->error("Report not found: {$caseId}");
                return 1;
            }
            $changed = $this->recalculateReportPriority($report);
            $this->info(sprintf(
                '[%s] %s → %s (risk %d) %s',
                $report->case_id,
                $report->getOriginal('priority') ?? '?',
                $report->priority,
                $report->risk_score,
                $changed ? '✓ updated' : '(no change)'
            ));
            return 0;
        }

        $reports = Report::with('attachments')->get();
        $total = $reports->count();
        $updated = 0;

        $this->info("Recalculating priorities for {$total} reports...");
        $this->newLine();

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($reports as $report) {
            $oldPriority = $report->priority;
            $oldRisk = $report->risk_score;

            $changed = $this->recalculateReportPriority($report);

            if ($changed) {
                $updated++;
                $this->newLine();
                $this->line(sprintf(
                    '  [%s] %s/%d → %s/%d',
                    $report->case_id,
                    $oldPriority,
                    $oldRisk,
                    $report->priority,
                    $report->risk_score
                ));
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. {$updated}/{$total} reports updated.");

        return 0;
    }
}
