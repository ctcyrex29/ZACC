<?php

namespace App\Http\Controllers\Api;

use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Helper methods for ReportController
 */
trait ReportControllerHelpers
{
    /**
     * Run AI classification on a submitted report.
     * Uses a two-layer approach: expert system sets a baseline, then Gemini AI
     * refines with deeper contextual analysis of description + file contents.
     * AI can only upgrade priority (never downgrade), ensuring the expert system
     * acts as a minimum floor.
     */
    protected function runAIClassification(Report $report, array $validated): void
    {
        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if (!$apiKey) {
                Log::info('AI classification skipped: no API key configured', [
                    'case_id' => $report->case_id,
                ]);
                return;
            }

            // Gather file contents from attachments
            $fileContents = [];
            foreach ($report->attachments as $attachment) {
                $readableTypes = [
                    'text/plain', 'text/csv', 'application/json', 'text/html',
                    'application/xml', 'text/xml', 'text/markdown',
                ];
                $readableExts = ['txt', 'csv', 'json', 'html', 'xml', 'md', 'log'];
                $ext = strtolower(pathinfo($attachment->original_name, PATHINFO_EXTENSION));
                $mime = strtolower($attachment->mime_type ?? '');

                if ((in_array($mime, $readableTypes) || in_array($ext, $readableExts))
                    && $attachment->size < 512000) {
                    try {
                        $content = \Illuminate\Support\Facades\Storage::disk($attachment->disk ?? 'private')
                            ->get($attachment->file_name);
                        if ($content) {
                            $fileContents[] = [
                                'name' => $attachment->original_name,
                                'content' => mb_substr($content, 0, 10000),
                            ];
                        }
                    } catch (\Exception $e) {
                        // Skip unreadable files
                    }
                } else {
                    // Include metadata and evidence type for binary files
                    $evidenceType = 'Binary file';
                    if (str_contains($mime, 'image')) {
                        $evidenceType = 'Photographic/image evidence';
                    } elseif (str_contains($mime, 'video')) {
                        $evidenceType = 'Video evidence/recording';
                    } elseif (str_contains($mime, 'audio')) {
                        $evidenceType = 'Audio evidence/recording';
                    } elseif (str_contains($mime, 'pdf')) {
                        $evidenceType = 'PDF document';
                    } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel')) {
                        $evidenceType = 'Spreadsheet/financial data';
                    } elseif (str_contains($mime, 'msword') || str_contains($mime, 'wordprocessingml')) {
                        $evidenceType = 'Word document';
                    }
                    $fileContents[] = [
                        'name' => $attachment->original_name,
                        'type' => $attachment->mime_type,
                        'size_bytes' => $attachment->size,
                        'evidence_type' => $evidenceType,
                        'note' => 'Content not directly readable but its type and existence are evidential.',
                    ];
                }
            }

