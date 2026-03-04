import { GameState, Agent, Action, MapCell } from '../models/GameState.js';
import { ResourceManager } from './ResourceManager.js';
import { BuildingManager } from './BuildingManager.js';
import { CombatResolver } from './CombatResolver.js';
import { DiplomacyManager } from './DiplomacyManager.js';
import {
  RESEARCH_BOOST,
  CLONE_ATTRIBUTE_INHERIT,
} from '../utils/constants.js';

export interface ActionResult {
  success: boolean;
  message: string;
}

export class ActionExecutor {
  constructor(
    private resourceManager: ResourceManager,
    private buildingManager: BuildingManager,
    private combatResolver: CombatResolver,
    private diplomacyManager: DiplomacyManager,
  ) {}

  execute(state: GameState, agent: Agent, action: Action): ActionResult {
    switch (action.type) {
      case 'gather':
        return { success: true, message: 'Gathered resources' };

      case 'build':
        return this.executeBuild(state, agent, action);

      case 'train':
        return this.executeTrain(state, agent, action);

      case 'clone':
        return this.executeClone(agent);

      case 'move':
        return this.executeMove(state, agent, action);

      case 'attack':
        return this.executeAttack(state, agent, action);

      case 'research':
        return this.executeResearch(agent, action);

      case 'fortify':
        return this.executeFortify(state, agent, action);

      case 'propose_peace':
        return this.diplomacyManager.proposePeace(state, agent, action);

      case 'propose_alliance':
        return this.diplomacyManager.proposeAlliance(state, agent, action);

      case 'break_treaty':
        return this.diplomacyManager.breakTreaty(state, agent, action);

      case 'trade':
        return this.executeTrade(state, agent, action);

      default:
        return { success: false, message: `Unknown: ${action.type}` };
    }
  }

  private executeBuild(state: GameState, agent: Agent, action: Action): ActionResult {
    if (action.targetX == null || action.targetY == null || !action.buildingType) {
      return { success: false, message: 'Build missing target or type' };
    }
    // Pre-check with detailed reason
    const check = this.buildingManager.canBuild(state, agent.id, action.targetX, action.targetY, action.buildingType);
    if (!check.ok) {
      return { success: false, message: `Cannot build ${action.buildingType}: ${check.reason}` };
    }
    const built = this.buildingManager.build(
      state, agent.id, action.targetX, action.targetY, action.buildingType,
    );
    return built
      ? { success: true, message: `Built ${action.buildingType} at (${action.targetX},${action.targetY})` }
      : { success: false, message: `Failed to build ${action.buildingType}` };
  }

  private executeTrain(state: GameState, agent: Agent, action: Action): ActionResult {
    const capacity = this.resourceManager.getTrainingCapacity(state, agent.id);
    const count = Math.min(action.unitCount || capacity, capacity);
    if (!this.resourceManager.canAffordTraining(agent, count)) {
      return { success: false, message: 'Cannot afford training' };
    }
    this.resourceManager.payTrainingCost(agent, count);
    agent.totalUnits += count;
    this.placeUnits(state, agent.id, count);
    return { success: true, message: `Trained ${count} units` };
  }

  private executeClone(agent: Agent): ActionResult {
    if (agent.cloneCount >= agent.maxClones) {
      return { success: false, message: 'Max clones reached' };
    }
    if (!this.resourceManager.canAffordClone(agent)) {
      return { success: false, message: 'Cannot afford clone' };
    }
    this.resourceManager.payCloneCost(agent);
    agent.cloneCount++;
    const bonus = Math.floor(agent.attributes.strength * CLONE_ATTRIBUTE_INHERIT * 0.1);
    agent.attributes.strength += bonus;
    agent.totalUnits += 5;
    // Note: placeUnits not called here since we don't have state — caller handles via map
    return { success: true, message: `Cloned! (#${agent.cloneCount})` };
  }

  private executeMove(state: GameState, agent: Agent, action: Action): ActionResult {
    if (action.sourceX == null || action.sourceY == null || action.targetX == null || action.targetY == null) {
      return { success: false, message: 'Move missing coordinates' };
    }
    const src = state.map[action.sourceY]?.[action.sourceX];
    const tgt = state.map[action.targetY]?.[action.targetX];
    if (!src || !tgt) return { success: false, message: 'Invalid coordinates' };
    if (src.owner !== agent.id) return { success: false, message: 'Source not owned' };
    if (tgt.terrain === 'water') return { success: false, message: 'Cannot move to water' };

    const moveRange = 1 + Math.floor(agent.attributes.agility / 10);
    const dist = Math.abs(action.targetX - action.sourceX) + Math.abs(action.targetY - action.sourceY);
    if (dist > moveRange) return { success: false, message: 'Too far' };

    const moveCount = Math.min(action.unitCount || src.units, src.units);
    if (moveCount <= 0) return { success: false, message: 'No units' };

    if (tgt.owner === agent.id || tgt.owner === null) {
      src.units -= moveCount;
      tgt.units += moveCount;
      tgt.owner = agent.id;
      return { success: true, message: `Moved ${moveCount} → (${action.targetX},${action.targetY})` };
    }
    return { success: false, message: 'Enemy cell, use attack' };
  }

