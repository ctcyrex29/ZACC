<?php

namespace App\Services;

use App\Models\Report;
use Illuminate\Support\Facades\Storage;

class ExpertEvaluationService
{
    // ── Dimension weights (must sum to 1.0) ──
    private const WEIGHTS = [
        'severity'       => 0.20,
        'evidence'       => 0.18,
        'urgency'        => 0.15,
        'public_impact'  => 0.15,
        'credibility'    => 0.12,
        'scale'          => 0.10,
        'complexity'     => 0.10,
    ];

    /**
     * Stage evaluation — called when an investigator advances a case stage.
     */
    public function evaluateStage(Report $report, string $stage, string $notes = ''): array
    {
        $analysis = $this->analyzeCase($report, $notes);
        $score = $analysis['composite_score'];

        // Stage-based adjustments
        if (in_array($stage, ['REFERRED', 'DISPUTED'], true)) {
            $score = min(100, $score + 8);
        }

        $urgency = self::scoreToUrgency($score);

        return [
            'score'             => $score,
            'urgency'           => $urgency,
            'recommendation'    => $this->recommendationFor($stage, $score, $analysis),
            'next_review_hours' => $this->nextReviewHours($urgency),
            'dimensions'        => $analysis['dimensions'],
            'flags'             => $analysis['flags'],
        ];
    }