            $caseData = json_encode([
                'type' => $validated['type'],
                'description' => $validated['description'],
                'institution' => $validated['institution'] ?? '',
                'location' => $validated['location'] ?? '',
                'attached_files' => $fileContents,
                'expert_system_priority' => $report->priority,
                'expert_system_risk_score' => $report->risk_score,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            $prompt = <<<PROMPT
You are a senior anti-corruption intelligence analyst at the Zimbabwe Anti-Corruption Commission (ZACC). You have 20+ years of experience investigating public sector corruption in Zimbabwe.

TASK: Perform a comprehensive analysis of the submitted corruption case below. Your analysis directly determines investigation priority and resource allocation.

ANALYSIS FRAMEWORK — Evaluate each dimension:

1. URGENCY ASSESSMENT
   - Is corruption ongoing or completed?
   - Is there risk of evidence destruction or tampering?
   - Are suspects likely to flee or transfer assets?
   - Is there imminent harm to public safety, health, or finances?
   - Are there statutory deadlines at risk (e.g. tender closing dates)?

2. CORRUPTION CLASSIFICATION
   - Primary category (e.g. Procurement Fraud, Grand Corruption, Petty Bribery, State Capture)
   - Sub-category (e.g. Bid-Rigging, Phantom Workers, Misuse of Constituency Development Funds)
   - Applicable Zimbabwe legislation (Prevention of Corruption Act, Public Finance Management Act, etc.)

3. PRIORITY DETERMINATION
   - Weight of evidence presented
   - Seniority of officials involved
   - Financial magnitude (absolute and relative to institution budget)
   - Public interest and media sensitivity
   - Pattern indicators (isolated vs systematic corruption)

4. RISK SCORING (0-100)
   - 0-25: Low risk — minor, isolated, low-value
   - 26-50: Moderate risk — noteworthy but contained
   - 51-75: High risk — significant amounts, senior officials, or systematic
   - 76-100: Critical risk — large-scale, high-level officials, ongoing harm

5. KEY FINDINGS — Extract specific factual claims from the description and file contents

6. RECOMMENDED ACTIONS — What should investigators do immediately?

7. EVIDENCE ASSESSMENT — Quality, sufficiency, and gaps in the submitted evidence

8. IMPACT ESTIMATION — Financial, social, and institutional impact scope

CASE DATA:
{$caseData}

IMPORTANT RULES:
- Be objective and analytical. Base conclusions strictly on the provided evidence.
- If the description is vague, note evidence gaps but still classify based on available information.
- The expert system already assigned priority "{$report->priority}" — you may keep or UPGRADE it but never downgrade.
- Provide your confidence level (0-100) in the classification.
- Write key_findings and recommended_actions as actionable, specific items.

Return ONLY valid JSON matching this exact schema:
{
  "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "urgency_reason": "2-3 sentence explanation",
  "category": "Primary corruption category",
  "sub_category": "Specific sub-type",
  "applicable_laws": ["Array of relevant Zimbabwe laws"],
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "risk_score": 0-100,
  "confidence": 0-100,
  "key_findings": ["Array of specific factual findings from the report"],
  "recommended_actions": ["Array of specific next steps for investigators"],
  "evidence_assessment": "Assessment of evidence quality and gaps",
  "estimated_impact": "Financial and social impact estimation",
  "pattern_indicators": "Whether this suggests isolated or systematic corruption",
  "investigation_complexity": "LOW" | "MEDIUM" | "HIGH"
}
PROMPT;

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $response = \Illuminate\Support\Facades\Http::timeout(30)
                ->retry(2, 500)
                ->acceptJson()
                ->post($url, [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'responseMimeType' => 'application/json',
                        'temperature' => 0.2,
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('AI classification Gemini API error', [
                    'case_id' => $report->case_id,
                    'http_status' => $response->status(),
                ]);
                return;
            }

            $text = $response->json('candidates.0.content.parts.0.text');

            if (!is_string($text) || trim($text) === '') {
                Log::warning('AI classification returned empty response', [
                    'case_id' => $report->case_id,
                ]);
                return;
            }

            $aiResult = json_decode($text, true);
            if (!$aiResult) {
                // Try extracting JSON from markdown code blocks or surrounding text
                if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $text, $matches)) {
                    $aiResult = json_decode($matches[1], true);
                } elseif (preg_match('/\{.*\}/s', $text, $matches)) {
                    $aiResult = json_decode($matches[0], true);
                }
            }

            if (!$aiResult || !is_array($aiResult)) {
                Log::warning('AI classification could not parse JSON response', [
                    'case_id' => $report->case_id,
                    'raw_text_preview' => mb_substr($text, 0, 200),
                ]);
                return;
            }

            // Validate required fields
            $requiredFields = ['urgency', 'priority', 'risk_score'];
            foreach ($requiredFields as $field) {
                if (!isset($aiResult[$field])) {
                    Log::warning("AI classification missing required field: {$field}", [
                        'case_id' => $report->case_id,
                    ]);
                    return;
                }
            }

            // Normalize priority values
            $validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            $aiResult['urgency'] = strtoupper($aiResult['urgency'] ?? 'MEDIUM');
            $aiResult['priority'] = strtoupper($aiResult['priority'] ?? 'MEDIUM');
            if (!in_array($aiResult['urgency'], $validPriorities)) $aiResult['urgency'] = 'MEDIUM';
            if (!in_array($aiResult['priority'], $validPriorities)) $aiResult['priority'] = 'MEDIUM';
            $aiResult['risk_score'] = max(0, min(100, (int) $aiResult['risk_score']));
            $aiResult['confidence'] = max(0, min(100, (int) ($aiResult['confidence'] ?? 50)));

            // Add metadata
            $aiResult['classified_at'] = now()->toIso8601String();
            $aiResult['model_used'] = $model;

            // Store AI classification while preserving non-AI metadata (e.g., type inference).
            $existingSummary = is_array($report->ai_summary) ? $report->ai_summary : [];
            if (isset($existingSummary['type_inference']) && !isset($aiResult['type_inference'])) {
                $aiResult['type_inference'] = $existingSummary['type_inference'];
            }
            $report->ai_summary = $aiResult;

            // AI can only upgrade priority, never downgrade
            $priorityRank = ['LOW' => 1, 'MEDIUM' => 2, 'HIGH' => 3, 'CRITICAL' => 4];
            $aiPriority = $aiResult['priority'];
            $currentPriority = $report->priority;

            if (($priorityRank[$aiPriority] ?? 0) > ($priorityRank[$currentPriority] ?? 0)) {
                $report->priority = $aiPriority;
                $aiRisk = $aiResult['risk_score'];
                $report->risk_score = max($report->risk_score, $aiRisk);
            }

            $report->save();

            Log::info('AI classification completed', [
                'case_id' => $report->case_id,
                'expert_priority' => $currentPriority,
                'ai_priority' => $aiPriority,
                'final_priority' => $report->priority,
                'ai_urgency' => $aiResult['urgency'],
                'ai_risk_score' => $aiResult['risk_score'],
                'ai_confidence' => $aiResult['confidence'],
                'category' => $aiResult['category'] ?? 'unknown',
            ]);
        } catch (\Exception $e) {
            // Non-blocking — report is already saved; AI is an enhancement
            Log::warning('AI classification failed (non-blocking)', [
                'case_id' => $report->case_id ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle file attachments for reports.
     *
     * @param Report $report
     * @param array $attachments
     * @return void
     */
    protected function handleAttachments(Report $report, array $attachments): void
    {
        foreach ($attachments as $file) {
            if ($file->isValid()) {
                $path = $file->store("reports/{$report->id}/attachments", 'local');

                $report->attachments()->create([
                    'original_name' => $file->getClientOriginalName(),
                    'file_name' => $path,
                    'mime_type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                    'disk' => 'local',
                    'created_by' => Auth::id(),
                ]);
            }
        }
    }

    /**
     * Raw expert score from the last determineExpertPriority() call.
     * Used by calculateRiskScore() for proportional risk assessment.
     */
    protected int $lastExpertRawScore = 0;

    /**
     * Text clarity assessment from the last determineExpertPriority() call.
     */
    protected array $lastClarityResult = [];

    /**
     * Type inference metadata from the last determineExpertPriority() call.
     */
    protected array $lastTypeInference = [];

    /**
     * Normalize user/AI supplied corruption type labels to canonical values.
     */
    protected function normalizeCorruptionType(string $type): string
    {
        $normalized = strtolower(trim($type));
        $compact = str_replace(['_', '-', '  '], ' ', $normalized);

        $map = [
            'bribery' => 'Bribery',
            'bribe' => 'Bribery',
            'petty bribery' => 'Bribery',
            'procurement fraud' => 'Procurement Fraud',
            'procurement' => 'Procurement Fraud',
            'tender fraud' => 'Procurement Fraud',
            'abuse of office' => 'Abuse of Office',
            'abuse' => 'Abuse of Office',
            'misuse of office' => 'Abuse of Office',
            'embezzlement' => 'Embezzlement',
            'embezzle' => 'Embezzlement',
            'nepotism' => 'Nepotism',
            'fraud' => 'Other',
            'extortion' => 'Other',
            'money laundering' => 'Other',
            'other' => 'Other',
            'uncategorized' => 'Other',
            'unknown' => 'Other',
            'bribery and corruption' => 'Bribery',
            'abuse_of_office' => 'Abuse of Office',
            'procurement_fraud' => 'Procurement Fraud',
        ];

        return $map[$compact] ?? ucfirst($compact ?: 'other');
    }

    /**
     * Infer corruption type from narrative/evidence text and correct wrong selections.
     *
     * Returns metadata including selected, inferred and resolved type.
     * A correction is only made when confidence and score margin are sufficient.
     */
    protected function inferCorruptionType(array $data): array
    {
        $selectedType = $this->normalizeCorruptionType((string) ($data['type'] ?? 'Other'));
        $text = strtolower(
            trim(
                ($data['description'] ?? '') . ' ' .
                ($data['institution'] ?? '') . ' ' .
                ($data['location'] ?? '')
            )
        );

        $signals = [
            'Bribery' => [
                'bribe' => 8, 'bribery' => 8, 'kickback' => 9, 'brown envelope' => 7,
                'payment to officer' => 6, 'paid official' => 6, 'chiokomuhomwe' => 8,
                'rushwa' => 8, 'kupihwa mari' => 5,
            ],
            'Procurement Fraud' => [
                'procurement' => 9, 'tender' => 9, 'bid' => 6, 'bid rigging' => 10,
                'supplier' => 5, 'quotation' => 6, 'invoice inflation' => 8,
                'overpricing' => 8, 'contract award' => 7, 'ghost company' => 8,
                'shell company' => 8, 'irregular tender' => 9,
            ],
            'Abuse of Office' => [
                'abuse of office' => 10, 'misuse of power' => 9, 'misuse of office' => 9,
                'abuse' => 5, 'authority' => 4, 'position' => 4,
                'kushandisa simba' => 8, 'ukusebenzisa amandla' => 8,
            ],
            'Embezzlement' => [
                'embezzle' => 10, 'embezzlement' => 10, 'stole funds' => 8,
                'stolen funds' => 8, 'diverted funds' => 8, 'misappropriation' => 8,
                'siphon' => 8, 'loot' => 7, 'kuba mari' => 8, 'ukudla imali' => 8,
            ],
            'Nepotism' => [
                'nepotism' => 10, 'relative appointed' => 9, 'family hired' => 8,
                'favouritism' => 8, 'favoritism' => 8, 'brother appointed' => 8,
                'sister appointed' => 8, 'son appointed' => 8, 'daughter appointed' => 8,
            ],
            'Other' => [
                'fraud' => 5, 'extortion' => 6, 'coercion' => 5, 'intimidation' => 4,
            ],
        ];

        $scores = [];
        foreach ($signals as $type => $keywords) {
            $scores[$type] = 0;
            foreach ($keywords as $kw => $pts) {
                if (str_contains($text, $kw)) {
                    $scores[$type] += $pts;
                }
            }
        }

        // Respect user choice lightly, but allow confident correction.
        if (isset($scores[$selectedType])) {
            $scores[$selectedType] += 3;
        }

        arsort($scores);
        $rankedTypes = array_keys($scores);
        $bestType = $rankedTypes[0] ?? $selectedType;
        $bestScore = (int) ($scores[$bestType] ?? 0);
        $secondScore = (int) ($scores[$rankedTypes[1] ?? $bestType] ?? 0);
        $margin = max(0, $bestScore - $secondScore);

        $confidence = min(95, 40 + ($bestScore * 4) + ($margin * 5));
        $shouldCorrect = ($bestType !== $selectedType) && $bestScore >= 10 && $margin >= 3;
        $resolvedType = $shouldCorrect ? $bestType : $selectedType;

        return [
            'selected_type' => $selectedType,
            'inferred_type' => $bestType,
            'resolved_type' => $resolvedType,
            'was_corrected' => $shouldCorrect,
            'confidence' => $confidence,
            'best_score' => $bestScore,
            'margin' => $margin,
            'scores' => $scores,
        ];
    }

    /**
     * Extract readable text from a report's uploaded attachments.
     * Reads .txt, .csv, .json, .md, .log and similar text files.
     * For binary files (images, PDFs) returns filenames & metadata only.
     * @return string Combined text content for keyword analysis.
     */
    protected function extractTextFromAttachments(Report $report): string
    {
        $report->loadMissing('attachments');
        $fileText = '';
        $readableTypes = [
            'text/plain', 'text/csv', 'application/json', 'text/html',
            'application/xml', 'text/xml', 'text/markdown',
        ];
        $readableExts = ['txt', 'csv', 'json', 'html', 'xml', 'md', 'log'];

        foreach ($report->attachments as $attachment) {
            $mime = strtolower($attachment->mime_type ?? '');
            $ext = strtolower(pathinfo($attachment->original_name, PATHINFO_EXTENSION));
            $readable = in_array($mime, $readableTypes) || in_array($ext, $readableExts);

            if ($readable && $attachment->size < 1048576) {
                try {
                    $content = \Illuminate\Support\Facades\Storage::disk($attachment->disk ?? 'private')
                        ->get($attachment->file_name);
                    if ($content) {
                        $fileText .= ' [FILE: ' . strtolower($attachment->original_name ?? 'unknown') . '] '
                                  . mb_substr($content, 0, 50000);
                    }
                } catch (\Exception $e) {
                    // Skip unreadable files
                }
            }

            // Inject evidence-type phrases for binary files
            if (str_contains($mime, 'image')) {
                $fileText .= ' photo image evidence screenshot visual proof';
            } elseif (str_contains($mime, 'video')) {
                $fileText .= ' video evidence recording visual proof cctv footage';
            } elseif (str_contains($mime, 'audio')) {
                $fileText .= ' audio evidence recording voice conversation witness statement';
            } elseif (str_contains($mime, 'pdf')) {
                $fileText .= ' pdf document formal official evidence';
            } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel')
                      || in_array($ext, ['xls', 'xlsx'])) {
                $fileText .= ' spreadsheet financial data records evidence';
            } elseif (str_contains($mime, 'msword') || str_contains($mime, 'wordprocessingml')
                      || in_array($ext, ['doc', 'docx'])) {
                $fileText .= ' document formal written evidence report';
            }

            // Always contribute file metadata so file count/type is considered
            $fileText .= ' file:' . strtolower($attachment->original_name ?? '');
        }

        return $fileText;
    }

    /**
     * Score bonus based on number & types of attached files (0-15).
     */
    protected function scoreAttachmentBonus(Report $report): int
    {
        $report->loadMissing('attachments');
        $count = $report->attachments->count();
        if ($count === 0) return 0;

        $bonus = 0;

        // Number of files
        if ($count >= 5) $bonus += 8;
        elseif ($count >= 3) $bonus += 5;
        elseif ($count >= 1) $bonus += 2;

        // High-value file types
        foreach ($report->attachments as $att) {
            $mime = strtolower($att->mime_type ?? '');
            if (str_contains($mime, 'pdf'))   { $bonus += 2; continue; }
            if (str_contains($mime, 'video')) { $bonus += 3; continue; }
            if (str_contains($mime, 'audio')) { $bonus += 3; continue; }
            if (str_contains($mime, 'image')) { $bonus += 1; continue; }
        }

        return min($bonus, 15);
    }

    /**
     * Recalculate priority & risk_score for an existing report.
     * Decrypts the stored description, combines with file contents,
     * re-runs the expert system, and persists the updated scores.
     * Returns true if the priority/risk changed.
     */
    public function recalculateReportPriority(Report $report): bool
    {
        $report->loadMissing('attachments');

        // Decrypt the description for analysis
        $decrypted = [];
        if ($report->is_encrypted && $report->encrypted_data) {
            try {
                $raw = \Illuminate\Support\Facades\Crypt::decryptString($report->encrypted_data);
                $decrypted = json_decode($raw, true) ?? [];
            } catch (\Exception $e) {
                Log::warning('Decryption failed during recalculation', ['case_id' => $report->case_id]);
            }
        }
        $description = $decrypted['description'] ?? $report->description ?? '';
        $institution = $decrypted['institution'] ?? $report->institution ?? '';
        $location    = $decrypted['location']    ?? $report->location ?? '';

        // Extract text from attached files
        $fileText = $this->extractTextFromAttachments($report);

        // Build combined data payload for the expert system
        $data = [
            'type'        => $report->type,
            'description' => $description . ' ' . $fileText,
            'institution' => $institution,
            'location'    => $location,
        ];

        $oldPriority  = $report->priority;
        $oldRisk      = $report->risk_score;
        $oldType      = $report->type;

        // Run expert scoring on combined text
        $newPriority = $this->determineExpertPriority($data);
        $resolvedType = $this->lastTypeInference['resolved_type'] ?? $report->type;

        // Add attachment bonus to the raw score
        $attachmentBonus = $this->scoreAttachmentBonus($report);
        $adjustedScore = $this->lastExpertRawScore + $attachmentBonus;

        // Re-derive priority from the adjusted score
        if ($adjustedScore >= 80) $newPriority = 'CRITICAL';
        elseif ($adjustedScore >= 51) $newPriority = 'HIGH';
        elseif ($adjustedScore >= 26) $newPriority = 'MEDIUM';
        else $newPriority = 'LOW';

        $newRisk = $this->calculateRiskScore(array_merge($data, ['priority' => $newPriority]));

        $changed = ($newPriority !== $oldPriority || $newRisk !== $oldRisk || $resolvedType !== $oldType);

        $report->type       = $resolvedType;
        $report->priority   = $newPriority;
        $report->risk_score = $newRisk;

        // Update text_clarity_score from the last clarity assessment
        if (!empty($this->lastClarityResult)) {
            $report->text_clarity_score = $this->lastClarityResult['score'] ?? 0;
        }

        $report->save();

        if ($changed) {
            Log::info('Report priority recalculated', [
                'case_id'      => $report->case_id,
                'old_priority' => $oldPriority,
                'new_priority' => $newPriority,
                'old_risk'     => $oldRisk,
                'new_risk'     => $newRisk,
                'old_type'     => $oldType,
                'new_type'     => $resolvedType,
                'raw_score'    => $this->lastExpertRawScore,
                'file_bonus'   => $attachmentBonus,
                'adjusted'     => $adjustedScore,
            ]);
        }

        return $changed;
    }

    /**
     * Assess text clarity and coherence score (0-100).
     * Detects gibberish, random characters, and incoherent text.
     * Returns an associative array with 'score', 'is_clear', and 'issues'.
     *
     * Uses structural heuristics (no AI needed):
     *  - Word structure: real words have vowels, reasonable length, etc.
     *  - Dictionary coverage: checks against common English, Shona, Ndebele, Tonga words
     *  - Character entropy: random typing has high unique-char ratios
     *  - Sentence structure: real text has spaces, punctuation, mixed case
     */
    protected function assessTextClarity(string $text, string $declaredLanguage = 'en'): array
    {
        $issues = [];
        $score = 100; // Start at 100, deduct for issues
        $text = trim($text);

        if (strlen($text) < 20) {
            return ['score' => 0, 'is_clear' => false, 'issues' => ['Text is too short to assess.']];
        }

        $lower = mb_strtolower($text);

        // Languages we have dictionary coverage for
        $dictLanguages = ['en', 'sn', 'nd', 'to'];
        $hasDictSupport = in_array($declaredLanguage, $dictLanguages);

        // Detect if text uses non-Latin script (CJK, Arabic, Cyrillic, Devanagari, etc.)
        $hasNonLatinScript = (bool) preg_match('/[\x{0400}-\x{04FF}\x{0600}-\x{06FF}\x{0900}-\x{097F}\x{3000}-\x{9FFF}\x{AC00}-\x{D7AF}\x{0E00}-\x{0E7F}\x{1000}-\x{109F}\x{10A0}-\x{10FF}\x{1100}-\x{11FF}]/u', $text);

        // ── Check 1: Character entropy — random mashing has few spaces, lots of unique chars ──
        $charCount = mb_strlen($lower);
        $uniqueChars = count(array_unique(mb_str_split($lower)));
        $spaceRatio = substr_count($lower, ' ') / max($charCount, 1);
        $uniqueRatio = $uniqueChars / max($charCount, 1);

        // CJK/Thai/etc. scripts don't use spaces between words — skip space-based checks
        if (!$hasNonLatinScript) {
            // Real text has ~15-25% spaces. Gibberish has <5%
            if ($spaceRatio < 0.05 && $charCount > 30) {
                $score -= 40;
                $issues[] = 'Text appears to be a continuous string without proper word separation.';
            } elseif ($spaceRatio < 0.10 && $charCount > 50) {
                $score -= 15;
                $issues[] = 'Text has very few word breaks.';
            }

            // Very high unique-char ratio for short text = likely random
            if ($uniqueRatio > 0.85 && $charCount < 80) {
                $score -= 25;
                $issues[] = 'Character pattern suggests random input.';
            }
        }

        // ── Check 2: Repeated character patterns ──
        if (preg_match('/(.)\1{4,}/', $lower)) {
            $score -= 20;
            $issues[] = 'Text contains excessive character repetition.';
        }

        // ── Check 3: Word-level analysis ──
        $words = preg_split('/\s+/', $lower, -1, PREG_SPLIT_NO_EMPTY);
        $wordCount = count($words);

        // For non-Latin scripts (CJK, etc.), use character count as proxy for word count
        // Chinese averages ~1.5 chars per word, so 20 chars ≈ 13 words
        $effectiveWordCount = $hasNonLatinScript ? (int) ($charCount / 1.5) : $wordCount;

        if ($effectiveWordCount < 4) {
            $score -= 30;
            $issues[] = 'Text contains too few words to form a coherent report.';
        }

        // Check average word length — real words average 3-8 chars
        // Skip for non-Latin scripts where space-based word splitting is unreliable
        if ($wordCount > 0 && !$hasNonLatinScript) {
            $avgWordLen = array_sum(array_map('mb_strlen', $words)) / $wordCount;
            if ($avgWordLen > 12) {
                $score -= 20;
                $issues[] = 'Unusually long average word length suggests non-standard text.';
            }
            if ($avgWordLen < 2 && $wordCount > 5) {
                $score -= 15;
                $issues[] = 'Very short average word length.';
            }
        }

        // ── Check 4: Vowel presence — real Latin-script words contain vowels ──
        // Skip for non-Latin scripts where this check is irrelevant
        if (!$hasNonLatinScript) {
        $vowels = 'aeiou';
        $wordsWithoutVowels = 0;
        $longWordsWithoutVowels = 0;
        foreach ($words as $w) {
            $hasVowel = false;
            for ($i = 0; $i < mb_strlen($w); $i++) {
                if (str_contains($vowels, mb_substr($w, $i, 1))) { $hasVowel = true; break; }
            }
            if (!$hasVowel) {
                $wordsWithoutVowels++;
                if (mb_strlen($w) > 3) $longWordsWithoutVowels++;
            }
        }
        if ($wordCount > 0) {
            $noVowelRatio = $wordsWithoutVowels / $wordCount;
            if ($noVowelRatio > 0.5) {
                $score -= 25;
                $issues[] = 'Most words lack vowels, suggesting non-language content.';
            }
            if ($longWordsWithoutVowels > 2) {
                $score -= 10;
                $issues[] = 'Multiple long words without vowels detected.';
            }
        }
        } // end non-Latin vowel check

        // ── Check 5: Dictionary coverage — check against common words in all target languages ──
        $commonWords = $this->getCommonWordDictionary();
        $dictHits = 0;
        $checkWords = array_slice($words, 0, 50); // Check first 50 words
        foreach ($checkWords as $w) {
            $cleanWord = preg_replace('/[^a-z\']/', '', $w);
            if (mb_strlen($cleanWord) < 2) continue;
            // Direct match
            if (isset($commonWords[$cleanWord])) { $dictHits++; continue; }
            // Substring/stem match: check if any dictionary word (4+ chars) is contained in this word
            // This handles agglutinative African languages where prefixes/suffixes wrap stems
            $found = false;
            foreach ($commonWords as $dw => $_) {
                if (mb_strlen($dw) >= 4 && mb_strlen($cleanWord) >= 5 && str_contains($cleanWord, $dw)) {
                    $found = true; break;
                }
            }
            if ($found) { $dictHits++; continue; }
            // Also check if this word is a prefix of a dictionary word (partial typing)
            foreach ($commonWords as $dw => $_) {
                if (mb_strlen($dw) >= 5 && mb_strlen($cleanWord) >= 4 && str_starts_with($dw, $cleanWord)) {
                    $found = true; break;
                }
            }
            if ($found) $dictHits++;
        }
        $significantWords = count(array_filter($checkWords, fn($w) => mb_strlen($w) >= 2));
        $dictCoverage = $significantWords > 0 ? $dictHits / $significantWords : 0;

        if ($dictCoverage < 0.10 && $significantWords >= 3) {
            // For languages without dictionary, reduce penalty significantly
            $penalty = $hasDictSupport ? 40 : 10;
            $score -= $penalty;
            if ($hasDictSupport) {
                $issues[] = 'No recognizable words in any supported language (English, Shona, Ndebele, Tonga).';
            }
        } elseif ($dictCoverage < 0.15 && $significantWords > 5) {
            $penalty = $hasDictSupport ? 35 : 8;
            $score -= $penalty;
            if ($hasDictSupport) {
                $issues[] = 'Very few recognizable words in any supported language (English, Shona, Ndebele, Tonga).';
            }
        } elseif ($dictCoverage < 0.30 && $significantWords > 5 && $hasDictSupport) {
            $score -= 15;
            $issues[] = 'Low dictionary word coverage — text may be unclear.';
        }

        // If very few words AND none in dictionary, it's almost certainly gibberish
        // But only apply full penalty for dictionary-supported languages
        if ($wordCount < 5 && $dictCoverage < 0.1 && $significantWords >= 2) {
            $score -= $hasDictSupport ? 20 : 5;
            if ($hasDictSupport) {
                $issues[] = 'Very short text with no recognizable words.';
            }
        }

        // ── Check 6: Consecutive consonant clusters — gibberish has long consonant runs ──
        // Skip for non-Latin scripts where this check is meaningless
        // Use stricter threshold (5+) for non-dictionary languages since many languages have 4-consonant clusters
        $clusterLen = $hasDictSupport ? 4 : 5;
        if (!$hasNonLatinScript && preg_match_all('/[bcdfghjklmnpqrstvwxyz]{' . $clusterLen . ',}/i', $lower, $matches)) {
            $badClusters = count($matches[0]);
            if ($badClusters >= 3) {
                $score -= 25;
                $issues[] = 'Text contains unnatural consonant clusters.';
            } elseif ($badClusters >= 1) {
                $score -= 10;
                $issues[] = 'Text contains unnatural consonant clusters.';
            }
        }

        // ── Check 6b: Keyboard pattern detection ──
        // Skip for non-Latin scripts
        if (!$hasNonLatinScript) {
        $keyboardPatterns = ['qwert', 'asdfg', 'zxcvb', 'poiuy', 'lkjhg', 'mnbvc', 'yuiop', 'ghjkl', 'werty', 'sdfgh', 'xcvbn'];
        $kbHits = 0;
        foreach ($keyboardPatterns as $pat) {
            if (str_contains($lower, $pat)) $kbHits++;
        }
        if ($kbHits >= 2) {
            $score -= 35;
            $issues[] = 'Text contains keyboard mashing patterns.';
        } elseif ($kbHits >= 1) {
            $score -= 15;
            $issues[] = 'Text contains keyboard-like character sequences.';
        }
        } // end non-Latin keyboard check

        // ── Check 7: Punctuation and sentence structure ──
        $hasPunctuation = preg_match('/[.!?,;:]/', $text);
        $hasCapitalLetters = preg_match('/[A-Z]/', $text);
        if (!$hasPunctuation && $charCount > 100) {
            $score -= 5;
            $issues[] = 'No punctuation found in long text.';
        }
        if (!$hasCapitalLetters && $charCount > 100 && $declaredLanguage === 'en') {
            $score -= 5;
        }

        $score = max(0, min(100, $score));
        $isClear = $score >= 40;

        return [
            'score' => $score,
            'is_clear' => $isClear,
            'issues' => $issues,
            'word_count' => $wordCount,
            'dict_coverage' => round($dictCoverage * 100),
        ];
    }

    /**
     * Combined dictionary of common words across English, Shona, Ndebele, and Tonga.
     * Returns a hash-map for O(1) lookup.
     * @return array<string, true>
     */
    protected function getCommonWordDictionary(): array
    {
        static $dict = null;
        if ($dict !== null) return $dict;

        $words = [
            // ── English (200+ common words) ──
            'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
            'he','as','you','do','at','this','but','his','by','from','they','we','say','her',
            'she','or','an','will','my','one','all','would','there','their','what','so','up',
            'out','if','about','who','get','which','go','me','when','make','can','like','time',
            'no','just','him','know','take','people','into','year','your','good','some','could',
            'them','see','other','than','then','now','look','only','come','its','over','think',
            'also','back','after','use','two','how','our','work','first','well','way','even',
            'new','want','because','any','these','give','day','most','us','is','was','are',
            'been','has','had','did','got','may','said','each','tell','does','set','three',
            'own','hand','high','keep','last','long','made','many','much','number','very',
            'man','woman','old','great','before','same','right','too','mean','call','end',
            'find','here','thing','show','part','still','place','being','where','off','home',
            // Core corruption/report vocabulary
            'money','corruption','bribe','bribery','fraud','steal','stolen','embezzle','theft',
            'government','official','public','funds','tender','contract','procurement','abuse',
            'office','report','evidence','witness','investigation','police','court','law',
            'minister','director','manager','council','authority','department','institution',
            'payment','bank','account','invoice','receipt','document','proof','allegation',
            'suspect','victim','complaint','case','crime','illegal','amount','million','dollar',
            'usd','billion','paid','received','gave','took','diverted','misused','inflated',
            'overpriced','forged','falsified','audit','inspector','commission','committee',

            // ── Shona (150+ common words) ──
            'ndi','nda','zva','kuti','kana','asi','ari','vanhu','munhu','mari','basa',
            'mhuri','imba','mvura','chikafu','mukuru','murume','mukadzi','mwana','vana',
            'nguva','zuva','usiku','mangwanani','masikati','manheru','gore','mwedzi',
            'svondo','nyika','musha','guta','nzvimbo','nzira','motokari','chitima',
            'chipatara','chikoro','chechi','musika','dhoro','sadza','nyama','hove',
            'mukaka','doro','tea','kofi','chingwa','muriwo','michero','muti','mushonga',
            'hurumende','mutemo','dare','mapurisa','musungwa','mhosva','mutongo',
            'uchapupu','chapupu','bonde','rufu','urwere','hutano','kubata','kuba',
            'kutora','kutaura','kuenda','kuuya','kuona','kunzwa','kudya','kunwa',
            'kurara','kumuka','kushanda','kudzidza','kuimba','kutamba','kufamba',
            'kugara','kunyora','kuverenga','kukura','kukuvadza','kushandisa','kuchera',
            'huori','rushwa','kubiridzira','kupamba','kushungurudza','kunyengera',
            'kunyepera','kufurira','kunzvenga','kurongedzwa','zvakawanda',
            'ndakabira','ndakaona','zvekuita','nyaya','zvakaitika','hukama',
            'chiremba','gavhuna','meya','nhengo','mumiririri','gweta',
            'mutungamiriri','mutongi','mavhaucha','zvinyorwa',
            'kupfupisa','kukanganisa','kutadza','kukumbira','kubvuma',
            'kuramba','kudzoka','kupedza','kutanga','kuenderera',
            'akaba','akasaina','yaifanira','haina','kusvika','dzinoratidza',
            'yakaenda','vanogona','kutaura','zvavakaona','kukuvadza',
            'varombo','kufa','nekuda','kwehuori','makambani','asipo',
            'weku','kubva','chemadhora','makumi','mashanu','maviri','matatu',
            'mana','mashanu','matanhatu','manomwe','masere','mapfumbamwe','gumi',
            'chete','chiokomuhomwe','chikoro','chimwe','chinhambwe','dhora',
            'pamusoro','pasi','pano','ipapo','rinhi','sei','ani','chipi',
            'mukati','kunze','pedyo','kure','pamberi','shure','apa','apo',
            'kwete','hongu','zvino','nhasi','nezuro','mangwana','kakawanda',
            'wekuvaka','wekutengesa','wekutenga','wekushandisa','wekupa',
            'akabvuma','akatora','akashandisa','akaba','akanyepa','akabirwa',

            // ── Ndebele (120+ common words) ──
            'ngi','nga','uku','aba','ama','isi','umu','imi','aba','abantu','umuntu',
            'imali','umsebenzi','umndeni','indlu','amanzi','ukudla','inkosi','indoda',
            'umfazi','umntwana','abantwana','isikhathi','ilanga','ubusuku','ekuseni',
            'ntambama','kusihlwa','umnyaka','inyanga','iviki','ilizwe','ikhaya',
            'idolobho','indawo','indlela','imota','isitimela','isibhedlela','isikolo',
            'isonto','imakethe','isinkwa','inyama','inhlanzi','ubisi','utshwala',
            'itiye','ikhofi','imifino','izihlahla','umuthi','uhulumende','umthetho',
            'inkantolo','amapholisa','isibotshwa','icala','isigwebo','ubufakazi',
            'ukweba','umkhonyovu','intshontshela','ukuphanga','ukwesabisa',
            'ukusebenzisa','amandla','intengo','ephezulu','ukukhwabanisa',
            'ukudla','okubanzi','okuhlelelweyo','okukhulu',
            'ngabona','ukuthi','isikolo','indaba','umkhokheli',
            'umphathiswa','imeya','ilungu','lephalamende','umgcinimafa',
            'umbusi','amarekhodi','izincwadi','ofakazi',
            'isivumelwano','enkampanini','emphakathini','njengomthetho',
            'ukwedlula','isebenzisiwe','awakafikanga','njengobufakazi',

            // ── Tonga (50+ common words) ──
            'ndi','aba','amu','bantu','mali','mulimo','mukwasyi','ing\'anda',
            'maanzi','cakulya','mwami','mulumi','mukaintu','mwana','bana',
            'ciindi','buzuba','masiku','mabbili','mwaka','amwezi','mviki',
            'nyika','mudundu','munzi','nzila','motokala','cibbadela',
            'cikolo','cikombelo','musika','cinkwa','nyama','inswi','mukupa',
            'bukoko','bulelo','mulao','inkuta','bapolisa','mwaninyinza',
            'mulandu','bumboni','kwiiba','bumpelenge','rushwa',
            'buumi','bwabantu','musamu','lufu','nzala',
            'zyuulu','zyiingi','mweendelezi','simalelo','musololi',
        ];

        $dict = [];
        foreach ($words as $w) {
            $dict[$w] = true;
        }
        return $dict;
    }

    /**
     * Detect the language of a text snippet.
     * Returns language code: 'en', 'sn' (Shona), 'nd' (Ndebele), 'to' (Tonga).
     */
    protected function detectTextLanguage(string $text): string
    {
        $lower = mb_strtolower($text);
        $words = preg_split('/\s+/', $lower, -1, PREG_SPLIT_NO_EMPTY);

        $shonaMarkers = [
            'kuti','kana','asi','vanhu','munhu','musha','nyika','zvakaitika',
            'ndakabira','ndakaona','zvekuita','nyaya','hukama','kushandisa',
            'hurumende','mukuru','basa','chiremba','nguva','zvakawanda',
            'akaba','yaifanira','haina','dzinoratidza','vanogona',
            'chipatara','mishonga','varwere','mavhaucha','makambani',
            'husiku','zuva','mangwanani','masikati','manheru',
        ];
        $ndebeleMarkers = [
            'ukuthi','umuntu','abantu','ukweba','umkhonyovu','uhulumende',
            'ngabona','inkosi','isikolo','indaba','isibhedlela',
            'amapholisa','inkantolo','umthetho','ukukhwabanisa',
            'umkhokheli','emphakathini','njengomthetho','njengobufakazi',
            'isivumelwano','enkampanini','awakafikanga','abalamthombo',
        ];
        $tongaMarkers = [
            'bantu','mulimo','mukwasyi','maanzi','cakulya','mwami',
            'cibbadela','cikolo','bulelo','mulao','bapolisa',
            'kwiiba','bumpelenge','zyuulu','zyiingi','buumi',
        ];

        $shonaHits = 0;
        $ndebeleHits = 0;
        $tongaHits = 0;

        foreach ($words as $w) {
            foreach ($shonaMarkers as $m) {
                if ($w === $m || str_contains($w, $m)) { $shonaHits++; break; }
            }
            foreach ($ndebeleMarkers as $m) {
                if ($w === $m || str_contains($w, $m)) { $ndebeleHits++; break; }
            }
            foreach ($tongaMarkers as $m) {
                if ($w === $m || str_contains($w, $m)) { $tongaHits++; break; }
            }
        }

        $max = max($shonaHits, $ndebeleHits, $tongaHits);
        if ($max >= 2) {
            if ($shonaHits === $max) return 'sn';
            if ($ndebeleHits === $max) return 'nd';
            if ($tongaHits === $max) return 'to';
        }

        return 'en';
    }

    /**
     * Translate text using Gemini AI.
     * @param string $text The text to translate
     * @param string $fromLang Source language code
     * @param string $toLang Target language code
     * @return array{success: bool, translated_text: string, error?: string}
     */
    public function translateWithGemini(string $text, string $fromLang, string $toLang): array
    {
        // Comprehensive ISO 639-1 language name mapping
        $langNames = [
            'aa' => 'Afar', 'ab' => 'Abkhaz', 'af' => 'Afrikaans', 'ak' => 'Akan',
            'am' => 'Amharic', 'an' => 'Aragonese', 'ar' => 'Arabic', 'as' => 'Assamese',
            'av' => 'Avaric', 'ay' => 'Aymara', 'az' => 'Azerbaijani', 'ba' => 'Bashkir',
            'be' => 'Belarusian', 'bg' => 'Bulgarian', 'bh' => 'Bihari', 'bi' => 'Bislama',
            'bm' => 'Bambara', 'bn' => 'Bengali', 'bo' => 'Tibetan', 'br' => 'Breton',
            'bs' => 'Bosnian', 'ca' => 'Catalan', 'ce' => 'Chechen', 'ch' => 'Chamorro',
            'co' => 'Corsican', 'cr' => 'Cree', 'cs' => 'Czech', 'cu' => 'Church Slavonic',
            'cv' => 'Chuvash', 'cy' => 'Welsh', 'da' => 'Danish', 'de' => 'German',
            'dv' => 'Divehi', 'dz' => 'Dzongkha', 'ee' => 'Ewe', 'el' => 'Greek',
            'en' => 'English', 'eo' => 'Esperanto', 'es' => 'Spanish', 'et' => 'Estonian',
            'eu' => 'Basque', 'fa' => 'Persian', 'ff' => 'Fula', 'fi' => 'Finnish',
            'fj' => 'Fijian', 'fo' => 'Faroese', 'fr' => 'French', 'fy' => 'Western Frisian',
            'ga' => 'Irish', 'gd' => 'Scottish Gaelic', 'gl' => 'Galician', 'gn' => 'Guarani',
            'gu' => 'Gujarati', 'gv' => 'Manx', 'ha' => 'Hausa', 'he' => 'Hebrew',
            'hi' => 'Hindi', 'ho' => 'Hiri Motu', 'hr' => 'Croatian', 'ht' => 'Haitian Creole',
            'hu' => 'Hungarian', 'hy' => 'Armenian', 'hz' => 'Herero', 'ia' => 'Interlingua',
            'id' => 'Indonesian', 'ie' => 'Interlingue', 'ig' => 'Igbo', 'ii' => 'Nuosu',
            'ik' => 'Inupiaq', 'io' => 'Ido', 'is' => 'Icelandic', 'it' => 'Italian',
            'iu' => 'Inuktitut', 'ja' => 'Japanese', 'jv' => 'Javanese', 'ka' => 'Georgian',
            'kg' => 'Kongo', 'ki' => 'Kikuyu', 'kj' => 'Kuanyama', 'kk' => 'Kazakh',
            'kl' => 'Kalaallisut', 'km' => 'Khmer', 'kn' => 'Kannada', 'ko' => 'Korean',
            'kr' => 'Kanuri', 'ks' => 'Kashmiri', 'ku' => 'Kurdish', 'kv' => 'Komi',
            'kw' => 'Cornish', 'ky' => 'Kyrgyz', 'la' => 'Latin', 'lb' => 'Luxembourgish',
            'lg' => 'Ganda', 'li' => 'Limburgish', 'ln' => 'Lingala', 'lo' => 'Lao',
            'lt' => 'Lithuanian', 'lu' => 'Luba-Katanga', 'lv' => 'Latvian', 'mg' => 'Malagasy',
            'mh' => 'Marshallese', 'mi' => 'Maori', 'mk' => 'Macedonian', 'ml' => 'Malayalam',
            'mn' => 'Mongolian', 'mr' => 'Marathi', 'ms' => 'Malay', 'mt' => 'Maltese',
            'my' => 'Burmese', 'na' => 'Nauru', 'nb' => 'Norwegian Bokmål', 'nd' => 'Ndebele',
            'ne' => 'Nepali', 'ng' => 'Ndonga', 'nl' => 'Dutch', 'nn' => 'Norwegian Nynorsk',
            'no' => 'Norwegian', 'nr' => 'Southern Ndebele', 'nv' => 'Navajo', 'ny' => 'Chewa/Nyanja',
            'oc' => 'Occitan', 'oj' => 'Ojibwe', 'om' => 'Oromo', 'or' => 'Odia',
            'os' => 'Ossetian', 'pa' => 'Punjabi', 'pi' => 'Pali', 'pl' => 'Polish',
            'ps' => 'Pashto', 'pt' => 'Portuguese', 'qu' => 'Quechua', 'rm' => 'Romansh',
            'rn' => 'Kirundi', 'ro' => 'Romanian', 'ru' => 'Russian', 'rw' => 'Kinyarwanda',
            'sa' => 'Sanskrit', 'sc' => 'Sardinian', 'sd' => 'Sindhi', 'se' => 'Northern Sami',
            'sg' => 'Sango', 'si' => 'Sinhala', 'sk' => 'Slovak', 'sl' => 'Slovenian',
            'sm' => 'Samoan', 'sn' => 'Shona', 'so' => 'Somali', 'sq' => 'Albanian',
            'sr' => 'Serbian', 'ss' => 'Swati', 'st' => 'Sotho', 'su' => 'Sundanese',
            'sv' => 'Swedish', 'sw' => 'Swahili', 'ta' => 'Tamil', 'te' => 'Telugu',
            'tg' => 'Tajik', 'th' => 'Thai', 'ti' => 'Tigrinya', 'tk' => 'Turkmen',
            'tl' => 'Tagalog', 'tn' => 'Tswana', 'to' => 'Tonga', 'tr' => 'Turkish',
            'ts' => 'Tsonga', 'tt' => 'Tatar', 'tw' => 'Twi', 'ty' => 'Tahitian',
            'ug' => 'Uyghur', 'uk' => 'Ukrainian', 'ur' => 'Urdu', 'uz' => 'Uzbek',
            've' => 'Venda', 'vi' => 'Vietnamese', 'vo' => 'Volapük', 'wa' => 'Walloon',
            'wo' => 'Wolof', 'xh' => 'Xhosa', 'yi' => 'Yiddish', 'yo' => 'Yoruba',
            'za' => 'Zhuang', 'zh' => 'Chinese', 'zu' => 'Zulu',
        ];

        $fromName = $langNames[$fromLang] ?? $fromLang;
        $toName = $langNames[$toLang] ?? $toLang;

        $apiKey = (string) config('services.gemini.api_key');
        $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

        if (!$apiKey) {
            return ['success' => false, 'translated_text' => '', 'error' => 'Gemini API key not configured'];
        }

        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
            urlencode($model),
            urlencode($apiKey)
        );

        $prompt = <<<PROMPT
You are a professional translator with expertise in world languages, including African languages (Shona, Ndebele, Tonga, Swahili, Zulu, Xhosa, etc.) and all major international languages.

Translate the following text from {$fromName} to {$toName}. 

RULES:
- Translate accurately, preserving meaning and tone
- Keep proper nouns, names, monetary amounts (USD, ZWL), dates, and numbers unchanged
- Keep institution names in their original form
- If the text contains corruption-related terminology, use the appropriate legal/official terms in the target language
- Do NOT add any commentary, explanation, or notes — return ONLY the translated text
- If the text is already in {$toName}, return it unchanged

TEXT TO TRANSLATE:
{$text}
PROMPT;

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(20)
                ->retry(2, 500)
                ->acceptJson()
                ->post($url, [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'temperature' => 0.1,
                    ],
                ]);

            if (!$response->successful()) {
                return ['success' => false, 'translated_text' => '', 'error' => 'Translation API returned ' . $response->status()];
            }

            $translated = $response->json('candidates.0.content.parts.0.text');
            if (!is_string($translated) || trim($translated) === '') {
                return ['success' => false, 'translated_text' => '', 'error' => 'Empty translation response'];
            }

            return ['success' => true, 'translated_text' => trim($translated)];
        } catch (\Exception $e) {
            Log::warning('Translation failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'translated_text' => '', 'error' => $e->getMessage()];
        }
    }

