import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from './LLMProvider.js';
import { logger } from '../utils/logger.js';

const LLM_TIMEOUT_MS = 8000;

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await Promise.race([
          this.client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM timeout (8s)')), LLM_TIMEOUT_MS)
          ),
        ]);
        const textBlock = response.content.find(b => b.type === 'text');
        return textBlock ? textBlock.text : '{}';
      } catch (err: any) {
        logger.warn(`Anthropic attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return '{}';
  }
}
