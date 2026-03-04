import OpenAI from 'openai';
import { LLMProvider } from './LLMProvider.js';
import { logger } from '../utils/logger.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        });
        return response.choices[0]?.message?.content || '{}';
      } catch (err: any) {
        logger.warn(`OpenAI attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return '{}';
  }
}