    /**
     * Generate a comprehensive pre-review findings report.
     * Available at ANY stage — produces a structured dossier analysis BEFORE
     * human review begins so investigators know what they're dealing with.
     */
    public function generatePreReviewReport(Report $report): array
    {
        $report->loadMissing(['attachments', 'stageEvaluations.investigator']);

        $decrypted = $report->decrypted_data;
        $description = $decrypted['description'] ?? $report->description ?? '';
        $institution = $decrypted['institution'] ?? $report->institution ?? '';
        $location    = $decrypted['location'] ?? $report->location ?? '';

        $analysis = $this->analyzeCase($report);
        $evidenceAssessment = $this->assessEvidence($report);

        // Build the findings report
        $score = $analysis['composite_score'];
        $urgency = self::scoreToUrgency($score);

        // Extract key claims from description
        $keyClaims = $this->extractKeyClaims($description);

        // Determine corruption indicators
        $corruptionIndicators = $this->identifyCorruptionIndicators(
            strtolower($description . ' ' . $institution . ' ' . $location)
        );

        // Build timeline indicators
        $timelineIndicators = $this->extractTimelineIndicators($description);

        // Compute case complexity
        $complexityLevel = 'LOW';
        if ($analysis['dimensions']['complexity']['score'] >= 70) $complexityLevel = 'HIGH';
        elseif ($analysis['dimensions']['complexity']['score'] >= 40) $complexityLevel = 'MEDIUM';

        return [
            'case_id'          => $report->case_id,
            'reference_code'   => $report->reference_code,
            'generated_at'     => now()->toIso8601String(),
            'status'           => $report->status,

            // Overall assessment
            'overall_score'    => $score,
            'overall_urgency'  => $urgency,
            'overall_priority' => $report->priority,
            'risk_level'       => $this->riskLevelLabel($score),

            // Dimensional breakdown
            'dimensions'       => $analysis['dimensions'],

            // Evidence assessment
            'evidence_assessment' => $evidenceAssessment,

            // Key extracted information
            'key_claims'          => $keyClaims,
            'corruption_indicators' => $corruptionIndicators,
            'timeline_indicators'   => $timelineIndicators,
            'complexity_level'      => $complexityLevel,

            // Red flags & concerns
            'flags'            => $analysis['flags'],

            // Actionable recommendations
            'recommendations'  => $this->generateRecommendations($analysis, $evidenceAssessment, $report),

            // Investigation checklist
            'investigation_checklist' => $this->generateChecklist($analysis, $evidenceAssessment, $report),

            // Summary narrative
            'summary'          => $this->generateSummaryNarrative($report, $analysis, $evidenceAssessment, $corruptionIndicators),
        ];
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CORE ANALYSIS ENGINE
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Multi-dimensional case analysis — the core scoring engine.
     */
    private function analyzeCase(Report $report, string $additionalNotes = ''): array
    {
        $decrypted = $report->decrypted_data;
        $type        = strtolower($report->type ?? '');
        $description = strtolower($decrypted['description'] ?? $report->description ?? '');
        $institution = strtolower($decrypted['institution'] ?? $report->institution ?? '');
        $location    = strtolower($decrypted['location'] ?? $report->location ?? '');
        $text        = $description . ' ' . $institution . ' ' . $location . ' ' . strtolower($additionalNotes);

        $dimensions = [];
        $flags = [];

        // ── 1. Severity ──
        $severityResult = $this->scoreSeverity($type, $text);
        $dimensions['severity'] = $severityResult;
        if ($severityResult['score'] >= 75) $flags[] = 'High-severity corruption type detected';

        // ── 2. Evidence strength ──
        $evidenceResult = $this->scoreEvidenceStrength($text, $report);
        $dimensions['evidence'] = $evidenceResult;
        if ($evidenceResult['score'] < 25) $flags[] = 'Very weak evidence — may need more substantiation';

        // ── 3. Urgency ──
        $urgencyResult = $this->scoreUrgency($text);
        $dimensions['urgency'] = $urgencyResult;
        if ($urgencyResult['score'] >= 70) $flags[] = 'Time-sensitive — ongoing corruption or evidence at risk';

        // ── 4. Public impact ──
        $impactResult = $this->scorePublicImpact($text);
        $dimensions['public_impact'] = $impactResult;
        if ($impactResult['score'] >= 70) $flags[] = 'Significant public impact — may affect vulnerable populations';

        // ── 5. Credibility ──
        $credibilityResult = $this->scoreCredibility($description, $report);
        $dimensions['credibility'] = $credibilityResult;
        if ($credibilityResult['score'] < 20) $flags[] = 'Low credibility indicators — vague or unsubstantiated report';

        // ── 6. Financial scale ──
        $scaleResult = $this->scoreFinancialScale($text);
        $dimensions['scale'] = $scaleResult;
        if ($scaleResult['score'] >= 70) $flags[] = 'Large financial amounts involved';

        // ── 7. Complexity ──
        $complexityResult = $this->scoreComplexity($text, $report);
        $dimensions['complexity'] = $complexityResult;
        if ($complexityResult['score'] >= 70) $flags[] = 'Complex case — may require specialist investigators or forensic analysis';

        // ── Senior official involvement (cross-cutting flag) ──
        $seniorOfficials = [
            'president', 'vice president', 'prime minister', 'minister',
            'permanent secretary', 'director general', 'commissioner',
            'attorney general', 'chief justice', 'governor', 'mayor',
            'managing director', 'board chairman', 'deputy minister',
            'inspector general', 'auditor general', 'speaker of parliament',
            'senator', 'member of parliament',
            // Shona
            'mutungamiriri', 'mukuru wehurumende', 'gweta rehurumende',
            'mutongi mukuru', 'gavhuna', 'meya',
            // Ndebele
            'umongameli', 'undunankulu', 'ungqongqoshe', 'imeya',
        ];
        foreach ($seniorOfficials as $kw) {
            if (str_contains($text, $kw)) {
                $flags[] = 'Senior official involvement detected: ' . $kw;
                break;
            }
        }

        // ── Compute weighted composite score ──
        $composite = 0;
        foreach (self::WEIGHTS as $dim => $weight) {
            $composite += ($dimensions[$dim]['score'] ?? 0) * $weight;
        }
        $composite = (int) round(min(100, max(0, $composite)));

        return [
            'composite_score' => $composite,
            'dimensions'      => $dimensions,
            'flags'           => array_values(array_unique($flags)),
        ];
    }

    // ── Dimension scorers ─────────────────────────────────────────────────

    private function scoreSeverity(string $type, string $text): array
    {
        $score = 0;
        $factors = [];

        // Type-based severity
        $typeScores = [
            'embezzlement'      => 75,
            'procurement fraud' => 70,
            'abuse of office'   => 55,
            'bribery'           => 50,
            'nepotism'          => 30,
            'money laundering'  => 80,
            'extortion'         => 75,
            'fraud'             => 60,
        ];
        foreach ($typeScores as $t => $pts) {
            if (str_contains($type, $t)) {
                $score = $pts;
                $factors[] = "Corruption type: {$t} (base severity {$pts})";
                break;
            }
        }
        if ($score === 0) {
            $score = 25;
            $factors[] = 'Unclassified corruption type (default severity)';
        }

        // Crime severity keyword amplifiers
        $crimeAmplifiers = [
            'money laundering' => 15, 'launder' => 12, 'forgery' => 10,
            'forged' => 10, 'phantom' => 12, 'ghost workers' => 14,
            'shell company' => 12, 'offshore' => 12, 'front company' => 12,
            'siphon' => 10, 'collusion' => 10, 'conspiracy' => 10,
            'intimidat' => 14, 'threaten' => 12, 'violence' => 15,
            'extort' => 12, 'coercion' => 10, 'plunder' => 10,
            'fictitious' => 10, 'falsified' => 10,
            // Shona
            'kuba mari' => 10, 'kushungurudza' => 12, 'kushandisa simba' => 10,
            'kupamba' => 10,
            // Ndebele
            'ukuphanga' => 10, 'ukwesabisa' => 12, 'ukudla imali' => 10,
        ];
        $amp = 0;
        foreach ($crimeAmplifiers as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $amp += $pts;
                $factors[] = "Crime keyword: {$kw}";
            }
        }
        $score = min(100, $score + min($amp, 30));

        return ['score' => $score, 'factors' => $factors, 'label' => $this->tierLabel($score)];
    }

