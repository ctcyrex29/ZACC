<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Models\Report;
use App\Models\User;

class AIController extends Controller
{
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
            $model = (string) config('services.gemini.model', 'gemini-1.5-flash');

            if (!$apiKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'AI service is not configured',
                ], 500);
            }

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            [
                                'text' => sprintf(
                                    'Analyze the following corruption report and categorize it. Provide a risk score (0-100), priority level, and estimated impact. Return ONLY valid JSON.
                                    
                                    Report: "%s"
                                    
                                    Return JSON in this format:
                                    {
                                        "category": "string",
                                        "riskScore": number,
                                        "priority": "LOW|MEDIUM|HIGH|CRITICAL",
                                        "impact": "string"
                                    }',
                                    $request->description
                                )
                            ]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                ]
            ];

            $response = $this->makeGeminiRequest($url, $payload);

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
     * Make a request to Gemini API
     */
    private function makeGeminiRequest(string $url, array $payload): array
    {
        try {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_TIMEOUT => 30,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                Log::warning('Gemini API error: HTTP ' . $httpCode);
                return [
                    'success' => false,
                    'message' => 'AI service error',
                ];
            }

            $decoded = json_decode($response, true);

            if (!$decoded || !isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                return [
                    'success' => false,
                    'message' => 'Invalid response format',
                ];
            }

            $text = $decoded['candidates'][0]['content']['parts'][0]['text'];
            $data = json_decode($text, true);

            if (!$data) {
                // Try to extract JSON from the response
                if (preg_match('/\{.*\}/s', $text, $matches)) {
                    $data = json_decode($matches[0], true);
                }
            }

            return [
                'success' => true,
                'data' => $data ?? [],
            ];
        } catch (\Exception $e) {
            Log::error('Gemini request error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Request failed',
            ];
        }
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

        if (!in_array($report->status, ['CLOSED', 'DISPUTED'])) {
            return response()->json(['success' => false, 'message' => 'Case must be closed before expert review'], 422);
        }

        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-1.5-flash');

            if (!$apiKey) {
                return response()->json(['success' => false, 'message' => 'AI service is not configured'], 500);
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

            $attachmentsList = $report->attachments->map(function ($a) {
                return $a->original_name . ' (' . $a->mime_type . ')';
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

            $response = $this->makeGeminiRequest($url, $payload);

            if (!$response['success']) {
                return response()->json(['success' => false, 'message' => 'AI review failed'], 500);
            }

            return response()->json([
                'success' => true,
                'data' => $response['data'],
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
            $model = (string) config('services.gemini.model', 'gemini-1.5-flash');

            if (!$apiKey) {
                return response()->json(['success' => false, 'message' => 'AI service is not configured'], 500);
            }

            $decrypted = $report->decrypted_data;
            $evidenceList = $report->attachments->map(function ($a) {
                $info = [
                    'name' => $a->original_name,
                    'type' => $a->mime_type,
                    'size_bytes' => $a->size,
                ];
                // For text-based files, try to read content
                if (in_array($a->mime_type, ['text/plain', 'text/csv', 'application/json']) && $a->size < 50000) {
                    try {
                        $content = \Illuminate\Support\Facades\Storage::disk($a->disk ?? 'private')->get($a->file_name);
                        if ($content) {
                            $info['content_preview'] = mb_substr($content, 0, 2000);
                        }
                    } catch (\Exception $e) {
                        // Skip unreadable files
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

            $response = $this->makeGeminiRequest($url, $payload);

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
            $model = (string) config('services.gemini.model', 'gemini-1.5-flash');

            if (!$apiKey) {
                return response()->json(['success' => false, 'message' => 'AI service is not configured'], 500);
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

            $response = $this->makeGeminiRequest($url, $payload);

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
}
