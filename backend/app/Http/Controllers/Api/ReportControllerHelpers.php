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
     * Expert system: automatically determines case priority from report attributes.
     *
     * Uses multi-factor analysis across 12 dimensions: corruption type severity,
     * senior official involvement, financial scale, numeric amount detection,
     * government institution involvement, crime severity keywords, evidence quality,
     * temporal specificity, description quality, urgency, victim/public impact,
     * and cross-factor amplification.
     *
     * Both authenticated and anonymous report flows share this single implementation
     * to ensure consistent, fair priority assignment.
     */
    protected function determineExpertPriority(array $data): string
    {
        $type = strtolower($data['type'] ?? '');
        $description = $data['description'] ?? '';
        $institution = $data['institution'] ?? '';
        $location = $data['location'] ?? '';
        $text = strtolower($description . ' ' . $institution . ' ' . $location);

        $score = 0;
        $factorHits = 0; // track how many distinct factor groups fire

        // ── Factor 1: Corruption Type Severity ──
        $typeScores = [
            'embezzlement'      => 40,
            'procurement fraud' => 35,
            'abuse of office'   => 25,
            'bribery'           => 20,
            'nepotism'          => 12,
            'other'             => 8,
        ];
        foreach ($typeScores as $t => $pts) {
            if (str_contains($type, $t)) {
                $score += $pts;
                $factorHits++;
                break;
            }
        }

        // ── Factor 2: High-value targets / senior officials (English + Shona + Ndebele + Tonga) ──
        $seniorOfficials = [
            // English
            'president', 'vice president', 'prime minister', 'minister',
            'permanent secretary', 'director general', 'commissioner',
            'attorney general', 'chief justice', 'governor', 'mayor',
            'secretary', 'chief executive', 'managing director',
            'board chairman', 'deputy minister', 'ambassador', 'consul',
            'speaker of parliament', 'senator', 'member of parliament',
            'provincial governor', 'town clerk', 'city council chairman',
            'commandant', 'inspector general', 'auditor general',
            // Shona
            'mutungamiriri', 'mukuru wehurumende', 'gweta rehurumende',
            'mutongi mukuru', 'gavhuna', 'meya', 'nhengo yeparamende',
            'mumiririri', 'mukuru wemutemo',
            // Ndebele
            'umongameli', 'undunankulu', 'ungqongqoshe',
            'umphathiswa', 'imeya', 'ilungu lephalamende',
            'umgcinimafa', 'umbusi',
            // Tonga
            'mweendelezi', 'simalelo', 'musololi',
        ];
        $officialHits = 0;
        foreach ($seniorOfficials as $kw) {
            if (str_contains($text, $kw)) {
                $officialHits++;
            }
        }
        if ($officialHits > 0) {
            // First match = 25, subsequent matches = 10 each (capped)
            $score += 25 + min(($officialHits - 1) * 10, 20);
            $factorHits++;
        }

        // ── Factor 3: Scale indicators (English + Shona + Ndebele + Tonga) ──
        $largeScaleKeywords = [
            // English
            'million' => 30, 'billion' => 35, 'trillion' => 40,
            'widespread' => 20, 'systematic' => 22,
            'organised' => 20, 'organized' => 20,
            'syndicate' => 25, 'cartel' => 25,
            'network' => 15, 'ring' => 15, 'scheme' => 12,
            'hundreds of thousands' => 18,
            'large scale' => 18, 'mass' => 10,
            // Shona
            'miriyoni' => 30, 'bhiriyoni' => 35, 'kwakawanda' => 20,
            'kurongedzwa' => 22, 'zhinji' => 20, 'mukuru' => 10,
            // Ndebele
            'isigidi' => 30, 'izigidigidi' => 35, 'okubanzi' => 20,
            'okuhlelelweyo' => 22, 'okukhulu' => 18,
            // Tonga
            'zyuulu zyuulu' => 30, 'zyiingi' => 20, 'cipimo cipati' => 18,
        ];
        $scaleBonus = 0;
        foreach ($largeScaleKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $scaleBonus += $pts;
            }
        }
        if ($scaleBonus > 0) {
            $score += min($scaleBonus, 60);
            $factorHits++;
        }

        // ── Factor 4: Numeric amount detection (USD/ZWL/ZiG amounts) ──
        $amountBonus = 0;
        // Currency prefixed amounts: $X, US$X, Z$X, ZiG X
        if (preg_match('/(?:\$|us\$|z\$|zig)\s*[\d,]+(?:\.\d+)?/i', $text)) {
            $amountBonus += 15;
        }
        // Explicit currency mentions: USD X, ZWL X, ZiG X
        if (preg_match('/(?:usd|zwl|zig|rtgs)\s*[\d,]+/i', $text)) {
            $amountBonus += 12;
        }
        // Large bare numbers (6+ digits suggest significant amounts)
        if (preg_match('/\b\d{6,}\b/', $text)) {
            $amountBonus += 12;
        }
        // Amounts in words: "two million", "five hundred thousand"
        if (preg_match('/\b(?:hundred|thousand|million|billion)\s+(?:dollars|usd|zwl|zig)/i', $text)) {
            $amountBonus += 10;
        }
        if ($amountBonus > 0) {
            $score += min($amountBonus, 30);
            $factorHits++;
        }

        // ── Factor 5: Government / public institution involvement (English + Shona + Ndebele + Tonga) ──
        $govKeywords = [
            // English
            'government' => 10, 'public funds' => 12, 'taxpayer' => 12,
            'contract' => 8, 'tender' => 10,
            'ministry' => 9, 'department' => 7, 'council' => 8,
            'authority' => 8, 'state' => 7, 'national' => 7,
            'parastatal' => 10, 'municipality' => 9, 'rural district' => 8,
            // Zimbabwe-specific entities
            'police' => 9, 'army' => 9, 'military' => 9, 'zdf' => 10,
            'hospital' => 8, 'school' => 7, 'university' => 8,
            'zesa' => 10, 'zinwa' => 10, 'zimra' => 10, 'nssa' => 10,
            'psmas' => 9, 'gmb' => 9, 'zbc' => 8, 'zinara' => 10,
            'caaz' => 9, 'potraz' => 9, 'zetdc' => 9,
            'nrz' => 9, 'idbz' => 9, 'rbz' => 12,
            'parliament' => 10, 'judiciary' => 10, 'prosecutor' => 10,
            'electoral' => 9, 'zec' => 10,
            // Shona
            'hurumende' => 10, 'mari yehurumende' => 12, 'mari yevanhu' => 12,
            'tenda' => 10, 'dare' => 8, 'dunhu' => 8,
            'mapurisa' => 9, 'masoja' => 9, 'chipatara' => 8, 'chikoro' => 7,
            'parimende' => 10, 'dare remutemo' => 10,
            // Ndebele
            'uhulumende' => 10, 'imali kahulumende' => 12, 'imali yabantu' => 12,
            'ithenda' => 10, 'umkhandlu' => 8, 'isigaba' => 7,
            'amapholisa' => 9, 'amabutho' => 9, 'isibhedlela' => 8, 'isikolo' => 7,
            'iphalamende' => 10, 'inkantolo' => 10,
            // Tonga
            'bulelo' => 10, 'mali yabulelo' => 12,
            'bapolisa' => 9, 'cibbadela' => 8, 'cikolo' => 7,
        ];
        $govBonus = 0;
        foreach ($govKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $govBonus += $pts;
            }
        }
        if ($govBonus > 0) {
            $score += min($govBonus, 35);
            $factorHits++;
        }

        // ── Factor 6: Crime severity keywords (English + Shona + Ndebele + Tonga) ──
        $crimeKeywords = [
            // English
            'bribe' => 7, 'fraud' => 8, 'theft' => 8, 'steal' => 8,
            'coercion' => 10, 'embezzle' => 9, 'kickback' => 10,
            'extort' => 12, 'misuse' => 6, 'stolen' => 8,
            'siphon' => 10, 'inflate' => 8, 'phantom' => 12,
            'launder' => 15, 'money laundering' => 18,
            'forgery' => 10, 'forged' => 10, 'falsified' => 10,
            'illegal' => 6, 'illicit' => 8,
            'ghost workers' => 15, 'fictitious' => 12,
            'collusion' => 12, 'conspiracy' => 10,
            'intimidat' => 12, 'threaten' => 10,
            'loot' => 10, 'plunder' => 10, 'divert' => 8,
            'overpricing' => 10, 'under-invoicing' => 10,
            'conflict of interest' => 10, 'front company' => 12,
            'shell company' => 12, 'offshore' => 12,
            // Shona crime keywords
            'kuba' => 8, 'kubiridzira' => 7, 'uori' => 8, 'kushandisa mari' => 9,
            'kutora mari' => 9, 'kunyepera' => 8, 'kushandiswa kwemari' => 9,
            'kuba mari' => 10, 'kufurira' => 7, 'kushungurudza' => 10,
            'upenyu hwemari' => 8, 'kupa chiokomuhomwe' => 7, 'mhosva' => 6,
            'kutengesa zvakavanzika' => 10, 'kushandisa simba' => 10,
            'kubira' => 8, 'kupamba' => 10, 'kunyima' => 6,
            'kuvhara maziso' => 8, 'kunzvenga mutemo' => 8,
            // Ndebele crime keywords
            'ukweba' => 8, 'ubugebengu' => 8, 'umkhonyovu' => 8,
            'intshontshela' => 10, 'ukuqilibezela' => 8, 'ukutshontsha' => 8,
            'ukudla imali' => 10, 'ukufumbathisa' => 7, 'ukukhwabanisa' => 8,
            'ukusebenzisa amandla' => 10, 'ukuthungela' => 8,
            'ukuphanga' => 10, 'ukwesabisa' => 12,
            // Tonga crime keywords
            'kwiiba' => 8, 'bumpelenge' => 8, 'bubi' => 6,
            'kusebenzesa mali' => 9, 'kupelengesa' => 8,
            'rushwa' => 8, 'wizi' => 8, 'ulaghai' => 8,
        ];
        $crimeBonus = 0;
        foreach ($crimeKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $crimeBonus += $pts;
            }
        }
        if ($crimeBonus > 0) {
            $score += min($crimeBonus, 40);
            $factorHits++;
        }

        // ── Factor 7: Evidence quality indicators ──
        $evidenceKeywords = [
            'document' => 5, 'receipt' => 6, 'invoice' => 6,
            'proof' => 4, 'witness' => 6, 'recording' => 8,
            'photo' => 5, 'video' => 7, 'screenshot' => 5,
            'bank statement' => 8, 'audit' => 7, 'email' => 5,
            'letter' => 4, 'contract copy' => 7, 'affidavit' => 8,
            'payslip' => 6, 'voucher' => 6, 'minutes' => 5,
            'cctv' => 8, 'forensic' => 9,
        ];
        $evidenceBonus = 0;
        foreach ($evidenceKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $evidenceBonus += $pts;
            }
        }
        if ($evidenceBonus > 0) {
            $score += min($evidenceBonus, 25);
            $factorHits++;
        }

        // ── Factor 8: Temporal specificity (dates/times mentioned) ──
        $datePatterns = 0;
        if (preg_match('/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/', $text)) $datePatterns++;
        if (preg_match('/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i', $text)) $datePatterns++;
        if (preg_match('/\b20[12]\d\b/', $text)) $datePatterns++;
        if ($datePatterns > 0) {
            $score += min($datePatterns * 5, 15);
            $factorHits++;
        }

        // ── Factor 9: Description quality / length ──
        $len = strlen($description);
        if ($len > 1000)     $score += 20;
        elseif ($len > 500)  $score += 15;
        elseif ($len > 250)  $score += 8;
        elseif ($len > 100)  $score += 3;

        // ── Factor 10: Urgency / ongoing nature (English + Shona + Ndebele + Tonga) ──
        $urgencyKeywords = [
            // English
            'ongoing', 'happening now', 'today', 'currently',
            'right now', 'this week', 'this month', 'urgent',
            'imminent', 'about to', 'deadline', 'tomorrow',
            'evidence may be destroyed', 'fleeing', 'leaving the country',
            // Shona
            'zviri kuitika', 'nhasi', 'pari zvino', 'nekukurumidza',
            'ikwekwe', 'mangwana', 'svondo rino', 'mwedzi uno',
            'uchapupu hunogona kuparadzwa', 'kutiza',
            // Ndebele
            'kuyenzeka', 'lamuhla', 'khathesi', 'ngokuphangisa',
            'kusasa', 'iviki le', 'inyanga le',
            'ubufakazi bungalahlwa', 'ukubaleka',
            // Tonga
            'cicitika', 'sunu', 'lino', 'cakufwambaana',
        ];
        foreach ($urgencyKeywords as $kw) {
            if (str_contains($text, $kw)) {
                $score += 8;
                $factorHits++;
                break;
            }
        }

        // ── Factor 11: Victim / public impact indicators (English + Shona + Ndebele + Tonga) ──
        $impactKeywords = [
            // English
            'public health' => 12, 'water supply' => 10, 'food supply' => 10,
            'medicine' => 10, 'medical supplies' => 12, 'children' => 8,
            'school fees' => 8, 'pension' => 10, 'salary' => 7,
            'community' => 6, 'village' => 6, 'residents' => 6,
            'patients' => 10, 'orphan' => 10, 'disabled' => 8,
            'elderly' => 8, 'vulnerable' => 8, 'displaced' => 10,
            'deaths' => 15, 'died' => 12, 'injuries' => 10,
            'hunger' => 10, 'starvation' => 12,
            'infrastructure' => 8, 'road' => 6, 'bridge' => 6, 'dam' => 8,
            // Shona
            'hutano hweveruzhinji' => 12, 'mvura' => 10, 'chikafu' => 10,
            'mushonga' => 10, 'vana' => 8, 'mari yechikoro' => 8,
            'penisheni' => 10, 'mushahara' => 7, 'nharaunda' => 6,
            'musha' => 6, 'varwere' => 10, 'nherera' => 10,
            'vakwegura' => 8, 'rufu' => 15, 'vakafa' => 12,
            'kukuvara' => 10, 'nzara' => 10, 'mugwagwa' => 6,
            // Ndebele
            'impilakahle' => 12, 'amanzi' => 10, 'ukudla' => 10,
            'umuthi' => 10, 'abantwana' => 8, 'imali yesikolo' => 8,
            'umpensheni' => 10, 'umholo' => 7, 'umphakathi' => 6,
            'igama' => 6, 'izigulane' => 10, 'izintandane' => 10,
            'abadala' => 8, 'ukufa' => 15, 'bafile' => 12,
            'ukulimala' => 10, 'indlala' => 10, 'umgwaqo' => 6,
            // Tonga
            'buumi bwabantu' => 12, 'maanzi' => 10, 'cakulya' => 10,
            'musamu' => 10, 'bana' => 8, 'cipensheni' => 10,
            'mushahala' => 7, 'bantu' => 6, 'lufu' => 15,
            'nzala' => 10, 'nzila' => 6,
        ];
        $impactBonus = 0;
        foreach ($impactKeywords as $kw => $pts) {
            if (str_contains($text, $kw)) {
                $impactBonus += $pts;
            }
        }
        if ($impactBonus > 0) {
            $score += min($impactBonus, 30);
            $factorHits++;
        }

        // ── Factor 12: Cross-factor amplification ──
        // When multiple distinct factor categories fire, the case is more substantive.
        // 5+ factor groups active = +15, 4 = +10, 3 = +5
        if ($factorHits >= 5) {
            $score += 15;
        } elseif ($factorHits >= 4) {
            $score += 10;
        } elseif ($factorHits >= 3) {
            $score += 5;
        }

        Log::info('Expert system scoring', [
            'type' => $type,
            'total_score' => $score,
            'factor_hits' => $factorHits,
            'desc_length' => $len,
        ]);

        if ($score >= 80) return 'CRITICAL';
        if ($score >= 45) return 'HIGH';
        if ($score >= 22) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Calculate risk score based on expert priority and report content analysis.
     *
     * @param array $data
     * @return int
     */
    protected function calculateRiskScore(array $data): int
    {
        // Base score from priority
        $score = [
            'LOW' => 25,
            'MEDIUM' => 45,
            'HIGH' => 70,
            'CRITICAL' => 90,
        ][$data['priority']] ?? 50;

        $text = strtolower(
            ($data['description'] ?? '') . ' ' .
            ($data['institution'] ?? '') . ' ' .
            ($data['location'] ?? '')
        );

        // Crime keyword bonus (+3 each, capped at +15)
        $crimeBonus = 0;
        foreach (['bribe', 'fraud', 'embezzle', 'theft', 'coercion', 'extort', 'kickback', 'launder', 'siphon', 'phantom'] as $kw) {
            if (str_contains($text, $kw)) {
                $crimeBonus += 3;
            }
        }
        $score += min($crimeBonus, 15);

        // Financial scale bonus
        if (preg_match('/(?:million|billion)/i', $text)) {
            $score += 5;
        }

        // Senior official involvement bonus
        foreach (['minister', 'president', 'director general', 'commissioner', 'permanent secretary'] as $kw) {
            if (str_contains($text, $kw)) {
                $score += 3;
                break;
            }
        }

        // Evidence mentioned bonus
        foreach (['document', 'video', 'recording', 'bank statement', 'receipt'] as $kw) {
            if (str_contains($text, $kw)) {
                $score += 2;
                break;
            }
        }

        return max(0, min(100, $score));
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
