interface FeedbackData {
  team_id?: string;
  device_id?: string;
  team_name?: string;
  display_name?: string;
  feedback_text: string;
}

interface FeedbackResponse {
  success: boolean;
  message: string;
  feedback_id?: string;
  error?: string;
}

export const submitFeedback = async (feedbackData: FeedbackData): Promise<FeedbackResponse> => {
  try {
    const response = await fetch('https://whwsnpzwxagmlkrzrqsa.supabase.co/functions/v1/feedback-submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(feedbackData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};
