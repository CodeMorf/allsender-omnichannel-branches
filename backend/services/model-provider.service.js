import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createXai } from '@ai-sdk/xai';
import { createCohere } from '@ai-sdk/cohere';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const cleanBaseUrl = (endpoint) => {
  if (!endpoint) return undefined;
  return String(endpoint)
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/models\/[^/]+:generateContent.*$/i, '')
    .replace(/\/$/, '');
};

export function createVoltModel({ model, apiKey }) {
  if (!model?.model_id) throw new Error('AI model is not configured');
  if (!apiKey) throw new Error('Customer AI API key is not configured');
  const provider = String(model.provider || '').toLowerCase();
  const baseURL = cleanBaseUrl(model.api_endpoint);

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'anthropic':
      return createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'groq':
      return createGroq({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'mistral':
      return createMistral({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'xai':
      return createXai({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'cohere':
      return createCohere({ apiKey, ...(baseURL ? { baseURL } : {}) })(model.model_id);
    case 'deepseek': {
      const compatible = createOpenAICompatible({ name: 'deepseek', apiKey, baseURL: baseURL || 'https://api.deepseek.com' });
      return compatible(model.model_id);
    }
    case 'custom': {
      if (!baseURL) throw new Error('Custom model requires an OpenAI-compatible api_endpoint');
      const compatible = createOpenAICompatible({ name: 'custom', apiKey, baseURL });
      return compatible(model.model_id);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
