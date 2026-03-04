export interface LLMProvider {
  name: string;
  generateResponse(systemPrompt: string, userPrompt: string): Promise<string>;
}
