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

                if ((in_array($attachment->mime_type, $readableTypes) || in_array($ext, $readableExts))
                    && $attachment->size < 100000) {
                    try {
                        $content = \Illuminate\Support\Facades\Storage::disk($attachment->disk ?? 'private')
                            ->get($attachment->file_name);
                        if ($content) {
                            $fileContents[] = [
                                'name' => $attachment->original_name,
                                'content' => mb_substr($content, 0, 5000),
                            ];
                        }
                    } catch (\Exception $e) {
                        // Skip unreadable files
                    }
                } else {
                    // Include metadata for non-readable files (images, PDFs, etc.)
                    $fileContents[] = [
                        'name' => $attachment->original_name,
                        'type' => $attachment->mime_type,
                        'size_bytes' => $attachment->size,
                        'note' => 'Binary file — content not readable, but its existence is evidence.',
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

            // Store AI classification
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
                $path = $file->store("reports/{$report->id}/attachments", 'private');

                $report->attachments()->create([
                    'original_name' => $file->getClientOriginalName(),
                    'file_name' => $path,
                    'mime_type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                    'disk' => 'private',
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
            $ext = strtolower(pathinfo($attachment->original_name, PATHINFO_EXTENSION));
            $readable = in_array($attachment->mime_type, $readableTypes) || in_array($ext, $readableExts);

            if ($readable && $attachment->size < 200000) {
                try {
                    $content = \Illuminate\Support\Facades\Storage::disk($attachment->disk ?? 'private')
                        ->get($attachment->file_name);
                    if ($content) {
                        $fileText .= ' ' . mb_substr($content, 0, 10000);
                    }
                } catch (\Exception $e) {
                    // Skip unreadable files
                }
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

        // Run expert scoring on combined text
        $newPriority = $this->determineExpertPriority($data);

        // Add attachment bonus to the raw score
        $attachmentBonus = $this->scoreAttachmentBonus($report);
        $adjustedScore = $this->lastExpertRawScore + $attachmentBonus;

        // Re-derive priority from the adjusted score
        if ($adjustedScore >= 80) $newPriority = 'CRITICAL';
        elseif ($adjustedScore >= 51) $newPriority = 'HIGH';
        elseif ($adjustedScore >= 26) $newPriority = 'MEDIUM';
        else $newPriority = 'LOW';

        $newRisk = $this->calculateRiskScore(array_merge($data, ['priority' => $newPriority]));

        $changed = ($newPriority !== $oldPriority || $newRisk !== $oldRisk);

        $report->priority   = $newPriority;
        $report->risk_score = $newRisk;
        $report->save();

        if ($changed) {
            Log::info('Report priority recalculated', [
                'case_id'      => $report->case_id,
                'old_priority' => $oldPriority,
                'new_priority' => $newPriority,
                'old_risk'     => $oldRisk,
                'new_risk'     => $newRisk,
                'raw_score'    => $this->lastExpertRawScore,
                'file_bonus'   => $attachmentBonus,
                'adjusted'     => $adjustedScore,
            ]);
        }

        return $changed;
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
        $type = strtolower($data['type'] ?? '');
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

        $this->lastExpertRawScore = $score;

        Log::info('Expert system scoring', [
            'type' => $type,
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