    /**
     * Expert system: determines case priority via calibrated multi-factor analysis.
     *
     * The scoring is tuned so that:
     *   CRITICAL (≥80): Senior national officials + large financial amounts + strong evidence
     *   HIGH     (51-79): Significant corruption + moderate evidence/officials
     *   MEDIUM   (26-50): Moderate cases + limited evidence
     *   LOW      (<26):  Minor cases with minimal detail or impact
     *
     * Key design: financial magnitudes are parsed from the text (not just keyword
     * presence), so $5 bribes aren't scored the same as $4 million embezzlement.
     * Government institution keywords are down-weighted because nearly every case
     * involves a public body.
     */
    protected function determineExpertPriority(array $data): string
    {
        $typeInference = $this->inferCorruptionType($data);
        $this->lastTypeInference = $typeInference;

        $type = strtolower($typeInference['resolved_type'] ?? ($data['type'] ?? ''));
        $description = $data['description'] ?? '';
        $institution = $data['institution'] ?? '';
        $location = $data['location'] ?? '';
        $text = strtolower($description . ' ' . $institution . ' ' . $location);

        $score = 0;
        $factorHits = 0;

        // ── Factor 1: Corruption Type Severity (0-15) ──
        $typeScores = [
            'embezzlement'      => 15,
            'procurement fraud' => 12,
            'bribery'           => 12,
            'abuse of office'   => 10,
            'abuse'             => 10,
            'nepotism'          => 5,
            'other'             => 2,
        ];
        foreach ($typeScores as $t => $pts) {
            if (str_contains($type, $t)) {
                $score += $pts;
                $factorHits++;
                break;
            }
        }

        // ── Factor 2: Senior Officials — Tiered (0-35) ──
        // Tier 1 = national-level (first match 25, additional +5)
        // Tier 2 = regional/institutional (first match 12, additional +5)
        $tier1Officials = [
            'president', 'vice president', 'prime minister', 'minister',
            'permanent secretary', 'director general', 'commissioner',
            'attorney general', 'chief justice', 'auditor general',
            'inspector general', 'speaker of parliament',
            // Shona T1
            'mutungamiriri', 'mukuru wehurumende', 'gweta rehurumende',
            'mutongi mukuru',
            // Ndebele T1
            'umongameli', 'undunankulu', 'ungqongqoshe',
        ];
        $tier2Officials = [
            'governor', 'provincial governor', 'town clerk', 'mayor',
            'director', 'general manager', 'managing director',
            'chief executive', 'board chairman', 'provincial administrator',
            'deputy minister', 'ambassador', 'member of parliament',
            'senator', 'deputy director', 'commandant', 'consul',
            'city council chairman', 'secretary', 'councillor',
            // Shona T2
            'gavhuna', 'meya', 'nhengo yeparamende', 'mumiririri',
            'mukuru wemutemo', 'mukuru',
            // Ndebele T2
            'umphathiswa', 'imeya', 'ilungu lephalamende',
            'umgcinimafa', 'umbusi', 'umkhokheli',
            // Tonga T2
            'mweendelezi', 'simalelo', 'musololi',
        ];

        $highestTier = 0; // 0 = none, 1 = tier2, 2 = tier1
        $officialHits = 0;
        foreach ($tier1Officials as $kw) {
            if (str_contains($text, $kw)) {
                $highestTier = max($highestTier, 2);
                $officialHits++;
            }
        }
        foreach ($tier2Officials as $kw) {
            if (str_contains($text, $kw)) {
                if ($highestTier < 2) $highestTier = 1;
                $officialHits++;
            }
        }
        if ($officialHits > 0) {
            $baseOfficial = ($highestTier === 2) ? 25 : 12;
            $additionalOfficial = max(0, $officialHits - 1) * 5;
            $score += min($baseOfficial + $additionalOfficial, 35);
            $factorHits++;
        }

        // ── Factor 3: Financial Magnitude — Amount-Aware (0-35) ──
        // Parse actual monetary amounts from text rather than flat keyword points.
        $maxAmount = 0.0;

        // Pattern: $4.2 million, USD $1.8 million, US$12 million, Z$500 billion
        if (preg_match_all('/(?:\$|usd|us\$|z\$|zig|zwl)\s*[\$]?\s*([\d,]+(?:\.\d+)?)\s*(trillion|billion|million)?/i', $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $num = (float) str_replace(',', '', $m[1]);
                $suffix = strtolower($m[2] ?? '');
                if ($suffix === 'trillion') $num *= 1_000_000_000_000;
                elseif ($suffix === 'billion') $num *= 1_000_000_000;
                elseif ($suffix === 'million') $num *= 1_000_000;
                $maxAmount = max($maxAmount, $num);
            }
        }
        // Bare numbers with million/billion: "1.8 million", "12 million"
        if (preg_match_all('/([\d,]+(?:\.\d+)?)\s*(trillion|billion|million)/i', $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $num = (float) str_replace(',', '', $m[1]);
                $suffix = strtolower($m[2]);
                if ($suffix === 'trillion') $num *= 1_000_000_000_000;
                elseif ($suffix === 'billion') $num *= 1_000_000_000;
                elseif ($suffix === 'million') $num *= 1_000_000;
                $maxAmount = max($maxAmount, $num);
            }
        }
        // Plain currency amounts: $320,000 or USD 50,000
        if (preg_match_all('/(?:\$|usd|us\$)\s*([\d,]+(?:\.\d+)?)/i', $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $num = (float) str_replace(',', '', $m[1]);
                $maxAmount = max($maxAmount, $num);
            }
        }
        // Shona/Ndebele scale words boost amount detection
        $localScaleWords = ['miriyoni' => 1_000_000, 'bhiriyoni' => 1_000_000_000, 'isigidi' => 1_000_000, 'izigidigidi' => 1_000_000_000];
        foreach ($localScaleWords as $word => $multiplier) {
            if (str_contains($text, $word) && $maxAmount > 0 && $maxAmount < $multiplier) {
                $maxAmount = max($maxAmount, $multiplier);
            }
        }

        if ($maxAmount >= 10_000_000) { $score += 35; $factorHits++; }
        elseif ($maxAmount >= 1_000_000) { $score += 28; $factorHits++; }
        elseif ($maxAmount >= 100_000)  { $score += 15; $factorHits++; }
        elseif ($maxAmount >= 10_000)   { $score += 10; $factorHits++; }
        elseif ($maxAmount >= 1_000)    { $score += 5;  $factorHits++; }
        elseif ($maxAmount >= 100)      { $score += 2;  $factorHits++; }

        // ── Factor 4: Scale / Systematic Indicators (cap 10) ──
        $scaleKeywords = [
            'systematic' => 5, 'systematically' => 5,
            'widespread' => 5, 'organised' => 4, 'organized' => 4,
            'syndicate' => 5, 'cartel' => 5, 'network' => 3,
            'large scale' => 4, 'mass' => 3, 'ring' => 3,
            'hundreds of thousands' => 4,
            // Shona
            'kwakawanda' => 5, 'kurongedzwa' => 5, 'zhinji' => 4,
            // Ndebele
            'okubanzi' => 5, 'okuhlelelweyo' => 5, 'okukhulu' => 4,
            // Tonga
            'zyuulu zyuulu' => 5, 'zyiingi' => 4,
        ];
        $scaleBonus = 0;
        foreach ($scaleKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) $scaleBonus += $pts;
        }
        if ($scaleBonus > 0) {
            $score += min($scaleBonus, 10);
            $factorHits++;
        }

