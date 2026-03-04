import { GameState, Agent, Action, DiplomaticRelation } from '../models/GameState.js';
import {
  PEACE_TREATY_DURATION,
  ALLIANCE_DURATION,
  BETRAYAL_REPUTATION_PENALTY,
} from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export class DiplomacyManager {
  /** Initialize all diplomacy relations as neutral */
  initializeDiplomacy(agents: Agent[]): Record<string, DiplomaticRelation> {
    const diplomacy: Record<string, DiplomaticRelation> = {};
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const key = getDiplomacyKey(agents[i].id, agents[j].id);
        diplomacy[key] = { type: 'neutral', turnsRemaining: 0, proposedBy: '' };
      }
    }
    return diplomacy;
  }

  /** Tick all diplomacy timers, expiring treaties that ran out */
  tickTimers(diplomacy: Record<string, DiplomaticRelation>): void {
    for (const [key, rel] of Object.entries(diplomacy)) {
      if (rel.turnsRemaining > 0) {
        rel.turnsRemaining--;
        if (rel.turnsRemaining === 0 && (rel.type === 'peace' || rel.type === 'alliance')) {
          rel.type = 'neutral';
          logger.info(`Diplomacy expired: ${key} → neutral`);
        }
      }
    }
  }

  /** Handle attack breaking an existing treaty */
  handleAttackBetrayal(state: GameState, attacker: Agent, defenderId: string): void {
    const dipKey = getDiplomacyKey(attacker.id, defenderId);
    const rel = state.diplomacy[dipKey];
    if (rel && (rel.type === 'peace' || rel.type === 'alliance')) {
      rel.type = 'war';
      rel.turnsRemaining = 0;
      attacker.reputation = Math.max(0, attacker.reputation - BETRAYAL_REPUTATION_PENALTY);
      attacker.memory.push(`T${state.turn}: BETRAYED ${defenderId}! Reputation dropped.`);
      for (const other of state.agents) {
        if (other.id !== attacker.id && other.isAlive) {
          other.memory.push(`T${state.turn}: ${attacker.name} BETRAYED a treaty with ${defenderId}!`);
        }
      }
    }
  }

  /** Execute a propose_peace action */
  proposePeace(state: GameState, agent: Agent, action: Action): { success: boolean; message: string } {
    if (!action.targetAgentId) return { success: false, message: 'No target agent' };
    const target = state.agents.find(a => a.id === action.targetAgentId && a.isAlive);
    if (!target) return { success: false, message: 'Target not found' };

    const key = getDiplomacyKey(agent.id, target.id);
    const rel = state.diplomacy[key];
    if (!rel) return { success: false, message: 'Invalid relation' };
    if (rel.type === 'peace' || rel.type === 'alliance') {
      return { success: false, message: 'Already at peace' };
    }

    const acceptChance = 0.3 + agent.reputation * 0.004 + agent.attributes.charisma * 0.01;
    if (Math.random() < acceptChance) {
      rel.type = 'peace';
      rel.turnsRemaining = PEACE_TREATY_DURATION;
      rel.proposedBy = agent.id;
      agent.treatiesMade++;
      target.treatiesMade++;
      agent.memory.push(`T${state.turn}: Peace treaty with ${target.name} accepted!`);
      target.memory.push(`T${state.turn}: Accepted peace with ${agent.name}`);
      return { success: true, message: `Peace with ${target.name}! (${PEACE_TREATY_DURATION} turns)` };
    }
    agent.memory.push(`T${state.turn}: ${target.name} rejected peace proposal`);
    return { success: false, message: `${target.name} rejected peace` };
  }

  /** Execute a propose_alliance action */
  proposeAlliance(state: GameState, agent: Agent, action: Action): { success: boolean; message: string } {
    if (!action.targetAgentId) return { success: false, message: 'No target agent' };
    const allyTarget = state.agents.find(a => a.id === action.targetAgentId && a.isAlive);
    if (!allyTarget) return { success: false, message: 'Target not found' };

    const allyKey = getDiplomacyKey(agent.id, allyTarget.id);
    const allyRel = state.diplomacy[allyKey];
    if (!allyRel) return { success: false, message: 'Invalid relation' };
    if (allyRel.type === 'alliance') return { success: false, message: 'Already allied' };

    const allyChance = 0.15 + agent.reputation * 0.005 + agent.attributes.charisma * 0.015;
    if (Math.random() < allyChance) {
      allyRel.type = 'alliance';
      allyRel.turnsRemaining = ALLIANCE_DURATION;
      allyRel.proposedBy = agent.id;
      agent.treatiesMade++;
      allyTarget.treatiesMade++;
      agent.memory.push(`T${state.turn}: Alliance with ${allyTarget.name}!`);
      allyTarget.memory.push(`T${state.turn}: Allied with ${agent.name}`);
      return { success: true, message: `Allied with ${allyTarget.name}! (${ALLIANCE_DURATION} turns)` };
    }
    return { success: false, message: `${allyTarget.name} rejected alliance` };
  }

  /** Execute a break_treaty action */
  breakTreaty(state: GameState, agent: Agent, action: Action): { success: boolean; message: string } {
    if (!action.targetAgentId) return { success: false, message: 'No target agent' };
    const breakKey = getDiplomacyKey(agent.id, action.targetAgentId);
    const breakRel = state.diplomacy[breakKey];
    if (!breakRel || breakRel.type === 'neutral' || breakRel.type === 'war') {
      return { success: false, message: 'No treaty to break' };
    }
    breakRel.type = 'war';
    breakRel.turnsRemaining = 0;
    agent.reputation = Math.max(0, agent.reputation - BETRAYAL_REPUTATION_PENALTY);
    agent.treatiesBroken++;
    agent.memory.push(`T${state.turn}: Broke treaty with ${action.targetAgentId}`);
    return { success: true, message: `Broke treaty with ${action.targetAgentId}! Reputation -${BETRAYAL_REPUTATION_PENALTY}` };
  }
}
