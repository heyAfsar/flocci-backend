import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the model
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Get the default model with generation configuration
export const model = genAI.getGenerativeModel({
  model: 'gemini-1-pro',  // Using the correct model name
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 100,
    topP: 0.8,
    topK: 40,
  },
});

// Safety settings
export const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
];
