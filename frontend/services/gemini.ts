
import { apiClient } from './api';

const CANONICAL_CASE_TYPES = [
  'Bribery',
  'Procurement Fraud',
  'Abuse of Office',
  'Embezzlement',
  'Nepotism',
  'Other',
] as const;

function normalizeCaseCategory(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Other';

  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const map: Record<string, string> = {
    bribery: 'Bribery',
    bribe: 'Bribery',
    'procurement fraud': 'Procurement Fraud',
    procurement: 'Procurement Fraud',
    tender: 'Procurement Fraud',
    'abuse of office': 'Abuse of Office',
    'abuse of power': 'Abuse of Office',
    embezzlement: 'Embezzlement',
    nepotism: 'Nepotism',
    other: 'Other',
    fraud: 'Other',
    uncategorized: 'Other',
  };

  if (map[normalized]) {
    return map[normalized];
  }

  const titleCase = normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return CANONICAL_CASE_TYPES.includes(titleCase as (typeof CANONICAL_CASE_TYPES)[number])
    ? titleCase
    : 'Other';
}

export const analyzeCase = async (description: string) => {
  try {
    const response = await apiClient.post('/ai/analyze-report', {
      description,
    });

    if (response.success && response.data) {
      return {
        category: normalizeCaseCategory(response.data.category),
        riskScore: response.data.riskScore ?? 50,
        priority: response.data.priority || 'MEDIUM',
        impact: response.data.impact || 'Assessment pending',
        source: 'ai' as const,
      };
    }

    // API returned but without success — log and use keyword-based fallback
    console.warn('AI analysis returned non-success:', response.message);
    return keywordFallbackAnalysis(description);
  } catch (error) {
    console.error('AI analysis error:', error);
    return keywordFallbackAnalysis(description);
  }
};

/**
 * Local keyword-based fallback when Gemini AI is unavailable.
 * Provides basic classification so reports still get meaningful categories.
 */
function keywordFallbackAnalysis(description: string) {
  const lower = description.toLowerCase();

  // Category detection
  let category = 'Other';
  let riskScore = 40;
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

  const categoryPatterns: { patterns: string[]; category: string; baseRisk: number }[] = [
    { patterns: ['brib', 'kickback', 'payment', 'paid', 'brown envelope', 'grease'], category: 'Bribery', baseRisk: 55 },
    { patterns: ['tender', 'procurement', 'contract', 'bid', 'supplier', 'inflat'], category: 'Procurement Fraud', baseRisk: 60 },
    { patterns: ['abuse', 'misuse', 'power', 'authority', 'position', 'office'], category: 'Abuse of Office', baseRisk: 50 },
    { patterns: ['embezzl', 'steal', 'stole', 'stolen', 'misappropriat', 'siphon', 'loot'], category: 'Embezzlement', baseRisk: 65 },
    { patterns: ['nepotism', 'relative', 'family', 'brother', 'sister', 'son', 'daughter', 'wife', 'husband', 'cousin'], category: 'Nepotism', baseRisk: 45 },
    { patterns: ['fraud', 'fake', 'forged', 'falsif', 'doctored'], category: 'Other', baseRisk: 55 },
  ];

  for (const cp of categoryPatterns) {
    if (cp.patterns.some(p => lower.includes(p))) {
      category = cp.category;
      riskScore = cp.baseRisk;
      break;
    }
  }

  // Risk modifiers
  const highRiskIndicators = ['million', 'minister', 'director', 'permanent secretary', 'ceo', 'managing director', 'ongoing', 'years', 'systematic'];
  const medRiskIndicators = ['thousand', 'manager', 'officer', 'several', 'multiple', 'repeated'];

  const highMatches = highRiskIndicators.filter(p => lower.includes(p)).length;
  const medMatches = medRiskIndicators.filter(p => lower.includes(p)).length;
  riskScore = Math.min(100, riskScore + highMatches * 12 + medMatches * 6);

  // Length bonus — more detailed reports are inherently more useful
  if (description.length > 500) riskScore = Math.min(100, riskScore + 10);
  if (description.length > 1000) riskScore = Math.min(100, riskScore + 5);

  // Priority from score
  if (riskScore >= 76) priority = 'CRITICAL';
  else if (riskScore >= 51) priority = 'HIGH';
  else if (riskScore >= 26) priority = 'MEDIUM';
  else priority = 'LOW';

  // Impact assessment
  const impactParts: string[] = [];
  if (category !== 'Other') impactParts.push(`This report describes potential ${category.toLowerCase()}.`);
  if (highMatches > 0) impactParts.push('Senior officials or large sums are indicated, suggesting significant institutional impact.');
  if (description.length > 300) impactParts.push('The detailed description will help investigators prioritise this case.');
  if (impactParts.length === 0) impactParts.push('Assessment based on keyword analysis. AI service was unavailable for deeper review.');

  return {
    category,
    riskScore,
    priority,
    impact: impactParts.join(' '),
    source: 'fallback' as const,
  };
}

export const generateAwarenessImage = async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
  return null;
};

export const getChatbotResponse = async (query: string, history: { role: 'user' | 'bot', text: string }[]) => {
  try {
    const response = await apiClient.chatbotMessage(query, history);
    return response?.data?.response || "I'm your ZACC Guide. How can I help you today?";
  } catch (error) {
    console.error('Chatbot error:', error);
    return "I'm your ZACC Guide. How can I help you today?";
  }
};