        // ── Factor 5: Crime Severity Keywords (cap 15) ──
        $crimeKeywords = [
            // English
            'bribe' => 4, 'fraud' => 4, 'theft' => 4, 'steal' => 4,
            'coercion' => 5, 'embezzle' => 4, 'kickback' => 5,
            'extort' => 5, 'misuse' => 2, 'stolen' => 4,
            'siphon' => 4, 'inflate' => 4, 'phantom' => 5,
            'launder' => 6, 'money laundering' => 7,
            'forgery' => 4, 'forged' => 4, 'falsified' => 4,
            'illegal' => 3, 'illicit' => 4,
            'ghost workers' => 6, 'fictitious' => 5,
            'collusion' => 5, 'conspiracy' => 4,
            'intimidat' => 5, 'threaten' => 4,
            'loot' => 4, 'plunder' => 4, 'divert' => 4,
            'overpricing' => 4, 'under-invoicing' => 4,
            'conflict of interest' => 4, 'front company' => 5,
            'shell company' => 5, 'offshore' => 5,
            'bid-rigging' => 5, 'bid rigging' => 5,
            'irregular' => 3, 'bypass' => 3,
            // Shona
            'kuba' => 4, 'huori' => 4, 'akab' => 4,
            'makambani asipo' => 5, 'kushungurudza' => 4,
            'kupamba' => 4, 'kukuvadza' => 3,
            'kushandisa simba' => 4, 'kubiridzira' => 3,
            'kunyepera' => 3, 'kufurira' => 3,
            'kuba mari' => 4, 'kutora mari' => 4,
            'kunzvenga mutemo' => 3,
            // Ndebele
            'ukweba' => 4, 'umkhonyovu' => 4, 'intshontshela' => 4,
            'ukuphanga' => 4, 'ukwesabisa' => 5,
            'ukudla imali' => 4, 'ukukhwabanisa' => 4,
            'ukusebenzisa amandla' => 4,
            'intengo ephezulu' => 4,
            // Tonga
            'kwiiba' => 4, 'bumpelenge' => 4, 'rushwa' => 4,
        ];
        $crimeBonus = 0;
        foreach ($crimeKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) $crimeBonus += $pts;
        }
        if ($crimeBonus > 0) {
            $score += min($crimeBonus, 15);
            $factorHits++;
        }

        // ── Factor 6: Evidence Quality Indicators (cap 10) ──
        $evidenceKeywords = [
            'document' => 3, 'receipt' => 3, 'invoice' => 3,
            'witness' => 3, 'recording' => 5, 'photo' => 3,
            'video' => 4, 'screenshot' => 3, 'bank statement' => 5,
            'audit' => 4, 'email' => 3, 'letter' => 3,
            'contract' => 3, 'affidavit' => 5, 'voucher' => 3,
            'minutes' => 3, 'cctv' => 4, 'forensic' => 5,
            'mobile money' => 4, 'ecocash' => 4, 'logbook' => 3,
            'bank transfer' => 4, 'payment record' => 4,
            'transaction' => 3, 'weighbridge' => 3,
            'proof' => 3, 'payslip' => 3, 'contract copy' => 4,
            // Shona
            'mavhaucha' => 3, 'uchapupu' => 4, 'zvinyorwa' => 3,
            'vanogona kutaura' => 3, 'amarekhodi' => 3,
            // Ndebele
            'ubufakazi' => 3, 'izincwadi' => 3, 'ofakazi' => 3,
        ];
        $evidenceBonus = 0;
        foreach ($evidenceKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) $evidenceBonus += $pts;
        }
        if ($evidenceBonus > 0) {
            $score += min($evidenceBonus, 10);
            $factorHits++;
        }

        // ── Factor 7: Public / Victim Impact (cap 10) ──
        $impactKeywords = [
            // English
            'public health' => 6, 'water supply' => 5, 'water project' => 5,
            'food supply' => 5, 'medicine' => 5, 'medical supplies' => 6,
            'children' => 4, 'school fees' => 4, 'pension' => 5,
            'patients' => 5, 'orphan' => 5, 'disabled' => 4,
            'elderly' => 4, 'vulnerable' => 4, 'displaced' => 5,
            'deaths' => 6, 'died' => 5, 'injuries' => 5,
            'hunger' => 5, 'starvation' => 6,
            'public safety' => 6, 'endanger' => 5, 'motorist' => 4,
            'road safety' => 5, 'taxpayer' => 4, 'public funds' => 4,
            'drought' => 5, 'grain' => 4, 'borehole' => 4,
            'community' => 2, 'residents' => 3, 'road' => 3,
            'voter' => 5, 'election' => 5, 'voter registration' => 5,
            'passport' => 3,
            // Shona
            'hutano hweveruzhinji' => 6, 'mvura' => 5, 'chikafu' => 5,
            'mushonga' => 5, 'mishonga' => 5, 'vana' => 4,
            'varwere' => 5, 'nherera' => 5, 'vakwegura' => 4,
            'rufu' => 6, 'vakafa' => 5, 'kukuvara' => 5,
            'nzara' => 5, 'chipatara' => 4, 'kufa' => 6,
            'vanhu varombo' => 3,
            // Ndebele
            'impilakahle' => 6, 'amanzi' => 5, 'ukudla' => 5,
            'umuthi' => 5, 'abantwana' => 4, 'izigulane' => 5,
            'ukufa' => 6, 'indlala' => 5, 'umgwaqo' => 3,
            // Tonga
            'buumi bwabantu' => 6, 'maanzi' => 5, 'cakulya' => 5,
            'musamu' => 5, 'bana' => 4, 'lufu' => 6,
            'nzala' => 5, 'bantu' => 3,
        ];
        $impactBonus = 0;
        foreach ($impactKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) $impactBonus += $pts;
        }
        if ($impactBonus > 0) {
            $score += min($impactBonus, 10);
            $factorHits++;
        }

        // ── Factor 8: Government / Public Institution (cap 6) ──
        // Down-weighted because nearly every corruption case involves a public body.
        $govKeywords = [
            'government' => 4, 'public funds' => 3, 'contract' => 3,
            'tender' => 3, 'ministry' => 3, 'department' => 2,
            'council' => 3, 'authority' => 3, 'parastatal' => 4,
            'university' => 3, 'police' => 3, 'hospital' => 3,
            'school' => 2, 'parliament' => 3, 'judiciary' => 3,
            'electoral' => 3, 'prosecutor' => 3,
            // Zimbabwe-specific entities
            'gmb' => 3, 'zinara' => 3, 'nssa' => 3, 'zesa' => 3,
            'zec' => 3, 'zacc' => 3, 'rbz' => 4, 'zimra' => 3,
            'zinwa' => 3, 'zdf' => 3, 'ddf' => 3,
            // Shona
            'hurumende' => 4, 'chipatara' => 3, 'dare' => 3, 'mapurisa' => 3,
            // Ndebele
            'uhulumende' => 4, 'umkhandlu' => 3, 'amapholisa' => 3,
            // Tonga
            'bulelo' => 4, 'bapolisa' => 3,
        ];
        $govBonus = 0;
        foreach ($govKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) $govBonus += $pts;
        }
        if ($govBonus > 0) {
            $score += min($govBonus, 6);
            $factorHits++;
        }

        // ── Factor 9: Institutional Sensitivity Bonus (+12) ──
        // Anti-corruption bodies, judiciary, and electoral bodies merit heightened scrutiny.
        $sensitiveInstitutions = [
            // Anti-corruption
            'zacc', 'anti-corruption', 'ombudsman',
            // Judiciary
            'high court', 'supreme court', 'constitutional court',
            'magistrate court',
            // Electoral
            'zec', 'electoral commission',
        ];
        foreach ($sensitiveInstitutions as $kw) {
            if (str_contains($text, $kw)) {
                $score += 12;
                break;
            }
        }

        // ── Factor 10: Description Quality (max 6) ──
        $len = strlen($description);
        if ($len > 1000)     $score += 6;
        elseif ($len > 500)  $score += 4;
        elseif ($len > 250)  $score += 2;
        elseif ($len > 100)  $score += 1;

        // ── Factor 11: Urgency / Ongoing Nature (max 5, one hit) ──
        $urgencyKeywords = [
            'ongoing', 'happening now', 'currently', 'right now',
            'urgent', 'imminent', 'about to', 'deadline',
            'evidence may be destroyed', 'fleeing', 'leaving the country',
            'fear for', 'fear for my safety', 'intimidated',
            // Shona
            'zviri kuitika', 'nhasi', 'pari zvino', 'nekukurumidza',
            'kutiza', 'uchapupu hunogona kuparadzwa',
            // Ndebele
            'kuyenzeka', 'lamuhla', 'khathesi', 'ngokuphangisa',
            'ukubaleka', 'ubufakazi bungalahlwa',
            // Tonga
            'cicitika', 'sunu', 'cakufwambaana',
        ];
        foreach ($urgencyKeywords as $kw) {
            if (str_contains($text, $kw)) {
                $score += 5;
                $factorHits++;
                break;
            }
        }

        // ── Factor 12: Temporal Specificity (cap 5) ──
        $datePatterns = 0;
        if (preg_match('/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/', $text)) $datePatterns++;
        if (preg_match('/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i', $text)) $datePatterns++;
        if (preg_match('/\b20[12]\d\b/', $text)) $datePatterns++;
        if ($datePatterns > 0) {
            $score += min($datePatterns * 3, 5);
            $factorHits++;
        }

        // ── Factor 13: Cross-Factor Amplification (max 8) ──
        if ($factorHits >= 6) {
            $score += 8;
        } elseif ($factorHits >= 5) {
            $score += 6;
        } elseif ($factorHits >= 4) {
            $score += 4;
        } elseif ($factorHits >= 3) {
            $score += 2;
        }

        // ── Factor 14: Text Clarity Penalty ──
        // Gibberish/incoherent submissions are penalized heavily.
        // Auto-detect language so non-English reports aren't unfairly penalized
        $detectedLang = $this->detectTextLanguage($description);
        $clarity = $this->assessTextClarity($description, $detectedLang);
        $this->lastClarityResult = $clarity;
        if ($clarity['score'] < 20) {
            // Near-gibberish: cap score at LOW range regardless of keyword matches
            $score = min($score, 10);
        } elseif ($clarity['score'] < 40) {
            // Very unclear: halve the score
            $score = (int) ($score * 0.5);
        } elseif ($clarity['score'] < 60) {
            // Somewhat unclear: reduce by 30%
            $score = (int) ($score * 0.7);
        }

        $this->lastExpertRawScore = $score;

        Log::info('Expert system scoring', [
            'type' => $type,
            'selected_type' => $typeInference['selected_type'] ?? null,
            'inferred_type' => $typeInference['inferred_type'] ?? null,
            'type_corrected' => $typeInference['was_corrected'] ?? false,
            'type_confidence' => $typeInference['confidence'] ?? null,
            'total_score' => $score,
            'factor_hits' => $factorHits,
            'desc_length' => $len,
            'max_amount_detected' => $maxAmount,
        ]);

        if ($score >= 80) return 'CRITICAL';
        if ($score >= 51) return 'HIGH';
        if ($score >= 26) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Calculate risk score (0-100) proportional to expert priority and content.
     */
    protected function calculateRiskScore(array $data): int
    {
        $priority = $data['priority'] ?? 'MEDIUM';

        $base = [
            'CRITICAL' => 80,
            'HIGH'     => 55,
            'MEDIUM'   => 30,
            'LOW'      => 10,
        ][$priority] ?? 30;

        $text = strtolower(
            ($data['description'] ?? '') . ' ' .
            ($data['institution'] ?? '') . ' ' .
            ($data['location'] ?? '')
        );

        $bonus = 0;

        // Evidence quality bonus (up to +8)
        foreach (['bank statement', 'affidavit', 'recording', 'video', 'forensic', 'audit', 'cctv', 'mobile money'] as $kw) {
            if (str_contains($text, $kw)) $bonus += 2;
        }
        $bonus = min($bonus, 8);

        // Senior official bonus (up to +5)
        foreach (['minister', 'president', 'director general', 'commissioner', 'permanent secretary', 'director', 'town clerk'] as $kw) {
            if (str_contains($text, $kw)) {
                $bonus += 5;
                break;
            }
        }

        // Financial magnitude bonus (up to +5)
        if (preg_match('/(?:million|billion)/i', $text)) $bonus += 5;

        return max(0, min(100, $base + $bonus));
    }

    /**
     * Generate a reference code for a report.
     *
     * @return string
     */
    protected function generateReferenceCode(): string
    {
        do {
            $code = 'ZACC-' . strtoupper(Str::random(8));
        } while (Report::where('reference_code', $code)->exists());

        return $code;
    }

    /**
     * Log an action for a report.
     *
     * @param Report $report
     * @param string $action
     * @param string $details
     * @param array $metadata
     * @return void
     */
    protected function logReportAction(Report $report, string $action, string $details, array $metadata = []): void
    {
        try {
            $report->activityLogs()->create([
                'report_id' => $report->id,
                'user_id' => Auth::id(),
                'action' => $action,
                'details' => $details,
                'ip_address' => request()->ip(),
                'metadata' => $metadata,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log report action: ' . $e->getMessage(), [
                'report_id' => $report->id,
                'action' => $action,
                'exception' => $e,
            ]);
        }
    }

    /**
     * Validate report status transition.
     *
     * @param string $currentStatus
     * @param string $newStatus
     * @param User $user
     * @return bool
     */
    protected function isValidStatusTransition(string $currentStatus, string $newStatus, User $user): bool
    {
        $validTransitions = [
            'SUBMITTED' => ['UNDER_REVIEW', 'INVESTIGATING', 'CLOSED'],
            'UNDER_REVIEW' => ['INVESTIGATING', 'CLOSED'],
            'INVESTIGATING' => ['REFERRED', 'CLOSED', 'DISPUTED'],
            'REFERRED' => ['CLOSED', 'DISPUTED'],
            'DISPUTED' => ['UNDER_REVIEW', 'INVESTIGATING', 'CLOSED'],
        ];

        // Admins can do anything
        if ($user->isAdmin()) {
            return true;
        }

        // Investigators have limited permissions
        if ($user->isInvestigator()) {
            // Investigators can't close or refer cases
            if (in_array($newStatus, ['CLOSED', 'REFERRED'])) {
                return false;
            }
        }

        // Regular users can only submit disputes
        if ($user->isWhistleblower() && $newStatus !== 'DISPUTED') {
            return false;
        }

        // Check if the transition is valid
        return in_array($newStatus, $validTransitions[$currentStatus] ?? []);
    }
}
