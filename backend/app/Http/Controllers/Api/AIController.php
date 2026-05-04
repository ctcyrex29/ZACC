<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ExpertEvaluationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Models\Report;
use App\Models\User;

class AIController extends Controller
{
    public function __construct(
        protected ExpertEvaluationService $expertEvaluationService,
    ) {}

    /**
     * Analyze a report using Gemini AI
     */
    public function analyzeReport(Request $request): JsonResponse
    {
        $request->validate([
            'description' => ['required', 'string', 'min:20'],
        ]);

        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if (!$apiKey) {
                Log::warning('Gemini API key is not configured — AI analysis unavailable');
                return response()->json([
                    'success' => false,
                    'message' => 'AI service is not configured. Please set GEMINI_API_KEY in your .env file.',
                ], 503);
            }

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $description = $request->description;

            $prompt = <<<PROMPT
You are a senior anti-corruption intelligence analyst for the Zimbabwe Anti-Corruption Commission (ZACC). You have deep expertise in Zimbabwean corruption patterns, the Prevention of Corruption Act [Chapter 9:16], and institutional oversight frameworks.

Analyze the following whistleblower corruption report with expert-level precision.

Report:
"{$description}"

Perform the following analysis:

1. **Category**: Classify into ONE primary category: BRIBERY, PROCUREMENT_FRAUD, ABUSE_OF_OFFICE, EMBEZZLEMENT, NEPOTISM, MONEY_LAUNDERING, FRAUD, EXTORTION, or OTHER. Choose the closest match based on the described behavior.

2. **Risk Score** (0-100): Assess based on:
   - Financial magnitude (higher amounts = higher risk)
   - Seniority of officials involved (higher positions = higher risk)
   - Public impact (affects public services, health, safety = higher risk)
   - Evidence strength indicated in the report
   - Systemic nature (one-off vs ongoing pattern)
   Score guide: 0-25 LOW, 26-50 MODERATE, 51-75 HIGH, 76-100 CRITICAL

3. **Priority**: Assign LOW, MEDIUM, HIGH, or CRITICAL based on:
   - CRITICAL: Senior officials, large sums (>USD 100k), public safety risk, ongoing harm
   - HIGH: Mid-level officials, significant sums (USD 10k-100k), clear evidence described
   - MEDIUM: Lower officials, moderate sums, some detail provided
   - LOW: Vague reports, minor amounts, limited detail

4. **Impact**: Write a 2-3 sentence expert assessment of the potential impact on public trust, institutional integrity, and affected communities. Be specific to what was reported.

Return ONLY valid JSON:
{
    "category": "string",
    "riskScore": number,
    "priority": "LOW|MEDIUM|HIGH|CRITICAL",
    "impact": "string"
}
PROMPT;

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.3,
                ]
            ];

            $response = $this->makeGeminiRequest($payload, $model);

            if (!$response['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $response['message'] ?? 'Failed to analyze report',
                ], 500);
            }

            $analysisData = $response['data'];

            return response()->json([
                'success' => true,
                'data' => [
                    'category' => $analysisData['category'] ?? 'UNCATEGORIZED',
                    'riskScore' => min(100, max(0, $analysisData['riskScore'] ?? 50)),
                    'priority' => $analysisData['priority'] ?? 'MEDIUM',
                    'impact' => $analysisData['impact'] ?? 'Unknown impact',
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('AI analysis failed: ' . $e->getMessage());

            // Return a safe default response
            return response()->json([
                'success' => true,
                'data' => [
                    'category' => 'UNCATEGORIZED',
                    'riskScore' => 50,
                    'priority' => 'MEDIUM',
                    'impact' => 'Assessment pending',
                ],
            ]);
        }
    }

    /**
     * Make a request to Gemini API with model fallback.
     */
    private function makeGeminiRequest(array $payload, ?string $preferredModel = null): array
    {
        $models = $this->geminiModelCandidates($preferredModel);
        $lastError = 'AI request failed';

        foreach ($models as $model) {
            try {
                $apiKey = (string) config('services.gemini.api_key');
                $url = sprintf(
                    'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                    urlencode($model),
                    urlencode($apiKey)
                );

            $jsonPayload = json_encode($payload);
            if ($jsonPayload === false) {
                Log::error('Gemini: Failed to encode request payload');
                return ['success' => false, 'message' => 'Internal encoding error'];
            }

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $jsonPayload,
                CURLOPT_TIMEOUT => (int) config('services.gemini.timeout', 30),
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_FOLLOWLOCATION => false,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($response === false) {
                Log::error('Gemini: cURL request failed', ['error' => $curlError]);
                $lastError = 'Network error connecting to AI service';
                continue;
            }

            if ($httpCode !== 200) {
                Log::warning('Gemini API error', [
                    'http_code' => $httpCode,
                    'response' => mb_substr((string) $response, 0, 500),
                ]);

                // Parse error message from Gemini for better diagnostics
                $errorData = json_decode($response, true);
                $errorMsg = $errorData['error']['message'] ?? 'AI service returned HTTP ' . $httpCode;
                $lastError = $errorMsg;
                continue;
            }

            $decoded = json_decode($response, true);

            if (!$decoded) {
                Log::error('Gemini: Could not decode JSON response');
                $lastError = 'Invalid JSON response from AI';
                continue;
            }

            // Check for blocked content
            $finishReason = $decoded['candidates'][0]['finishReason'] ?? null;
            if ($finishReason === 'SAFETY') {
                Log::warning('Gemini: Response blocked by safety filters');
                $lastError = 'Content was filtered by AI safety system';
                continue;
            }

            if (!isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                Log::warning('Gemini: Unexpected response structure', [
                    'keys' => array_keys($decoded),
                    'candidates_count' => count($decoded['candidates'] ?? []),
                ]);
                $lastError = 'Unexpected AI response format';
                continue;
            }

            $text = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
            $data = json_decode($text, true);

            if (!$data) {
                // Try to extract JSON from markdown code blocks or mixed text
                if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $text, $codeMatch)) {
                    $data = json_decode(trim($codeMatch[1]), true);
                }
                // Fallback: extract first JSON object
                if (!$data && preg_match('/\{[\s\S]*\}/s', $text, $matches)) {
                    $data = json_decode($matches[0], true);
                }
            }

            if (!$data) {
                Log::warning('Gemini: Could not parse JSON from response text', [
                    'text_preview' => mb_substr($text, 0, 300),
                ]);
                $lastError = 'Could not parse AI response';
                continue;
            }

                return ['success' => true, 'data' => $data, 'model' => $model];
            } catch (\Exception $e) {
                $lastError = 'AI request failed: ' . $e->getMessage();
                Log::error('Gemini request error: ' . $e->getMessage(), [
                    'model' => $model,
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        return ['success' => false, 'message' => $lastError];
    }

    /**
     * Ordered model list for resilient Gemini calls.
     */
    private function geminiModelCandidates(?string $preferredModel = null): array
    {
        $primary = $preferredModel ?: (string) config('services.gemini.model', 'gemini-2.0-flash');
        $fallback = config('services.gemini.fallback_models', []);
        $strategy = strtolower((string) config('services.gemini.routing_strategy', 'balanced'));
        $strategyOrders = config('services.gemini.strategy_orders', []);
        if (!is_array($fallback)) {
            $fallback = [];
        }

        $strategyCandidates = [];
        if (is_array($strategyOrders) && isset($strategyOrders[$strategy]) && is_array($strategyOrders[$strategy])) {
            $strategyCandidates = array_values(array_filter(array_map('strval', $strategyOrders[$strategy])));
        }

        $defaultCandidates = array_values(array_filter(array_map('strval', array_merge([$primary], $fallback))));
        $all = !empty($strategyCandidates) ? $strategyCandidates : $defaultCandidates;
        if ($preferredModel && !in_array($preferredModel, $all, true)) {
            array_unshift($all, $preferredModel);
        }
        return array_values(array_unique($all));
    }

    /**
     * Expert system post-case review: evaluates a closed case's handling.
     * Only available after a case is CLOSED.
     */
    public function expertCaseReview(Request $request, string $id): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user || !in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $report = Report::with(['stageEvaluations.investigator', 'attachments'])
            ->where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        if (!in_array($report->status, ['CLOSED', 'DISPUTED', 'SUCCESSFUL'])) {
            return response()->json(['success' => false, 'message' => 'Case must be closed or resolved before expert review'], 422);
        }

        try {
            // Expert-system baseline (always available).
            $expertReport = $this->expertEvaluationService->generatePreReviewReport($report);
            $investigationScore = (int) ($expertReport['overall_score'] ?? 50);

            $defaultVerdict = 'NEEDS_IMPROVEMENT';
            if ($investigationScore >= 75) {
                $defaultVerdict = 'HANDLED_CORRECTLY';
            } elseif ($investigationScore < 45) {
                $defaultVerdict = 'MISHANDLED';
            }

            $dimensionStrengths = [];
            foreach (($expertReport['dimensions'] ?? []) as $dimKey => $dim) {
                if (($dim['score'] ?? 0) >= 60) {
                    $dimensionStrengths[] = ($dim['label'] ?? ucfirst((string) $dimKey)) . ' dimension scored strongly.';
                }
            }

            $baseReview = [
                'verdict' => $defaultVerdict,
                'confidence' => 72,
                'summary' => $expertReport['summary'] ?? 'Expert-system review completed.',
                'strengths' => !empty($dimensionStrengths) ? $dimensionStrengths : ['Case handling has at least one strong assessment dimension.'],
                'weaknesses' => !empty($expertReport['flags']) ? array_values($expertReport['flags']) : ['No major weaknesses flagged by the expert system.'],
                'recommendations' => !empty($expertReport['recommendations']) ? array_values($expertReport['recommendations']) : ['Continue with documented case-handling best practices.'],
                'investigation_score' => $investigationScore,
                'expert_analysis' => $expertReport,
                'ai_enhancement' => null,
            ];

            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if (!$apiKey) {
                return response()->json([
                    'success' => true,
                    'data' => $baseReview,
                ]);
            }

            // Build comprehensive case summary for review
            $decrypted = $report->decrypted_data;
            $stages = $report->stageEvaluations->map(function ($s) {
                return [
                    'stage' => $s->stage,
                    'notes' => $s->investigator_notes,
                    'score' => $s->final_score,
                    'investigator' => $s->investigator?->name ?? 'Unknown',
                    'date' => $s->created_at?->toDateTimeString(),
                ];
            })->toArray();

            $readableTypes = [
                'text/plain', 'text/csv', 'application/json', 'text/html',
                'application/xml', 'text/xml', 'text/markdown',
            ];
            $readableExts = ['txt', 'csv', 'json', 'html', 'xml', 'md', 'log'];

            $attachmentsList = $report->attachments->map(function ($a) use ($readableTypes, $readableExts) {
                $mime = strtolower($a->mime_type ?? '');
                $ext  = strtolower(pathinfo($a->original_name, PATHINFO_EXTENSION));
                $entry = [
                    'name' => $a->original_name,
                    'type' => $a->mime_type,
                    'size_bytes' => $a->size,
                ];

                // Read text-based evidence for post-closure review
                $isReadable = in_array($mime, $readableTypes) || in_array($ext, $readableExts);
                if ($isReadable && $a->size < 512000) {
                    try {
                        $content = \Illuminate\Support\Facades\Storage::disk($a->disk ?? 'private')->get($a->file_name);
                        if ($content) {
                            $entry['content_preview'] = mb_substr($content, 0, 8000);
                        }
                    } catch (\Exception $e) {
                        // Skip unreadable
                    }
                } else {
                    // Describe binary evidence types
                    if (str_contains($mime, 'image')) {
                        $entry['evidence_type'] = 'Photographic/image evidence';
                    } elseif (str_contains($mime, 'video')) {
                        $entry['evidence_type'] = 'Video evidence/recording';
                    } elseif (str_contains($mime, 'audio')) {
                        $entry['evidence_type'] = 'Audio evidence/recording';
                    } elseif (str_contains($mime, 'pdf')) {
                        $entry['evidence_type'] = 'PDF document';
                    } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel')) {
                        $entry['evidence_type'] = 'Spreadsheet/financial data';
                    } elseif (str_contains($mime, 'msword') || str_contains($mime, 'wordprocessingml')) {
                        $entry['evidence_type'] = 'Word document';
                    }
                }
                return $entry;
            })->toArray();

            $caseSummary = json_encode([
                'case_id' => $report->case_id,
                'type' => $report->type,
                'priority' => $report->priority,
                'risk_score' => $report->risk_score,
                'status' => $report->status,
                'description' => $decrypted['description'] ?? $report->description ?? '',
                'institution' => $decrypted['institution'] ?? $report->institution ?? '',
                'location' => $decrypted['location'] ?? $report->location ?? '',
                'dispute_reason' => $report->dispute_reason,
                'stages' => $stages,
                'evidence_files' => $attachmentsList,
                'ai_summary' => $report->ai_summary,
                'created_at' => $report->created_at?->toDateTimeString(),
                'last_updated' => $report->last_updated?->toDateTimeString(),
            ], JSON_PRETTY_PRINT);

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $prompt = "You are a senior anti-corruption case review expert for the Zimbabwe Anti-Corruption Commission (ZACC). Review the following closed corruption case and evaluate whether it was handled correctly.\n\nAnalyze:\n1. Was the investigation thorough based on the stage notes?\n2. Was the priority/risk assessment appropriate for the case type?\n3. Were there any gaps in the investigation process?\n4. Was sufficient evidence gathered?\n5. Was the final outcome (closed/disputed) justified?\n\nCase Data:\n{$caseSummary}\n\nReturn ONLY valid JSON in this format:\n{\n  \"verdict\": \"HANDLED_CORRECTLY\" or \"NEEDS_IMPROVEMENT\" or \"MISHANDLED\",\n  \"confidence\": number (0-100),\n  \"summary\": \"string (2-3 sentence overall assessment)\",\n  \"strengths\": [\"string array of things done well\"],\n  \"weaknesses\": [\"string array of areas that need improvement\"],\n  \"recommendations\": [\"string array of specific recommendations\"],\n  \"investigation_score\": number (0-100)\n}";

            $payload = [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['responseMimeType' => 'application/json'],
            ];

            $response = $this->makeGeminiRequest($payload, $model);

            if (!$response['success']) {
                return response()->json([
                    'success' => true,
                    'data' => $baseReview,
                ]);
            }

            $aiReview = is_array($response['data'] ?? null) ? $response['data'] : [];
            $merged = [
                'verdict' => $aiReview['verdict'] ?? $baseReview['verdict'],
                'confidence' => max(0, min(100, (int) ($aiReview['confidence'] ?? $baseReview['confidence']))),
                'summary' => $aiReview['summary'] ?? $baseReview['summary'],
                'strengths' => is_array($aiReview['strengths'] ?? null) ? $aiReview['strengths'] : $baseReview['strengths'],
                'weaknesses' => is_array($aiReview['weaknesses'] ?? null) ? $aiReview['weaknesses'] : $baseReview['weaknesses'],
                'recommendations' => is_array($aiReview['recommendations'] ?? null) ? $aiReview['recommendations'] : $baseReview['recommendations'],
                'investigation_score' => max(0, min(100, (int) ($aiReview['investigation_score'] ?? $baseReview['investigation_score']))),
                'expert_analysis' => $expertReport,
                'ai_enhancement' => $aiReview,
            ];

            return response()->json([
                'success' => true,
                'data' => $merged,
            ]);
        } catch (\Exception $e) {
            Log::error('Expert case review failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Expert review failed'], 500);
        }
    }

    /**
     * Scan evidence files and provide AI analysis.
     */
    public function scanEvidence(Request $request, string $id): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user || !in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $report = Report::with(['attachments'])
            ->where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if (!$apiKey) {
                return response()->json(['success' => false, 'message' => 'AI service is not configured. Please ask the administrator to set GEMINI_API_KEY.'], 503);
            }

            $decrypted = $report->decrypted_data;
            $readableTypes = [
                'text/plain', 'text/csv', 'application/json', 'text/html',
                'application/xml', 'text/xml', 'text/markdown',
            ];
            $readableExts = ['txt', 'csv', 'json', 'html', 'xml', 'md', 'log'];

            $evidenceList = $report->attachments->map(function ($a) use ($readableTypes, $readableExts) {
                $mime = strtolower($a->mime_type ?? '');
                $ext  = strtolower(pathinfo($a->original_name, PATHINFO_EXTENSION));
                $info = [
                    'name' => $a->original_name,
                    'type' => $a->mime_type,
                    'size_bytes' => $a->size,
                ];

                // Read content from text-based files (up to 500KB, preview 10K chars)
                $isReadable = in_array($mime, $readableTypes) || in_array($ext, $readableExts);
                if ($isReadable && $a->size < 512000) {
                    try {
                        $content = \Illuminate\Support\Facades\Storage::disk($a->disk ?? 'private')->get($a->file_name);
                        if ($content) {
                            $info['content_preview'] = mb_substr($content, 0, 10000);
                        }
                    } catch (\Exception $e) {
                        // Skip unreadable files
                    }
                } else {
                    // Describe binary evidence types for AI context
                    if (str_contains($mime, 'image')) {
                        $info['evidence_type'] = 'Photographic/image evidence (screenshot, photo, or scanned document)';
                    } elseif (str_contains($mime, 'video')) {
                        $info['evidence_type'] = 'Video evidence (recording, CCTV footage, or visual documentation)';
                    } elseif (str_contains($mime, 'audio')) {
                        $info['evidence_type'] = 'Audio evidence (voice recording, conversation, or witness statement)';
                    } elseif (str_contains($mime, 'pdf')) {
                        $info['evidence_type'] = 'PDF document (likely formal/official document, contract, or report)';
                    } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel')) {
                        $info['evidence_type'] = 'Spreadsheet (financial data, records, or transaction logs)';
                    } elseif (str_contains($mime, 'msword') || str_contains($mime, 'wordprocessingml')) {
                        $info['evidence_type'] = 'Word document (formal written evidence, report, or correspondence)';
                    }
                }
                return $info;
            })->toArray();

            $caseContext = json_encode([
                'case_type' => $report->type,
                'description' => $decrypted['description'] ?? $report->description ?? '',
                'institution' => $decrypted['institution'] ?? $report->institution ?? '',
                'evidence_files' => $evidenceList,
            ], JSON_PRETTY_PRINT);

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $prompt = "You are an anti-corruption evidence analysis expert for ZACC (Zimbabwe Anti-Corruption Commission). Analyze the evidence files submitted with this case and provide suggestions.\n\nCase Context:\n{$caseContext}\n\nBased on the evidence file names, types, sizes, and any available content, assess:\n1. Is the evidence sufficient for this type of case?\n2. What additional evidence should be gathered?\n3. Are there any red flags or patterns in the evidence?\n4. Rate the overall evidence quality.\n\nReturn ONLY valid JSON:\n{\n  \"evidence_quality\": \"STRONG\" or \"MODERATE\" or \"WEAK\" or \"INSUFFICIENT\",\n  \"quality_score\": number (0-100),\n  \"analysis\": \"string (2-3 sentence overall assessment)\",\n  \"file_assessments\": [{\"file\": \"filename\", \"relevance\": \"HIGH/MEDIUM/LOW\", \"note\": \"string\"}],\n  \"missing_evidence\": [\"string array of recommended additional evidence to gather\"],\n  \"suggestions\": [\"string array of investigative suggestions\"]\n}";

            $payload = [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['responseMimeType' => 'application/json'],
            ];

            $response = $this->makeGeminiRequest($payload, $model);

            if (!$response['success']) {
                return response()->json(['success' => false, 'message' => 'Evidence scan failed'], 500);
            }

            return response()->json([
                'success' => true,
                'data' => $response['data'],
            ]);
        } catch (\Exception $e) {
            Log::error('Evidence scan failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Evidence scan failed'], 500);
        }
    }

    /**
     * Pre-submission suggestions for whistleblowers.
     * Evaluates a draft report and provides guidance before submission.
     */
    public function preSubmissionSuggestions(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['required', 'string'],
            'description' => ['required', 'string', 'min:10'],
            'institution' => ['nullable', 'string'],
            'location' => ['nullable', 'string'],
        ]);

        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if (!$apiKey) {
                return response()->json(['success' => false, 'message' => 'AI service is not configured. Please ask the administrator to set GEMINI_API_KEY.'], 503);
            }

            $draftData = json_encode([
                'type' => $request->type,
                'description' => $request->description,
                'institution' => $request->institution ?? '',
                'location' => $request->location ?? '',
            ], JSON_PRETTY_PRINT);

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $prompt = "You are the ZACC (Zimbabwe Anti-Corruption Commission) report assistant. A whistleblower is about to submit a corruption report. Review their draft and provide helpful suggestions to strengthen their case BEFORE submission.\n\nDraft Report:\n{$draftData}\n\nProvide:\n1. An assessment of the case strength\n2. Suggestions to improve the report\n3. What evidence they should try to include\n4. Any missing details that would help investigators\n5. Encouragement that their report matters\n\nBe supportive and helpful. Do NOT discourage reporting. Return ONLY valid JSON:\n{\n  \"case_strength\": \"STRONG\" or \"MODERATE\" or \"NEEDS_MORE_DETAIL\",\n  \"strength_score\": number (0-100),\n  \"summary\": \"string (1-2 sentence assessment, encouraging tone)\",\n  \"suggestions\": [\"string array of specific improvements they can make\"],\n  \"recommended_evidence\": [\"string array of evidence types that would strengthen the case\"],\n  \"missing_details\": [\"string array of important details to add\"],\n  \"ready_to_submit\": boolean\n}";

            $payload = [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['responseMimeType' => 'application/json'],
            ];

            $response = $this->makeGeminiRequest($payload, $model);

            if (!$response['success']) {
                return response()->json(['success' => false, 'message' => 'Suggestion service failed'], 500);
            }

            return response()->json([
                'success' => true,
                'data' => $response['data'],
            ]);
        } catch (\Exception $e) {
            Log::error('Pre-submission suggestions failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Suggestion service failed'], 500);
        }
    }

    /**
     * Pre-review analysis: comprehensive expert system findings report.
     * Available at ANY stage — generates a detailed analysis combining the expert
     * evaluation service (multi-dimensional scoring, evidence assessment, flags)
     * with optional AI enhancement for deeper case understanding.
     *
     * This is the primary case analysis function used before investigation begins.
     */
    public function preReviewAnalysis(Request $request, string $id): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user || !in_array($user->role, [User::ROLE_ADMIN, User::ROLE_INVESTIGATOR])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $report = Report::with(['attachments', 'stageEvaluations.investigator'])
            ->where('id', $id)
            ->orWhere('case_id', $id)
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        try {
            // Layer 1: Expert system analysis (always available, no AI needed)
            $expertReport = $this->expertEvaluationService->generatePreReviewReport($report);

            // Layer 2: AI enhancement (optional — runs if API key is configured)
            $aiEnhancement = null;
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');

            if ($apiKey) {
                $aiEnhancement = $this->runAIPreReviewEnhancement($report, $expertReport, $apiKey, $model);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'expert_analysis' => $expertReport,
                    'ai_enhancement'  => $aiEnhancement,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Pre-review analysis failed: ' . $e->getMessage());

            // Fall back to expert-only analysis
            try {
                $expertReport = $this->expertEvaluationService->generatePreReviewReport($report);
                return response()->json([
                    'success' => true,
                    'data' => [
                        'expert_analysis' => $expertReport,
                        'ai_enhancement'  => null,
                    ],
                ]);
            } catch (\Exception $inner) {
                return response()->json(['success' => false, 'message' => 'Analysis failed'], 500);
            }
        }
    }

    /**
     * Run Gemini AI enhancement on top of the expert system report.
     * Provides deeper contextual analysis, evidence review, and investigative guidance.
     */
    private function runAIPreReviewEnhancement(Report $report, array $expertReport, string $apiKey, string $model): ?array
    {
        try {
            $decrypted = $report->decrypted_data;

            // Gather file contents for evidence analysis
            $fileContents = [];
            foreach ($report->attachments as $attachment) {
                $readableTypes = [
                    'text/plain', 'text/csv', 'application/json', 'text/html',
                    'application/xml', 'text/xml', 'text/markdown',
                ];
                $readableExts = ['txt', 'csv', 'json', 'html', 'xml', 'md', 'log'];
                $ext = strtolower(pathinfo($attachment->original_name, PATHINFO_EXTENSION));

                if ((in_array($attachment->mime_type, $readableTypes) || in_array($ext, $readableExts))
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
                        // Skip
                    }
                } else {
                    $mime = strtolower($attachment->mime_type ?? '');
                    $evidenceType = 'Binary file';
                    if (str_contains($mime, 'image')) {
                        $evidenceType = 'Photographic/image evidence (screenshot, photo, or scanned document)';
                    } elseif (str_contains($mime, 'video')) {
                        $evidenceType = 'Video evidence (recording, CCTV footage, or visual documentation)';
                    } elseif (str_contains($mime, 'audio')) {
                        $evidenceType = 'Audio evidence (voice recording, conversation, or witness statement)';
                    } elseif (str_contains($mime, 'pdf')) {
                        $evidenceType = 'PDF document (likely formal/official document, contract, or report)';
                    } elseif (str_contains($mime, 'spreadsheet') || str_contains($mime, 'excel')) {
                        $evidenceType = 'Spreadsheet (financial data, records, or transaction logs)';
                    } elseif (str_contains($mime, 'msword') || str_contains($mime, 'wordprocessingml')) {
                        $evidenceType = 'Word document (formal written evidence, report, or correspondence)';
                    }
                    $fileContents[] = [
                        'name' => $attachment->original_name,
                        'type' => $attachment->mime_type,
                        'size_bytes' => $attachment->size,
                        'evidence_type' => $evidenceType,
                        'note' => 'Content not directly readable but its existence and type are evidential.',
                    ];
                }
            }

            $caseData = json_encode([
                'case_id'     => $report->case_id,
                'type'        => $report->type,
                'description' => $decrypted['description'] ?? $report->description ?? '',
                'institution' => $decrypted['institution'] ?? $report->institution ?? '',
                'location'    => $decrypted['location'] ?? $report->location ?? '',
                'priority'    => $report->priority,
                'status'      => $report->status,
                'attached_files' => $fileContents,
                'expert_system_score' => $expertReport['overall_score'],
                'expert_flags'        => $expertReport['flags'],
                'expert_dimensions'   => array_map(fn($d) => [
                    'score' => $d['score'],
                    'label' => $d['label'],
                ], $expertReport['dimensions']),
                'evidence_quality' => $expertReport['evidence_assessment']['quality'],
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            $prompt = <<<PROMPT
You are a senior anti-corruption intelligence analyst at ZACC (Zimbabwe Anti-Corruption Commission) conducting a PRE-REVIEW analysis. Your job is to provide investigators with a comprehensive briefing BEFORE they begin reviewing this case.

The expert system has already scored this case. Your role is to ADD DEEPER CONTEXT through:

1. **CASE NARRATIVE** — Write a clear, professional 3-5 sentence briefing of what this case is about, who is involved, and what is alleged. This will be the first thing investigators read.

2. **EVIDENCE REVIEW** — Analyze each attached file and the described evidence:
   - What does each piece of evidence likely prove or support?
   - Are there inconsistencies or gaps?
   - What is the overall evidence sufficiency for prosecution?
   - Rate evidence quality and explain why.

3. **CORRUPTION PATTERN ANALYSIS** — Based on the description and evidence:
   - What type of corruption scheme is this most consistent with?
   - Is this likely isolated or part of a broader pattern?
   - What is the likely modus operandi?

4. **KEY PERSONS OF INTEREST** — Extract any mentioned individuals, their roles, and their alleged involvement.

5. **RISK ASSESSMENT** — Provide:
   - Risk of evidence tampering/destruction
   - Risk of suspect flight
   - Risk of ongoing harm to public
   - Overall investigation risk level

6. **RECOMMENDED INVESTIGATION STRATEGY** — Provide specific, actionable steps investigators should follow, in priority order.

7. **LEGAL FRAMEWORK** — Identify applicable Zimbabwe laws and potential charges.

CASE DATA:
{$caseData}

Return ONLY valid JSON:
{
  "case_narrative": "string — 3-5 sentence professional briefing",
  "evidence_review": {
    "overall_quality": "STRONG|MODERATE|WEAK|INSUFFICIENT",
    "sufficiency_for_prosecution": "SUFFICIENT|PARTIAL|INSUFFICIENT",
    "file_analysis": [{"file": "filename", "likely_proves": "string", "relevance": "HIGH|MEDIUM|LOW"}],
    "evidence_gaps": ["string array of critical evidence gaps"],
    "evidence_summary": "string — 2-3 sentence assessment"
  },
  "corruption_pattern": {
    "primary_type": "string — corruption scheme type",
    "likely_isolated": true/false,
    "modus_operandi": "string — how the corruption is carried out",
    "pattern_analysis": "string — 1-2 sentence pattern assessment"
  },
  "persons_of_interest": [{"name_or_role": "string", "alleged_involvement": "string", "risk_level": "HIGH|MEDIUM|LOW"}],
  "risk_assessment": {
    "evidence_tampering_risk": "HIGH|MEDIUM|LOW",
    "suspect_flight_risk": "HIGH|MEDIUM|LOW",
    "ongoing_harm_risk": "HIGH|MEDIUM|LOW",
    "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW",
    "risk_explanation": "string"
  },
  "investigation_strategy": ["string array — specific steps in priority order"],
  "applicable_laws": ["string array — Zimbabwe laws and potential charges"],
  "confidence": 0-100
}
PROMPT;

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $payload = [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.2,
                ],
            ];

            $response = $this->makeGeminiRequest($payload, $model);

            if ($response['success']) {
                $response['data']['ai_generated_at'] = now()->toIso8601String();
                $response['data']['model_used'] = $response['model'] ?? $model;
                return $response['data'];
            }

            Log::warning('AI pre-review enhancement failed', ['message' => $response['message'] ?? 'unknown']);
            return null;
        } catch (\Exception $e) {
            Log::warning('AI pre-review enhancement error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Translate report text using Gemini AI.
     * Available to investigators and admins.
     */
    public function translateText(Request $request): JsonResponse
    {
        $request->validate([
            'text' => ['required', 'string', 'min:5'],
            'from_language' => ['required', 'string', 'max:10'],
            'to_language' => ['required', 'string', 'max:10'],
        ]);

        $text = $request->input('text');
        $from = $request->input('from_language');
        $to = $request->input('to_language');

        if ($from === $to) {
            return response()->json([
                'success' => true,
                'data' => [
                    'translated_text' => $text,
                    'from_language' => $from,
                    'to_language' => $to,
                    'note' => 'Source and target languages are the same.',
                ],
            ]);
        }

        // Use the trait helper for translation
        $helper = new class {
            use \App\Http\Controllers\Api\ReportControllerHelpers;
        };

        $result = $helper->translateWithGemini($text, $from, $to);

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'data' => [
                    'translated_text' => $result['translated_text'],
                    'from_language' => $from,
                    'to_language' => $to,
                ],
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Translation failed: ' . ($result['error'] ?? 'Unknown error'),
        ], 503);
    }

    /**
     * Validate text clarity / detect gibberish.
     * Public endpoint for real-time validation on the report form.
     */
    public function validateTextClarity(Request $request): JsonResponse
    {
        $request->validate([
            'text' => ['required', 'string', 'min:10'],
            'language' => ['sometimes', 'string', 'max:10'],
        ]);

        $helper = new class {
            use \App\Http\Controllers\Api\ReportControllerHelpers;
            public function check(string $text, string $lang): array {
                return $this->assessTextClarity($text, $lang);
            }
            public function detect(string $text): string {
                return $this->detectTextLanguage($text);
            }
        };

        $declaredLang = $request->input('language', 'en');
        $detectedLang = $helper->detect($request->input('text'));
        // Use detected language for clarity check so users aren't penalized
        // for writing in a different language than selected
        $effectiveLang = $detectedLang ?: $declaredLang;
        $clarity = $helper->check($request->input('text'), $effectiveLang);

        return response()->json([
            'success' => true,
            'data' => [
                'clarity_score' => $clarity['score'],
                'is_clear' => $clarity['is_clear'],
                'issues' => $clarity['issues'] ?? [],
                'word_count' => $clarity['word_count'] ?? 0,
                'dict_coverage' => $clarity['dict_coverage'] ?? 0,
                'detected_language' => $detectedLang,
            ],
        ]);
    }
}
