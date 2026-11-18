import { initChatModel } from 'langchain';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * The model is a "provider:model" string resolved by LangChain, so switching
 * provider is a config change:
 *
 *   LLM_MODEL=openai:gpt-6-luna            (default, needs OPENAI_API_KEY)
 *   LLM_MODEL=anthropic:<model>            (needs @langchain/anthropic + ANTHROPIC_API_KEY)
 *   LLM_MODEL=google-genai:<model>         (needs @langchain/google-genai + GOOGLE_API_KEY)
 *
 * Each provider package reads its own API key from the environment.
 */
const DEFAULT_MODEL = 'openai:gpt-6-luna';

const PROVIDER_KEY_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  'google-genai': 'GOOGLE_API_KEY',
  mistralai: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
};

export function getModelName(): string {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

function getProvider(): string {
  const name = getModelName();
  return name.includes(':') ? name.split(':')[0] : 'openai';
}

/** Whether the configured provider has credentials. Makes no model call. */
export function isLLMConfigured(): boolean {
  const keyEnv = PROVIDER_KEY_ENV[getProvider()];
  // Unknown providers (e.g. local ones) may need no key; let them through.
  return keyEnv ? !!process.env[keyEnv] : true;
}

let modelPromise: Promise<BaseChatModel> | null = null;

export function getChatModel(): Promise<BaseChatModel> {
  if (!modelPromise) {
    if (!isLLMConfigured()) {
      throw new Error(`${PROVIDER_KEY_ENV[getProvider()]} is not configured`);
    }
    const temperature = process.env.LLM_TEMPERATURE;
    modelPromise = initChatModel(getModelName(), {
      // Only sent when set: some reasoning models reject a temperature.
      ...(temperature ? { temperature: Number(temperature) } : {}),
      maxRetries: 2,
    }) as unknown as Promise<BaseChatModel>;
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}
