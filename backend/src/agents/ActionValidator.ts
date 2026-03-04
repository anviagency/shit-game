import { Action, LLMResponseSchema, ActionSchema } from '../models/GameState.js';
import { logger } from '../utils/logger.js';

export class ActionValidator {
  parseAndValidate(raw: string, agentId: string): Action[] {
    try {
      let jsonStr = raw.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      const parsed = JSON.parse(jsonStr);
      const result = LLMResponseSchema.safeParse(parsed);

      if (result.success) {
        return result.data.actions.map(a => ({ ...a, agentId }));
      }

      logger.warn(`Validation failed for ${agentId}: ${result.error.message}`);

      if (parsed.actions && Array.isArray(parsed.actions)) {
        const valid: Action[] = [];
        for (const a of parsed.actions) {
          const actionResult = ActionSchema.safeParse({ ...a, agentId });
          if (actionResult.success) valid.push(actionResult.data);
        }
        if (valid.length > 0) return valid;
      }
    } catch (err: any) {
      logger.warn(`Parse failed for ${agentId}: ${err.message}`);
    }

    return [{ type: 'gather', agentId }];
  }
}
