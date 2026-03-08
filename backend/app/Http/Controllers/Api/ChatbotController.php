<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    /**
     * Process a chatbot message using Gemini AI to guide whistleblowers.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'history' => ['nullable', 'array', 'max:20'],
            'history.*.role' => ['required_with:history', 'string', 'in:user,bot'],
            'history.*.text' => ['required_with:history', 'string'],
        ]);

        $userMessage = $request->input('message');
        $history = $request->input('history', []);

        try {
            $apiKey = env('GEMINI_API_KEY');

            if (!$apiKey) {
                return response()->json([
                    'success' => true,
                    'data' => ['response' => $this->getFallbackResponse($userMessage)],
                ]);
            }

            $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey;

            $systemPrompt = <<<'PROMPT'
You are the ZACC Guide — the official AI assistant of the Zimbabwe Anti-Corruption Commission (ZACC). You are an expert in Zimbabwean anti-corruption law, whistleblower protection, and the ZACC reporting process. Your role is to provide profound, knowledgeable guidance to whistleblowers navigating the anti-corruption reporting system safely and confidentially.

YOUR EXPERTISE AND MANDATE:
- You have deep knowledge of the Prevention of Corruption Act [Chapter 9:16], the ZACC Act, and Zimbabwe's National Anti-Corruption Strategy
- You understand the full investigation lifecycle and can explain each stage in detail
- You can advise on the legal protections available to whistleblowers under Zimbabwean law
- You understand the socio-political context of corruption in Zimbabwe and can provide context-aware guidance
- You can assist in multiple languages including English, Shona, Ndebele, and Tonga

OBJECTIVES you must fulfill:
1. Guide whistleblowers step-by-step through filing corruption reports with expert advice on what details strengthen a case
2. Explain the investigation process in depth (Submitted → Under Review → Investigating → Referred → Closed) including what happens at each stage, typical timelines, and what the whistleblower should expect
3. Help users understand tracking codes and how to follow up on cases
4. Provide detailed reassurance about privacy and anonymity protections backed by technical and legal explanations
5. Explain how to submit evidence effectively — what types of evidence are most impactful, how to document corruption properly
6. Guide users through the dispute process if they disagree with a case outcome
7. Educate users about ZACC's mandate, Zimbabwe's anti-corruption framework, and types of corruption
8. Help users write better, more detailed reports by asking probing questions about what they witnessed
9. Detect the language the user is writing in (English, Shona, Ndebele, Tonga, or any other) and respond fluently in that language

KEY SYSTEM DETAILS:
- Reports are fully anonymous — no name, email, or phone required
- All data is end-to-end encrypted using RSA-2048 and blockchain-anchored for tamper-proof integrity
- Users receive a tracking code (e.g. ZACC-REF-XXXXXX) to follow case progress
- An intelligent expert system auto-assigns priority (LOW/MEDIUM/HIGH/CRITICAL) based on corruption type, entities involved, financial amounts, and detail quality
- Users can upload evidence: photos (JPG, PNG), videos (MP4, MOV), audio (MP3, WAV), documents (PDF, DOC, XLS, TXT) — max 10 files, 10MB each
- Users can dispute closed cases with a written statement, which triggers a review by ZACC management
- Panic Exit button instantly redirects to a safe page for user protection
- Available corruption types: Bribery, Procurement Fraud, Abuse of Office, Embezzlement, Nepotism, Other

TIPS FOR STRONGER REPORTS (share with users when relevant):
- Include specific dates, times, and locations
- Name positions/titles (not personal names of the whistleblower)
- Mention financial amounts if known (even estimates help)
- Describe what was witnessed vs what was told by others
- Include names of government departments, ministries, or parastatals involved
- Mention if there are other witnesses (no need to name them)
- More detailed reports receive higher investigation priority from the expert system

CONVERSATION RULES:
- Be deeply knowledgeable, empathetic, and professional
- Provide substantive, helpful answers — not just surface-level responses
- Never ask for personal identifying information
- Keep responses thorough but focused (2-5 paragraphs, use bullet points for clarity)
- If unsure, direct users to the relevant tab (File Report, Track Case)
- Use plain language accessible to all literacy levels
- When a user writes in Shona, Ndebele, Tonga, or any language, respond fluently in that same language
- Proactively help users strengthen their reports by suggesting what additional details would help
- When explaining legal concepts, use simple analogies and examples
PROMPT;

            // Build conversation history for context
            $contents = [];

            // Add system instruction as first user message
            $contents[] = [
                'role' => 'user',
                'parts' => [['text' => $systemPrompt . "\n\nPlease acknowledge you understand your role."]],
            ];
            $contents[] = [
                'role' => 'model',
                'parts' => [['text' => 'I understand. I am the ZACC Guide, ready to help whistleblowers navigate the reporting process safely and confidentially.']],
            ];

            // Add conversation history
            foreach ($history as $msg) {
                $role = $msg['role'] === 'user' ? 'user' : 'model';
                $contents[] = [
                    'role' => $role,
                    'parts' => [['text' => $msg['text']]],
                ];
            }

            // Add current user message
            $contents[] = [
                'role' => 'user',
                'parts' => [['text' => $userMessage]],
            ];

            $payload = [
                'contents' => $contents,
                'generationConfig' => [
                    'maxOutputTokens' => 800,
                    'temperature' => 0.7,
                ],
            ];

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_TIMEOUT => 15,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200 || !$response) {
                Log::warning('Chatbot Gemini API error: HTTP ' . $httpCode);
                return response()->json([
                    'success' => true,
                    'data' => ['response' => $this->getFallbackResponse($userMessage)],
                ]);
            }

            $decoded = json_decode($response, true);
            $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;

            if (!$text) {
                return response()->json([
                    'success' => true,
                    'data' => ['response' => $this->getFallbackResponse($userMessage)],
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => ['response' => $text],
            ]);
        } catch (\Exception $e) {
            Log::error('Chatbot error: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'data' => ['response' => $this->getFallbackResponse($userMessage)],
            ]);
        }
    }

    /**
     * Keyword-based fallback when Gemini is unavailable.
     */
    private function getFallbackResponse(string $input): string
    {
        $lower = strtolower($input);

        $responses = [
            [
                'patterns' => ['file', 'report', 'submit', 'how to report', 'start', 'new report'],
                'response' => "To file an anonymous report:\n\n1. Click the **File Report** tab at the top\n2. Select the type of corruption\n3. Enter the affected institution and location\n4. Write a detailed description (more detail helps investigators)\n5. Click **Submit Anonymous Report**\n\nNo account, email, or password required. After submitting, you will receive a unique **tracking code** — save it in a safe place!"
            ],

            [
                'patterns' => ['track', 'check status', 'case status', 'my case', 'follow up', 'update'],
                'response' => "To track your case:\n\n1. Click the **Track Case** tab\n2. Enter your tracking code (e.g. ZACC-REF-XXXXXX)\n3. Click **Track Case**\n\nYou will see your current case status, progress timeline, investigator notes at each stage, and the option to upload additional evidence or dispute a closure."
            ],

            [
                'patterns' => ['safe', 'anonymous', 'identity', 'private', 'privacy', 'secret', 'confidential'],
                'response' => "Your identity is **fully protected** by ZACC's system:\n\n- Zero personal data collected — no name, email, or phone\n- End-to-end encryption — all case details are encrypted at rest\n- Blockchain anchoring — tamper-proof audit trail\n- Anonymous reports — not linked to any account\n- Panic Exit button — instantly hides what you're doing\n\nNo one at ZACC can identify you through the system."
            ],

            [
                'patterns' => ['evidence', 'attach', 'upload', 'file', 'photos', 'documents', 'proof'],
                'response' => "You can add evidence to your case at any time while it is open:\n\n1. Go to the **Track Case** tab and enter your code\n2. Scroll to the **Add Evidence** section\n3. Click to upload files\n\nAccepted files: photos (JPG, PNG), videos (MP4, MOV), audio (MP3, WAV), documents (PDF, DOC, XLS, TXT). Max 10 files, 10MB each."
            ],

            [
                'patterns' => ['dispute', 'disagree', 'appeal', 'challenge', 'unfair'],
                'response' => "If you disagree with a case closure:\n\n1. Go to **Track Case** and enter your code\n2. Scroll to the **Case Closed** section\n3. Click **Dispute This Decision**\n4. Provide a written statement explaining why\n5. Submit the dispute\n\nYour case will be marked as **Disputed** and reviewed by ZACC management."
            ],

            [
                'patterns' => ['help', 'hi', 'hello', 'hey', 'guide'],
                'response' => "Hello! I'm the **ZACC Guide**, here to help you navigate the reporting system.\n\nI can help you with:\n- Filing an anonymous report\n- Understanding tracking codes\n- Adding evidence to your case\n- Disputing a decision\n- Understanding the investigation process\n\nWhat would you like to know?"
            ],
        ];

        foreach ($responses as $item) {
            foreach ($item['patterns'] as $pattern) {
                if (str_contains($lower, $pattern)) {
                    return $item['response'];
                }
            }
        }

        return "I can help you with:\n\n- How to file a report\n- Tracking codes explained\n- Adding evidence\n- Disputing decisions\n- The investigation process\n- Privacy & anonymity\n\nPlease try rephrasing your question or click a quick topic button!";
    }
}
