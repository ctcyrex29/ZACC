<?php

namespace App\Services;

use App\Models\Report;

class ExpertEvaluationService
{
    public function evaluateStage(Report $report, string $stage, string $notes = ''): array
    {
        $text = strtolower(trim(implode(' ', [
            $report->type,
            $report->institution,
            $report->description,
            $notes,
        ])));

        $score = (int) ($report->risk_score ?? 50);

        $criticalKeywords = ['bribe', 'embezzle', 'launder', 'forgery', 'threat', 'violence'];
        $mediumKeywords = ['fraud', 'kickback', 'abuse', 'conflict', 'nepotism', 'favor'];

        foreach ($criticalKeywords as $keyword) {
            if (str_contains($text, $keyword)) {
                $score += 10;
            }
        }

        foreach ($mediumKeywords as $keyword) {
            if (str_contains($text, $keyword)) {
                $score += 5;
            }
        }

        if (in_array($stage, ['REFERRED', 'DISPUTED'], true)) {
            $score += 8;
        }

        $score = max(0, min(100, $score));

        $urgency = 'LOW';
        if ($score >= 80) {
            $urgency = 'CRITICAL';
        } elseif ($score >= 60) {
            $urgency = 'HIGH';
        } elseif ($score >= 40) {
            $urgency = 'MEDIUM';
        }

        return [
            'score' => $score,
            'urgency' => $urgency,
            'recommendation' => $this->recommendationFor($stage, $score),
            'next_review_hours' => $this->nextReviewHours($urgency),
        ];
    }

    private function recommendationFor(string $stage, int $score): string
    {
        if ($score >= 80) {
            return 'Escalate to senior anti-corruption panel immediately.';
        }

        if ($score >= 60) {
            return 'Maintain active investigation and collect corroborating evidence.';
        }

        if ($stage === 'UNDER_REVIEW') {
            return 'Continue validation of evidence and source credibility.';
        }

        return 'Proceed with standard investigation workflow and periodic review.';
    }

    private function nextReviewHours(string $urgency): int
    {
        return match ($urgency) {
            'CRITICAL' => 6,
            'HIGH' => 12,
            'MEDIUM' => 24,
            default => 48,
        };
    }
}
