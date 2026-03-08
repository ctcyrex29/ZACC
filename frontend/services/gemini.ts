
import { apiClient } from './api';

export const analyzeCase = async (description: string) => {
  try {
    const response = await apiClient.post('/ai/analyze-report', {
      description,
    });

    if (response.success && response.data) {
      return {
        category: response.data.category || 'UNCATEGORIZED',
        riskScore: response.data.riskScore || 50,
        priority: response.data.priority || 'MEDIUM',
        impact: response.data.impact || 'Assessment pending',
      };
    }

    // Return safe defaults if API fails
    return {
      category: 'UNCATEGORIZED',
      riskScore: 50,
      priority: 'MEDIUM',
      impact: 'Assessment pending',
    };
  } catch (error) {
    console.error('Analysis error:', error);
    // Return safe defaults if request fails
    return {
      category: 'UNCATEGORIZED',
      riskScore: 50,
      priority: 'MEDIUM',
      impact: 'Assessment pending',
    };
  }
};

export const generateAwarenessImage = async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
  // This would need to be implemented on the backend as well
  // For now, return a placeholder
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

