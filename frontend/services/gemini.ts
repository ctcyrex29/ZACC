
import { apiClient } from './api';

export const analyzeCase = async (description: string) => {
  try {
    const response = await apiClient.post('/ai/analyze-report', {
      description,
    });

    if (response.success && response.data) {
      return {
        category: response.data.category || 'UNCATEGORIZED',
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
  let category = 'UNCATEGORIZED';
  let riskScore = 40;
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

  const categoryPatterns: { patterns: string[]; category: string; baseRisk: number }[] = [
    { patterns: ['brib', 'kickback', 'payment', 'paid', 'brown envelope', 'grease'], category: 'BRIBERY', baseRisk: 55 },
    { patterns: ['tender', 'procurement', 'contract', 'bid', 'supplier', 'inflat'], category: 'PROCUREMENT_FRAUD', baseRisk: 60 },
    { patterns: ['abuse', 'misuse', 'power', 'authority', 'position', 'office'], category: 'ABUSE_OF_OFFICE', baseRisk: 50 },
    { patterns: ['embezzl', 'steal', 'stole', 'stolen', 'misappropriat', 'siphon', 'loot'], category: 'EMBEZZLEMENT', baseRisk: 65 },
    { patterns: ['nepotism', 'relative', 'family', 'brother', 'sister', 'son', 'daughter', 'wife', 'husband', 'cousin'], category: 'NEPOTISM', baseRisk: 45 },
    { patterns: ['fraud', 'fake', 'forged', 'falsif', 'doctored'], category: 'FRAUD', baseRisk: 55 },
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
  if (category !== 'UNCATEGORIZED') impactParts.push(`This report describes potential ${category.toLowerCase().replace('_', ' ')}.`);
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

