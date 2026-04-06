<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    private const MAX_HISTORY_MESSAGES = 20;
    private const MAX_MESSAGE_LENGTH = 1000;

    /**
     * Process a chatbot message using Gemini AI to guide whistleblowers.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => ['required', 'string', 'max:' . self::MAX_MESSAGE_LENGTH],
            'history' => ['nullable', 'array', 'max:' . self::MAX_HISTORY_MESSAGES],
            'history.*.role' => ['required_with:history', 'string', 'in:user,bot'],
            'history.*.text' => ['required_with:history', 'string', 'max:' . self::MAX_MESSAGE_LENGTH],
        ]);

        $userMessage = trim((string) $request->input('message'));
        $history = $this->sanitizeHistory($request->input('history', []));

        try {
            $apiKey = (string) config('services.gemini.api_key');
            $model = (string) config('services.gemini.model', 'gemini-2.0-flash');
            $timeout = (int) config('services.gemini.timeout', 15);

            if (!$apiKey) {
                return $this->fallbackJson($userMessage, 'gemini_not_configured');
            }

            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
                urlencode($model),
                urlencode($apiKey)
            );

            $payload = [
                'contents' => $this->buildConversation($userMessage, $history),
                'generationConfig' => [
                    'maxOutputTokens' => 1024,
                    'temperature' => 0.4,
                    'topP' => 0.9,
                    'topK' => 40,
                ],
            ];

            /** @var Response $response */
            $response = Http::timeout(max(5, $timeout))
                ->retry(2, 500)
                ->acceptJson()
                ->post($url, $payload);

            if (!$response->successful()) {
                Log::warning('Chatbot Gemini API error', [
                    'http_status' => $response->status(),
                ]);
                return $this->fallbackJson($userMessage, 'gemini_http_error');
            }

            $json = $response->json();
            $text = data_get($json, 'candidates.0.content.parts.0.text');

            if (!is_string($text) || trim($text) === '') {
                return $this->fallbackJson($userMessage, 'gemini_empty_response');
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'response' => trim($text),
                    'source' => 'gemini',
                    'suggestions' => $this->getSuggestedTopics($userMessage),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Chatbot error', [
                'message' => $e->getMessage(),
            ]);
            return $this->fallbackJson($userMessage, 'chatbot_exception');
        }
    }

    /**
     * Build a conversation compatible with Gemini content format.
     */
    private function buildConversation(string $userMessage, array $history): array
    {
        $contents = [
            [
                'role' => 'user',
                'parts' => [[
                    'text' => $this->getSystemPrompt() . "\n\nAcknowledge this role briefly and confirm you're ready to help.",
                ]],
            ],
            [
                'role' => 'model',
                'parts' => [[
                    'text' => "I'm the ZACC Guide, your expert anti-corruption assistant. I have deep knowledge of Zimbabwe's anti-corruption laws, the ZACC reporting process, whistleblower protections, and I can guide you through filing reports, tracking cases, submitting evidence, and disputing decisions. I'm ready to help — ask me anything or say 'file a report' to get started.",
                ]],
            ],
        ];

        foreach ($history as $message) {
            $contents[] = [
                'role' => $message['role'] === 'user' ? 'user' : 'model',
                'parts' => [[
                    'text' => $message['text'],
                ]],
            ];
        }

        $contents[] = [
            'role' => 'user',
            'parts' => [[
                'text' => $userMessage,
            ]],
        ];

        return $contents;
    }

    private function sanitizeHistory(array $history): array
    {
        $cleaned = [];

        foreach ($history as $msg) {
            if (!is_array($msg)) {
                continue;
            }

            $role = ($msg['role'] ?? '') === 'user' ? 'user' : 'bot';
            $text = trim((string) ($msg['text'] ?? ''));

            if ($text === '') {
                continue;
            }

            $cleaned[] = [
                'role' => $role,
                'text' => Str::limit($text, self::MAX_MESSAGE_LENGTH, ''),
            ];
        }

        if (count($cleaned) > self::MAX_HISTORY_MESSAGES) {
            $cleaned = array_slice($cleaned, -self::MAX_HISTORY_MESSAGES);
        }

        return $cleaned;
    }

    private function fallbackJson(string $input, string $reason): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'response' => $this->getFallbackResponse($input),
                'source' => 'fallback',
                'suggestions' => $this->getSuggestedTopics($input),
                'reason' => $reason,
            ],
        ]);
    }

    private function getSystemPrompt(): string
    {
        return <<<'PROMPT'
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
- All data is end-to-end encrypted using AES-256 and blockchain-anchored for tamper-proof integrity
- Users can file reports directly through the AI chatbot — the chatbot collects type, institution, location, description, and optional file attachments, then submits the report automatically
- Users receive a tracking code (e.g. ZACC-REF-XXXXXX) to follow case progress
- An intelligent expert system auto-assigns priority (LOW/MEDIUM/HIGH/CRITICAL) based on corruption type, entities involved, financial amounts, and detail quality
- Users can upload evidence: photos (JPG, PNG), videos (MP4, MOV), audio (MP3, WAV), documents (PDF, DOC, XLS, TXT) — max 10 files, 10MB each
- Users can dispute closed cases with a written statement, which triggers a review by ZACC management
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
- If unsure, direct users to file a report directly through the chatbot or visit the relevant tab (File Report, Track Case)
- Use plain language accessible to all literacy levels
- When a user writes in Shona, Ndebele, Tonga, or any language, respond fluently in that same language
- Proactively help users strengthen their reports by suggesting what additional details would help
- When explaining legal concepts, use simple analogies and examples
PROMPT;
    }

    private function getSuggestedTopics(string $input): array
    {
        $lower = strtolower($input);

        if (str_contains($lower, 'track') || str_contains($lower, 'status') || str_contains($lower, 'code')) {
            return ['How to add evidence', 'How to dispute a decision', 'What do the case stages mean?'];
        }

        if (str_contains($lower, 'file') || str_contains($lower, 'report') || str_contains($lower, 'submit')) {
            return ['What evidence strengthens my case?', 'How to track my case', 'Is my identity safe?'];
        }

        if (str_contains($lower, 'evidence') || str_contains($lower, 'proof') || str_contains($lower, 'upload')) {
            return ['What file types are accepted?', 'How to file a report', 'How to track my case'];
        }

        if (str_contains($lower, 'dispute') || str_contains($lower, 'disagree') || str_contains($lower, 'unfair')) {
            return ['What happens after disputing?', 'How to add more evidence', 'Is my identity safe?'];
        }

        if (str_contains($lower, 'safe') || str_contains($lower, 'anonymous') || str_contains($lower, 'privacy')) {
            return ['How to file a report', 'What is blockchain verification?', 'How does encryption protect me?'];
        }

        if (str_contains($lower, 'brib') || str_contains($lower, 'corrupt') || str_contains($lower, 'fraud') || str_contains($lower, 'embezzl')) {
            return ['File a report now', 'What evidence should I gather?', 'Is my identity safe?'];
        }

        return ['How to file a report', 'How to track my case', 'What are my privacy protections?'];
    }

    /**
     * Keyword-based fallback when Gemini is unavailable.
     */
    private function getFallbackResponse(string $input): string
    {
        $lower = strtolower($input);

        $responses = [
            [
                'patterns' => ['file', 'report', 'submit', 'how to report', 'start', 'new report', 'make a report'],
                'response' => "To file an anonymous corruption report:\n\n1. Click the **File Report** tab at the top\n2. Select the type of corruption (Bribery, Procurement Fraud, Abuse of Office, Embezzlement, Nepotism, or Other)\n3. Enter the affected government institution and location\n4. Write a detailed description — **the more detail, the higher the investigation priority**\n5. Optionally attach evidence files (photos, documents, audio, video)\n6. Click **Submit Anonymous Report**\n\n**No account, email, or personal information required.** After submitting, you'll receive a unique **tracking code** (e.g., ZACC-REF-XXXXXX) — save it securely, as it's your only way to follow your case.\n\n💡 **Pro tip:** You can also say **\"file a report\"** right here in this chat, and I'll guide you through it step by step!"
            ],

            [
                'patterns' => ['track', 'check status', 'case status', 'my case', 'follow up', 'update', 'progress'],
                'response' => "To track your case:\n\n1. Click the **Track Case** tab\n2. Enter your tracking code (e.g., ZACC-REF-XXXXXX)\n3. Click **Track Case**\n\nYou'll see:\n- **Current status** — where your case is in the investigation pipeline\n- **Timeline** — a visual progress tracker through each stage\n- **Investigator notes** — updates at each stage of the investigation\n- **Options** — upload additional evidence or dispute a closure\n\n**Investigation Stages:**\n📥 Submitted → 🔍 Under Review → 🕵️ Investigating → 📋 Referred → ✅ Closed\n\nIf you've lost your tracking code, unfortunately we cannot retrieve it (for anonymity reasons), but you can always file a new report."
            ],

            [
                'patterns' => ['safe', 'anonymous', 'identity', 'private', 'privacy', 'secret', 'confidential', 'protect'],
                'response' => "Your identity is **completely protected** through multiple layers of security:\n\n🔒 **Zero Personal Data** — We never collect your name, email, phone, or IP address\n🔐 **AES-256 Encryption** — All case details are encrypted at rest using military-grade encryption\n⛓️ **Blockchain Anchoring** — Your report is hashed and anchored to a blockchain, making it tamper-proof\n🕵️ **Anonymous Design** — Reports are not linked to any account or session\n🚪 **Panic Exit** — A quick-exit button instantly hides the page if someone approaches\n\nUnder Zimbabwe's whistleblower protection framework, reporting corruption is protected by law. Even ZACC investigators cannot identify who filed an anonymous report through this system.\n\nYou are safe. Your courage to report corruption makes a real difference."
            ],

            [
                'patterns' => ['evidence', 'attach', 'upload', 'photos', 'documents', 'proof', 'files'],
                'response' => "Evidence significantly strengthens your case. Here's what you need to know:\n\n**Accepted File Types:**\n📷 Photos: JPG, PNG\n🎥 Videos: MP4, MOV\n🎙️ Audio: MP3, WAV\n📄 Documents: PDF, DOC, DOCX, XLS, XLSX, TXT\n\n**Limits:** Up to 10 files, max 10MB each\n\n**Best Evidence to Include:**\n- Screenshots of communications (emails, messages, WhatsApp)\n- Photos of documents, receipts, or contracts\n- Audio/video recordings of corrupt acts\n- Financial records showing irregularities\n- Official documents that contradict public statements\n\n**How to Upload:**\n1. Go to **Track Case** and enter your tracking code\n2. Scroll to **Add Evidence**\n3. Select and upload your files\n\n💡 **Tip:** Even partial evidence helps. An investigator can use a single receipt or screenshot to open a broader investigation."
            ],

            [
                'patterns' => ['dispute', 'disagree', 'appeal', 'challenge', 'unfair', 'reopen', 'not satisfied'],
                'response' => "If you believe your case was closed unfairly, you have the right to dispute it:\n\n1. Go to **Track Case** and enter your tracking code\n2. Scroll to the **Case Closed** section\n3. Click **Dispute This Decision**\n4. Write a detailed statement explaining why you disagree with the closure\n5. Optionally attach new evidence that supports your dispute\n6. Submit the dispute\n\n**What happens next:**\n- Your case status changes to **DISPUTED**\n- ZACC management is notified and will conduct a fresh review\n- The review considers your dispute statement and any new evidence\n\nDisputes are taken seriously — they ensure accountability in the investigation process."
            ],

            [
                'patterns' => ['brib', 'procurement', 'abuse', 'embezzl', 'nepotism', 'corrupt', 'fraud', 'steal', 'theft'],
                'response' => "It sounds like you may have witnessed corruption. Here are the types ZACC investigates:\n\n🏷️ **Bribery** — Giving/receiving money or favours for official action\n📦 **Procurement Fraud** — Rigged tenders, inflated contracts, kickbacks\n👔 **Abuse of Office** — Misusing official position for personal gain\n💰 **Embezzlement** — Stealing or misappropriating public funds\n👨‍👩‍👦 **Nepotism** — Favouring relatives in hiring, contracts, or promotions\n🔄 **Other** — Any other form of corruption or misconduct\n\nTo make your report as impactful as possible, include:\n- **What** happened (describe the corrupt act)\n- **Who** was involved (job titles, not your own name)\n- **When** it happened (dates or time periods)\n- **Where** (which institution, department, location)\n- **How much** money was involved (even estimates help)\n\nSay **\"file a report\"** and I'll guide you through it step by step!"
            ],

            [
                'patterns' => ['stage', 'investigation', 'process', 'what happens', 'timeline', 'how long'],
                'response' => "Here's how the ZACC investigation process works:\n\n**📥 Stage 1: SUBMITTED**\nYour report is received and an AI expert system automatically assesses priority based on corruption type, details, and financial magnitude.\n\n**🔍 Stage 2: UNDER REVIEW**\nA ZACC investigator reviews the report, verifies the information, and determines if a full investigation is warranted.\n\n**🕵️ Stage 3: INVESTIGATING**\nActive investigation — gathering evidence, interviewing witnesses, analysing documents. This is typically the longest stage.\n\n**📋 Stage 4: REFERRED**\nIf the case involves criminal conduct, it may be referred to the National Prosecuting Authority (NPA) or other relevant bodies.\n\n**✅ Stage 5: CLOSED**\nThe investigation concludes with findings documented. If you disagree with the closure, you can **dispute** the decision.\n\nHigher-priority cases (more detail, more evidence) are typically investigated faster."
            ],

            [
                'patterns' => ['help', 'hi', 'hello', 'hey', 'guide', 'greet', 'good morning', 'good afternoon'],
                'response' => "Hello! I'm the **ZACC Guide** — your AI-powered anti-corruption assistant. 🛡️\n\nI'm here to help you:\n- 📝 **File a corruption report** (anonymously, step by step)\n- 🔍 **Track your case** using your tracking code\n- 📎 **Submit evidence** to strengthen your case\n- ⚖️ **Dispute a decision** if you disagree with a case closure\n- 🔒 **Understand your protections** — how your anonymity is guaranteed\n- 📚 **Learn about corruption types** and Zimbabwe's anti-corruption laws\n\nI speak **English, Shona, Ndebele, and Tonga** — just write in your preferred language!\n\nWhat would you like help with?"
            ],

            [
                'patterns' => ['shona', 'ndebele', 'language', 'tonga', 'chivanhu'],
                'response' => "Ndinogona kukubatsira muShona, Ndebele, English, kana Tonga! 🇿🇼\n\nNyora mubvunzo wako mumutauro waunoda, uye ndichapindura mumutauro iwoyo.\n\nI can assist you in English, Shona, Ndebele, or Tonga! Simply write your question in your preferred language, and I'll respond in the same language."
            ],

            [
                'patterns' => ['blockchain', 'verify', 'hash', 'tamper', 'integrity'],
                'response' => "Your report is protected by **blockchain verification**:\n\n⛓️ When your report is submitted, a unique **SHA-256 hash** (digital fingerprint) is created from its contents.\n\nThis hash is recorded on a blockchain — a distributed, immutable ledger that cannot be altered or deleted by anyone, including ZACC staff.\n\n**What this means for you:**\n- Your report cannot be tampered with after submission\n- Any modification would change the hash, instantly revealing tampering\n- The blockchain provides an independent, verifiable audit trail\n- This protects both whistleblowers and investigators\n\nYou can verify your report's blockchain integrity anytime through the **Track Case** page."
            ],
        ];

        foreach ($responses as $item) {
            foreach ($item['patterns'] as $pattern) {
                if (str_contains($lower, $pattern)) {
                    return $item['response'];
                }
            }
        }

        return "I'm the **ZACC Guide**, your anti-corruption assistant. I can help you with:\n\n- 📝 **Filing a report** — say \"file a report\" to start\n- 🔍 **Tracking a case** — tell me about tracking\n- 📎 **Submitting evidence** — ask about evidence types\n- ⚖️ **Disputing a decision** — ask about disputes\n- 🔒 **Privacy & security** — ask about anonymity\n- 📚 **Understanding the process** — ask about investigation stages\n\nTry asking a specific question, or click one of the quick topic buttons below!";
    }
}