  private executeAttack(state: GameState, agent: Agent, action: Action): ActionResult {
    if (action.sourceX == null || action.sourceY == null || action.targetX == null || action.targetY == null) {
      return { success: false, message: 'Attack missing coordinates' };
    }
    const aSrc = state.map[action.sourceY]?.[action.sourceX];
    const aTgt = state.map[action.targetY]?.[action.targetX];
    if (!aSrc || !aTgt) return { success: false, message: 'Invalid coordinates' };
    if (aSrc.owner !== agent.id) return { success: false, message: 'Source not owned' };
    if (aTgt.terrain === 'water') return { success: false, message: 'Cannot attack water' };

    const atkDist = Math.abs(action.targetX - action.sourceX) + Math.abs(action.targetY - action.sourceY);
    if (atkDist > 1) return { success: false, message: 'Only adjacent cells' };

    // Check diplomacy — attacking through a treaty is betrayal
    if (aTgt.owner) {
      this.diplomacyManager.handleAttackBetrayal(state, agent, aTgt.owner);
    }

    const atkUnits = Math.min(action.unitCount || aSrc.units, aSrc.units);
    if (atkUnits <= 0) return { success: false, message: 'No units' };

    const defender = aTgt.owner ? state.agents.find(a => a.id === aTgt.owner) || null : null;
    const combatResult = this.combatResolver.resolve(state, agent, defender, aSrc, aTgt, atkUnits);
    const msg = this.combatResolver.applyCombatResult(combatResult, agent, defender, aSrc, aTgt, atkUnits);

    return { success: true, message: msg };
  }

  private executeResearch(agent: Agent, action: Action): ActionResult {
    if (!action.attribute) return { success: false, message: 'No attribute' };
    if (!this.resourceManager.canAffordResearch(agent)) {
      return { success: false, message: 'Cannot afford research' };
    }
    this.resourceManager.payResearchCost(agent);
    (agent.attributes as any)[action.attribute] += RESEARCH_BOOST;
    return { success: true, message: `Researched ${action.attribute} (+${RESEARCH_BOOST})` };
  }

  private executeFortify(state: GameState, agent: Agent, action: Action): ActionResult {
    if (action.targetX == null || action.targetY == null) {
      return { success: false, message: 'Fortify missing target' };
    }
    const fCell = state.map[action.targetY]?.[action.targetX];
    if (!fCell || fCell.owner !== agent.id) {
      return { success: false, message: 'Cannot fortify unowned cell' };
    }
    this.combatResolver.fortify(action.targetX, action.targetY);
    return { success: true, message: `Fortified (${action.targetX},${action.targetY})` };
  }

  private executeTrade(state: GameState, agent: Agent, action: Action): ActionResult {
    if (!action.targetAgentId || !action.giveResource || !action.wantResource ||
        action.giveAmount == null || action.wantAmount == null) {
      return { success: false, message: 'Trade missing parameters' };
    }
    if (action.giveAmount <= 0 || action.wantAmount <= 0) {
      return { success: false, message: 'Trade amounts must be positive' };
    }

    const target = state.agents.find(a => a.id === action.targetAgentId);
    if (!target || !target.isAlive) {
      return { success: false, message: 'Trade target not found or dead' };
    }

    // Check sender can afford
    const giveRes = action.giveResource as keyof typeof agent.resources;
    const wantRes = action.wantResource as keyof typeof target.resources;
    if (agent.resources[giveRes] < action.giveAmount) {
      return { success: false, message: `Not enough ${action.giveResource} to trade` };
    }

    // Auto-accept logic: target accepts if they have the resources and the deal is reasonable
    // "Reasonable" = exchange ratio within 3:1 either way, and they have enough
    if (target.resources[wantRes] < action.wantAmount) {
      return { success: false, message: `${target.name} doesn't have enough ${action.wantResource}` };
    }

    const ratio = action.giveAmount / action.wantAmount;
    // Very unfair trades get rejected (offering 1 for 100)
    if (ratio < 0.2) {
      return { success: false, message: `${target.name} rejected unfair trade offer` };
    }

    // Reputation affects acceptance — low rep agents get rejected more
    if (agent.reputation < 20 && Math.random() > 0.3) {
      return { success: false, message: `${target.name} doesn't trust you enough to trade` };
    }

    // Execute trade
    agent.resources[giveRes] -= action.giveAmount;
    target.resources[wantRes] -= action.wantAmount;
    agent.resources[wantRes] += action.wantAmount;
    target.resources[giveRes] += action.giveAmount;

    // Both agents remember the trade
    const tradeMsg = `Traded ${action.giveAmount} ${action.giveResource} for ${action.wantAmount} ${action.wantResource} with ${target.name}`;
    agent.memory.push(tradeMsg);
    target.memory.push(`${agent.name} traded ${action.giveAmount} ${action.giveResource} for ${action.wantAmount} ${action.wantResource}`);

    return { success: true, message: tradeMsg };
  }

  /** Place trained/cloned units on the map, preferring barracks */
  placeUnits(state: GameState, agentId: string, count: number): void {
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner === agentId && cell.building?.type === 'barracks') {
          cell.units += count;
          return;
        }
      }
    }
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner === agentId) {
          cell.units += count;
          return;
        }
      }
    }
  }

  /** Remove units from agent's cells (for starvation) */
  removeUnitsFromMap(state: GameState, agentId: string, count: number): void {
    let remaining = count;
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner === agentId && cell.units > 0 && remaining > 0) {
          const remove = Math.min(cell.units, remaining);
          cell.units -= remove;
          remaining -= remove;
        }
      }
    }
  }
}
