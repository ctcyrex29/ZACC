<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

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
            $apiKey = env('GEMINI_API_KEY');

            if (!$apiKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'AI service is not configured',
                ], 500);
            }

            $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey;

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
}