    private function scoreEvidenceStrength(string $text, Report $report): array
    {
        $score = 0;
        $factors = [];

        // Described evidence types
        $evidenceKeywords = [
            'bank statement' => 12, 'affidavit' => 12, 'forensic' => 12,
            'recording' => 10, 'video' => 10, 'cctv' => 10,
            'audit report' => 10, 'audit' => 8, 'receipt' => 8,
            'invoice' => 8, 'contract copy' => 8, 'payslip' => 8,
            'voucher' => 7, 'document' => 6, 'email' => 7, 'screenshot' => 7,
            'photo' => 6, 'letter' => 5, 'witness' => 8, 'minutes' => 6,
            'proof' => 4, 'evidence' => 3,
        ];
        foreach ($evidenceKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
                $factors[] = "Evidence mentioned: {$kw}";
            }
        }
        $score = min(60, $score); // Cap textual evidence at 60

        // Attached files boost
        $attachmentCount = 0;
        if ($report->relationLoaded('attachments')) {
            $attachmentCount = $report->attachments->count();
        } elseif ($report->attachments_count !== null) {
            $attachmentCount = (int) $report->attachments_count;
        }

        if ($attachmentCount >= 5) {
            $score += 30;
            $factors[] = "Strong file evidence: {$attachmentCount} files attached";
        } elseif ($attachmentCount >= 3) {
            $score += 20;
            $factors[] = "Moderate file evidence: {$attachmentCount} files attached";
        } elseif ($attachmentCount >= 1) {
            $score += 10;
            $factors[] = "{$attachmentCount} file(s) attached";
        } else {
            $factors[] = 'No files attached';
        }

