import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';

dotenv.config();

export const llmConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.1, // Low temperature for consistent, deterministic responses
};

let llmInstance: ChatOpenAI | null = null;

export function getLLM(): ChatOpenAI {
  if (!llmInstance) {
    if (!llmConfig.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    llmInstance = new ChatOpenAI({
      openAIApiKey: llmConfig.apiKey,
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
    });
  }
  return llmInstance;
}

export async function testLLMConnection(): Promise<boolean> {
  try {
    const llm = getLLM();
    const response = await llm.invoke('Test');
    return !!response;
  } catch (error) {
    console.error('LLM connection test failed:', error);
    return false;
  }
}