        // Check attachment types for quality
        if ($report->relationLoaded('attachments')) {
            foreach ($report->attachments as $att) {
                $mime = $att->mime_type ?? '';
                if (str_contains($mime, 'pdf')) {
                    $score += 3;
                    $factors[] = 'PDF document attached (likely formal)';
                    break;
                }
                if (str_contains($mime, 'video')) {
                    $score += 5;
                    $factors[] = 'Video evidence attached';
                    break;
                }
            }
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    private function scoreUrgency(string $text): array
    {
        $score = 0;
        $factors = [];

        $urgencyKeywords = [
            'happening now' => 20, 'ongoing' => 18, 'currently' => 15,
            'right now' => 20, 'today' => 12, 'this week' => 10,
            'urgent' => 15, 'imminent' => 18, 'about to' => 15,
            'deadline' => 12, 'tomorrow' => 10, 'evidence may be destroyed' => 25,
            'fleeing' => 22, 'leaving the country' => 25, 'destroy' => 15,
            'shred' => 18, 'delete' => 12, 'transfer assets' => 20,
            'tender closing' => 15, 'before it' => 10,
            // Shona
            'zviri kuitika' => 18, 'nhasi' => 12, 'pari zvino' => 15,
            'nekukurumidza' => 15, 'kutiza' => 22,
            'uchapupu hunogona kuparadzwa' => 25,
            // Ndebele
            'kuyenzeka' => 18, 'lamuhla' => 12, 'khathesi' => 15,
            'ngokuphangisa' => 15, 'ukubaleka' => 22,
            'ubufakazi bungalahlwa' => 25,
        ];
        foreach ($urgencyKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
                $factors[] = "Urgency indicator: {$kw}";
            }
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    private function scorePublicImpact(string $text): array
    {
        $score = 0;
        $factors = [];

        $impactKeywords = [
            'deaths' => 20, 'died' => 18, 'starvation' => 18,
            'public health' => 15, 'water supply' => 14, 'medicine' => 14,
            'medical supplies' => 15, 'food supply' => 14,
            'patients' => 12, 'orphan' => 14, 'disabled' => 12,
            'elderly' => 10, 'vulnerable' => 10, 'displaced' => 14,
            'hunger' => 14, 'injuries' => 12, 'children' => 10,
            'pension' => 12, 'school fees' => 10, 'salary' => 8,
            'community' => 8, 'residents' => 8, 'village' => 6,
            'infrastructure' => 8, 'road' => 6, 'bridge' => 6,
            'dam' => 8, 'hospital' => 10, 'school' => 8,
            // Shona
            'hutano hweveruzhinji' => 15, 'mvura' => 14, 'mushonga' => 14,
            'vana' => 10, 'varwere' => 12, 'nherera' => 14,
            'rufu' => 20, 'vakafa' => 18, 'nzara' => 14,
            // Ndebele
            'impilakahle' => 15, 'amanzi' => 14, 'umuthi' => 14,
            'abantwana' => 10, 'izigulane' => 12, 'izintandane' => 14,
            'ukufa' => 20, 'indlala' => 14,
        ];
        foreach ($impactKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
                $factors[] = "Public impact: {$kw}";
            }
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    private function scoreCredibility(string $description, Report $report): array
    {
        $score = 0;
        $factors = [];

        // Description length / detail
        $len = strlen($description);
        if ($len > 1000) {
            $score += 25;
            $factors[] = 'Detailed description (>1000 chars)';
        } elseif ($len > 500) {
            $score += 18;
            $factors[] = 'Reasonably detailed description';
        } elseif ($len > 250) {
            $score += 10;
            $factors[] = 'Moderate description length';
        } elseif ($len > 100) {
            $score += 5;
            $factors[] = 'Brief description';
        } else {
            $factors[] = 'Very short description — low detail';
        }

        // Named entities (specific people, places, dates)
        $text = strtolower($description);

        // Dates mentioned
        $dateCount = 0;
        if (preg_match_all('/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/', $text, $m)) $dateCount += count($m[0]);
        if (preg_match_all('/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i', $text, $m)) $dateCount += count($m[0]);
        if (preg_match_all('/\b20[12]\d\b/', $text, $m)) $dateCount += count($m[0]);
        if ($dateCount > 0) {
            $score += min($dateCount * 8, 20);
            $factors[] = "{$dateCount} date reference(s) found — temporal specificity";
        }

        // Specific amounts
        if (preg_match('/(?:\$|us\$|z\$|zig|usd|zwl)\s*[\d,]+/i', $text)) {
            $score += 10;
            $factors[] = 'Specific monetary amounts cited';
        }

        // Named individuals (capitalized words that look like names)
        if (preg_match_all('/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/', $description, $m)) {
            $nameCount = min(count($m[0]), 4);
            $score += $nameCount * 5;
            $factors[] = "{$nameCount} possible named individual(s)";
        }

        // Authenticated reporter bonus
        if ($report->user_id) {
            $score += 10;
            $factors[] = 'Authenticated reporter (identity on record)';
        } else {
            $factors[] = 'Anonymous report — no identity verification';
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    private function scoreFinancialScale(string $text): array
    {
        $score = 0;
        $factors = [];

        $scaleKeywords = [
            'billion' => 35, 'trillion' => 40, 'million' => 25,
            'hundreds of thousands' => 18, 'syndicate' => 20,
            'cartel' => 20, 'systematic' => 15, 'organised' => 15,
            'organized' => 15, 'widespread' => 15, 'large scale' => 15,
            'network' => 10, 'ring' => 10, 'scheme' => 8,
            // Shona/Ndebele
            'bhiriyoni' => 35, 'miriyoni' => 25, 'izigidigidi' => 35,
            'isigidi' => 25, 'kwakawanda' => 15,
        ];
        foreach ($scaleKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
                $factors[] = "Scale indicator: {$kw}";
            }
        }

        // Currency amount detection
        if (preg_match('/(?:\$|us\$|z\$|zig)\s*[\d,]+/i', $text)) {
            $score += 10;
            $factors[] = 'Currency amounts detected';
        }
        if (preg_match('/\b\d{6,}\b/', $text)) {
            $score += 12;
            $factors[] = 'Large numeric value (6+ digits)';
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    private function scoreComplexity(string $text, Report $report): array
    {
        $score = 0;
        $factors = [];

        $complexityKeywords = [
            'shell company' => 15, 'offshore' => 15, 'front company' => 15,
            'multiple' => 8, 'network' => 10, 'international' => 12,
            'cross-border' => 15, 'laundering' => 12, 'syndicate' => 12,
            'conspiracy' => 10, 'collusion' => 10, 'cartel' => 12,
            'tender rigging' => 12, 'bid-rigging' => 12, 'procurement' => 8,
            'forensic' => 8, 'several departments' => 10, 'multiple ministries' => 12,
            'foreign' => 8, 'wire transfer' => 10,
        ];
        foreach ($complexityKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $score += $pts;
                $factors[] = "Complexity indicator: {$kw}";
            }
        }

        // Multiple institutions mentioned
        $govOrgs = ['ministry', 'department', 'council', 'authority', 'commission', 'parastatal'];
        $orgCount = 0;
        foreach ($govOrgs as $org) {
            if (str_contains($text, $org)) $orgCount++;
        }
        if ($orgCount >= 3) {
            $score += 15;
            $factors[] = "Multiple government entities mentioned ({$orgCount})";
        } elseif ($orgCount >= 2) {
            $score += 8;
            $factors[] = "Two government entities mentioned";
        }

        // High attachment count suggests documentary complexity
        $attachmentCount = $report->relationLoaded('attachments')
            ? $report->attachments->count()
            : ($report->attachments_count ?? 0);
        if ($attachmentCount >= 5) {
            $score += 10;
            $factors[] = 'High volume of evidence files';
        }

        return ['score' => min(100, $score), 'factors' => $factors, 'label' => $this->tierLabel(min(100, $score))];
    }

    // ══════════════════════════════════════════════════════════════════════
    //  EVIDENCE ASSESSMENT
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Assess evidence quality by analyzing attached files and described evidence.
     */
    private function assessEvidence(Report $report): array
    {
        $files = [];
        $totalScore = 0;
        $missingEvidence = [];
        $type = strtolower($report->type ?? '');

        if ($report->relationLoaded('attachments')) {
            foreach ($report->attachments as $att) {
                $mime = $att->mime_type ?? '';
                $name = strtolower($att->original_name ?? '');
                $size = $att->size ?? 0;

                $relevance = 'MEDIUM';
                $note = 'General supporting document';

                // Score based on file type relevance
                if (str_contains($mime, 'pdf')) {
                    $relevance = 'HIGH';
                    $note = 'PDF document — likely formal/official document';
                    $totalScore += 15;
                } elseif (str_contains($mime, 'video')) {
                    $relevance = 'HIGH';
                    $note = 'Video evidence — strong corroborative material';
                    $totalScore += 18;
                } elseif (str_contains($mime, 'audio')) {
                    $relevance = 'HIGH';
                    $note = 'Audio recording — potential witness/conversation evidence';
                    $totalScore += 15;
                } elseif (str_contains($mime, 'image')) {
                    $relevance = 'MEDIUM';
                    $note = 'Image evidence — screenshots, photos, or scanned documents';
                    $totalScore += 10;
                } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel') || str_contains($name, '.csv')) {
                    $relevance = 'HIGH';
                    $note = 'Spreadsheet — financial data or records';
                    $totalScore += 15;
                } elseif (str_contains($mime, 'text') || str_contains($mime, 'json')) {
                    $relevance = 'MEDIUM';
                    $note = 'Text/data file';
                    $totalScore += 8;

                    // Try to read content for deeper analysis
                    if ($size < 100000) {
                        try {
                            $content = Storage::disk($att->disk ?? 'private')->get($att->file_name);
                            if ($content && $this->contentContainsFinancialData($content)) {
                                $relevance = 'HIGH';
                                $note = 'Text file containing financial data or transactional records';
                                $totalScore += 10;
                            }
                        } catch (\Exception $e) {
                            // Skip
                        }
                    }
                } else {
                    $totalScore += 5;
                }

                // Name-based relevance boost
                $evidentialNames = ['receipt', 'invoice', 'statement', 'contract', 'tender', 'audit', 'report', 'affidavit', 'voucher'];
                foreach ($evidentialNames as $en) {
                    if (str_contains($name, $en)) {
                        $relevance = 'HIGH';
                        $note .= " — filename suggests {$en}";
                        $totalScore += 5;
                        break;
                    }
                }

                $files[] = [
                    'file'      => $att->original_name,
                    'type'      => $mime,
                    'size'      => $size,
                    'relevance' => $relevance,
                    'note'      => $note,
                ];
            }
        }

        // Determine what evidence is missing based on case type
        $missingEvidence = $this->determineMissingEvidence($type, $report);

        $quality = 'INSUFFICIENT';
        if ($totalScore >= 60) $quality = 'STRONG';
        elseif ($totalScore >= 35) $quality = 'MODERATE';
        elseif ($totalScore >= 15) $quality = 'WEAK';

        return [
            'quality'           => $quality,
            'quality_score'     => min(100, $totalScore),
            'files_analyzed'    => count($files),
            'file_assessments'  => $files,
            'missing_evidence'  => $missingEvidence,
        ];
    }

    private function contentContainsFinancialData(string $content): bool
    {
        $content = strtolower(mb_substr($content, 0, 5000));
        $financial = ['amount', 'total', 'balance', 'debit', 'credit', 'transaction', 'payment', 'transfer', 'invoice', 'account'];
        $hits = 0;
        foreach ($financial as $kw) {
            if (str_contains($content, $kw)) $hits++;
        }
        return $hits >= 2;
    }

    private function determineMissingEvidence(string $type, Report $report): array
    {
        $missing = [];
        $hasAttachments = $report->relationLoaded('attachments') ? $report->attachments->count() > 0 : false;

        if (!$hasAttachments) {
            $missing[] = 'No physical evidence attached — any documents, photos, or recordings would strengthen this case significantly';
        }

        if (str_contains($type, 'procurement') || str_contains($type, 'embezzlement')) {
            $missing[] = 'Financial records (bank statements, invoices, receipts) should be obtained';
            $missing[] = 'Procurement tender documents and award letters needed';
            $missing[] = 'Audit reports from relevant period would be valuable';
        }
        if (str_contains($type, 'bribery')) {
            $missing[] = 'Witness statements from individuals involved or present during transactions';
            $missing[] = 'Communication records (emails, SMS, WhatsApp messages) may provide evidence';
            $missing[] = 'Any recordings (audio/video) of bribery transactions';
        }
        if (str_contains($type, 'abuse')) {
            $missing[] = 'Official communications showing abuse of authority';
            $missing[] = 'Institutional policy documents to demonstrate violations';
            $missing[] = 'Testimony from affected parties or subordinates';
        }
        if (str_contains($type, 'nepotism')) {
            $missing[] = 'Organizational charts and appointment records';
            $missing[] = 'Evidence of family/personal relationships between parties';
            $missing[] = 'Interview records and qualification comparisons for appointed positions';
        }

        if (empty($missing)) {
            $missing[] = 'Consider obtaining corroborating statements from additional witnesses';
        }

        return $missing;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  EXTRACTION & GENERATION HELPERS
    // ══════════════════════════════════════════════════════════════════════

    private function extractKeyClaims(string $description): array
    {
        $claims = [];
        $sentences = preg_split('/[.!?]+/', $description, -1, PREG_SPLIT_NO_EMPTY);

        foreach ($sentences as $sentence) {
            $s = trim($sentence);
            if (strlen($s) < 15) continue;

            $lower = strtolower($s);
            // Sentences containing factual assertions
            $claimIndicators = [
                'bribe', 'stole', 'embezzle', 'divert', 'misuse', 'fake', 'phantom',
                'awarded', 'contract', 'paid', 'million', 'billion', 'amount', 'fund',
                'received', 'transferred', 'witnessed', 'document', 'evidence',
                'inflated', 'overpriced', 'siphon', 'ghost', 'fictitious',
            ];

            foreach ($claimIndicators as $indicator) {
                if (str_contains($lower, $indicator)) {
                    $claims[] = $s;
                    break;
                }
            }
        }

        // If no specific claims detected, take the first 3 substantial sentences
        if (empty($claims)) {
            foreach ($sentences as $sentence) {
                $s = trim($sentence);
                if (strlen($s) >= 30) {
                    $claims[] = $s;
                    if (count($claims) >= 3) break;
                }
            }
        }

        return array_slice($claims, 0, 8);
    }

    private function identifyCorruptionIndicators(string $text): array
    {
        $indicators = [];
        $patterns = [
            'Bribery / Kickbacks'        => ['bribe', 'kickback', 'chiokomuhomwe', 'ukufumbathisa'],
            'Embezzlement'               => ['embezzle', 'siphon', 'divert funds', 'kuba mari', 'ukudla imali'],
            'Procurement Fraud'          => ['tender', 'bid-rig', 'overpricing', 'inflated', 'phantom'],
            'Ghost Workers'              => ['ghost worker', 'phantom employee', 'fictitious'],
            'Money Laundering'           => ['launder', 'shell company', 'offshore', 'front company'],
            'Abuse of Office'            => ['abuse of office', 'cushandisa simba', 'ukusebenzisa amandla'],
            'Nepotism / Favoritism'      => ['nepotism', 'relative', 'family member', 'connected'],
            'Forgery / Falsification'    => ['forge', 'falsif', 'fake document', 'fabricat'],
            'Intimidation / Threats'     => ['intimidat', 'threaten', 'violence', 'coercion'],
            'Collusion / Conspiracy'     => ['collusion', 'conspiracy', 'collude', 'syndicate', 'cartel'],
            'Conflict of Interest'       => ['conflict of interest', 'dual role', 'self-dealing'],
        ];

        foreach ($patterns as $label => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($text, $kw)) {
                    $indicators[] = $label;
                    break;
                }
            }
        }

        return array_values(array_unique($indicators));
    }

    private function extractTimelineIndicators(string $description): array
    {
        $indicators = [];
        $text = $description;

        // Extract specific dates
        if (preg_match_all('/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/', $text, $m)) {
            foreach ($m[0] as $date) {
                $indicators[] = "Specific date referenced: {$date}";
            }
        }

        // Extract month-year references
        if (preg_match_all('/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i', $text, $m)) {
            foreach ($m[0] as $ref) {
                $indicators[] = "Month reference: {$ref}";
            }
        }

        // Extract year references
        if (preg_match_all('/\b(20[12]\d)\b/', $text, $m)) {
            foreach (array_unique($m[0]) as $year) {
                $indicators[] = "Year referenced: {$year}";
            }
        }

        // Temporal phrases
        $phrases = [
            'ongoing', 'since', 'for the past', 'started in', 'began',
            'last year', 'last month', 'recently', 'currently',
        ];
        foreach ($phrases as $p) {
            if (str_contains(strtolower($text), $p)) {
                $indicators[] = "Temporal phrase: \"{$p}\" — suggests timeframe awareness";
                break;
            }
        }

        return array_slice($indicators, 0, 10);
    }

    private function generateRecommendations(array $analysis, array $evidence, Report $report): array
    {
        $recs = [];
        $dims = $analysis['dimensions'];

        // Based on urgency
        if ($dims['urgency']['score'] >= 60) {
            $recs[] = 'PRIORITY: Case has high urgency markers — assign to senior investigator within 6 hours';
            $recs[] = 'Consider asset freeze or evidence preservation order if applicable';
        } elseif ($dims['urgency']['score'] >= 30) {
            $recs[] = 'Assign case within 24 hours — moderate urgency detected';
        }

        // Based on evidence quality
        if ($evidence['quality'] === 'INSUFFICIENT' || $evidence['quality'] === 'WEAK') {
            $recs[] = 'Evidence is weak — request additional documentation from complainant before proceeding';
            $recs[] = 'Cross-reference described events with institutional records';
        }

        // Based on severity
        if ($dims['severity']['score'] >= 70) {
            $recs[] = 'High-severity case — consider multi-team investigation';
            $recs[] = 'Engage forensic accounting team for financial trail analysis';
        }

        // Based on complexity
        if ($dims['complexity']['score'] >= 60) {
            $recs[] = 'Complex case — assign experienced investigators with relevant domain expertise';
        }

        // Based on public impact
        if ($dims['public_impact']['score'] >= 60) {
            $recs[] = 'Significant public impact — may warrant expedited investigation timeline';
        }

        // Based on credibility
        if ($dims['credibility']['score'] < 30) {
            $recs[] = 'Low credibility markers — verify basic facts before committing full investigation resources';
        }

        // Default
        if (empty($recs)) {
            $recs[] = 'Proceed with standard investigation protocol';
            $recs[] = 'Verify complainant claims against available records';
        }

        return $recs;
    }

    private function generateChecklist(array $analysis, array $evidence, Report $report): array
    {
        $checklist = [
            ['task' => 'Verify complainant identity and credibility', 'priority' => 'HIGH'],
            ['task' => 'Cross-reference allegations with institutional records', 'priority' => 'HIGH'],
        ];

        if ($evidence['quality'] === 'INSUFFICIENT' || $evidence['quality'] === 'WEAK') {
            $checklist[] = ['task' => 'Request additional evidence from complainant', 'priority' => 'HIGH'];
        }

        if ($analysis['dimensions']['severity']['score'] >= 60) {
            $checklist[] = ['task' => 'Obtain financial records and audit trails', 'priority' => 'HIGH'];
            $checklist[] = ['task' => 'Identify and interview witnesses', 'priority' => 'HIGH'];
        }

        $checklist[] = ['task' => 'Review institutional procurement/appointment records', 'priority' => 'MEDIUM'];
        $checklist[] = ['task' => 'Check for related/similar cases in the system', 'priority' => 'MEDIUM'];
        $checklist[] = ['task' => 'Document all findings with timestamps', 'priority' => 'MEDIUM'];

        if ($analysis['dimensions']['complexity']['score'] >= 50) {
            $checklist[] = ['task' => 'Consult forensic specialists if financial complexity detected', 'priority' => 'MEDIUM'];
        }

        $checklist[] = ['task' => 'Prepare preliminary assessment report', 'priority' => 'LOW'];

        return $checklist;
    }

    private function generateSummaryNarrative(Report $report, array $analysis, array $evidence, array $indicators): string
    {
        $score = $analysis['composite_score'];
        $urgencyLabel = self::scoreToUrgency($score);

        $typeStr = $report->type ?? 'Unknown type';
        $institution = $report->institution ?? 'an undisclosed institution';
        $indicatorStr = !empty($indicators) ? implode(', ', array_slice($indicators, 0, 3)) : 'general corruption';

        $evidenceQuality = $evidence['quality'];
        $fileCount = $evidence['files_analyzed'];

        $summary = "This case involves a report of {$typeStr} at {$institution}, ";
        $summary .= "with indicators of {$indicatorStr}. ";
        $summary .= "The overall risk assessment scores {$score}/100 ({$urgencyLabel} urgency). ";
        $summary .= "Evidence strength is rated as {$evidenceQuality} with {$fileCount} file(s) submitted. ";

        if ($score >= 75) {
            $summary .= "This case warrants immediate attention and senior-level investigation oversight.";
        } elseif ($score >= 50) {
            $summary .= "The case presents moderate-to-high risk and should be investigated thoroughly.";
        } elseif ($score >= 25) {
            $summary .= "The case presents moderate risk — initial verification of claims is recommended before full investigation.";
        } else {
            $summary .= "The case presents low risk indicators — basic verification is recommended.";
        }

        return $summary;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  UTILITY
    // ══════════════════════════════════════════════════════════════════════

    private function recommendationFor(string $stage, int $score, array $analysis): string
    {
        $flags = $analysis['flags'] ?? [];
        $flagStr = !empty($flags) ? ' Flags: ' . implode('; ', array_slice($flags, 0, 2)) . '.' : '';

        if ($score >= 80) {
            return 'CRITICAL: Escalate to senior anti-corruption panel immediately.' . $flagStr;
        }
        if ($score >= 60) {
            return 'HIGH PRIORITY: Maintain active investigation and collect corroborating evidence.' . $flagStr;
        }
        if ($stage === 'UNDER_REVIEW') {
            return 'Continue validation of evidence and source credibility.' . $flagStr;
        }
        return 'Proceed with standard investigation workflow and periodic review.' . $flagStr;
    }

    private function nextReviewHours(string $urgency): int
    {
        return match ($urgency) {
            'CRITICAL' => 6,
            'HIGH'     => 12,
            'MEDIUM'   => 24,
            default    => 48,
        };
    }

    private static function scoreToUrgency(int $score): string
    {
        if ($score >= 75) return 'CRITICAL';
        if ($score >= 55) return 'HIGH';
        if ($score >= 35) return 'MEDIUM';
        return 'LOW';
    }

    private function tierLabel(int $score): string
    {
        if ($score >= 75) return 'Critical';
        if ($score >= 55) return 'High';
        if ($score >= 35) return 'Moderate';
        if ($score >= 15) return 'Low';
        return 'Minimal';
    }

    private function riskLevelLabel(int $score): string
    {
        if ($score >= 75) return 'CRITICAL — Immediate action required';
        if ($score >= 55) return 'HIGH — Urgent investigation recommended';
        if ($score >= 35) return 'MEDIUM — Standard investigation';
        return 'LOW — Preliminary assessment needed';
    }
}
