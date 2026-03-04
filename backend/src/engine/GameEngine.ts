import { GameState, Agent, Action, DiplomaticRelation, TurnDecision } from '../models/GameState.js';
import { generateMap } from './MapGenerator.js';
import { ResourceManager } from './ResourceManager.js';
import { BuildingManager } from './BuildingManager.js';
import { CombatResolver } from './CombatResolver.js';
import { AgentManager } from '../agents/AgentManager.js';
import {
  BASE_ATTRIBUTES,
  BASE_RESOURCES,
  BASE_UNITS,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_TURNS,
  WIN_TERRITORY_PERCENT,
  RESEARCH_BOOST,
  CLONE_ATTRIBUTE_INHERIT,
  BONUS_ATTRIBUTE_POINTS,
  AGENT_NAMES,
  AGENT_COLORS,
  MAX_CLONES,
  FOOD_PER_UNIT,
  STARVATION_LOSS_PERCENT,
  PEACE_TREATY_DURATION,
  ALLIANCE_DURATION,
  BETRAYAL_REPUTATION_PENALTY,
} from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// XP rewards
const XP_REWARDS: Record<string, number> = {
  gather: 1, build: 5, train: 3, clone: 10, move: 2,
  attack: 8, research: 6, fortify: 3,
  propose_peace: 4, propose_alliance: 4, break_treaty: 2,
  kill: 25, win_battle: 15, lose_battle: 3,
};

function xpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(1.4, level - 1));
}

function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export class GameEngine {
  private state: GameState;
  private resourceManager: ResourceManager;
  private buildingManager: BuildingManager;
  private combatResolver: CombatResolver;
  private agentManager: AgentManager;
  private onStateUpdate: (state: GameState) => void;
  private running = false;
  private speedMs: number;

  constructor(
    agentManager: AgentManager,
    onStateUpdate: (state: GameState) => void,
    speedMs = 2000,
  ) {
    this.resourceManager = new ResourceManager();
    this.buildingManager = new BuildingManager(this.resourceManager);
    this.combatResolver = new CombatResolver();
    this.agentManager = agentManager;
    this.onStateUpdate = onStateUpdate;
    this.speedMs = speedMs;

    const agents = this.createAgents();
    const map = generateMap(agents.map(a => a.id));

    // Initialize diplomacy: all neutral
    const diplomacy: Record<string, DiplomaticRelation> = {};
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const key = getDiplomacyKey(agents[i].id, agents[j].id);
        diplomacy[key] = { type: 'neutral', turnsRemaining: 0, proposedBy: '' };
      }
    }

    this.state = {
      map,
      agents,
      turn: 0,
      maxTurns: MAX_TURNS,
      turnLog: [],
      gameOver: false,
      winner: null,
      phase: 'waiting',
      diplomacy,
    };
  }

  private createAgents(): Agent[] {
    const agents: Agent[] = [];
    for (let i = 0; i < 10; i++) {
      // Random attribute distribution
      const attrs = { ...BASE_ATTRIBUTES };
      let points = BONUS_ATTRIBUTE_POINTS;
      const attrKeys = ['strength', 'wisdom', 'agility', 'engineering', 'charisma'] as const;
      while (points > 0) {
        const key = attrKeys[Math.floor(Math.random() * attrKeys.length)];
        const add = Math.min(points, Math.floor(Math.random() * 4) + 1);
        (attrs as any)[key] += add;
        points -= add;
      }

      // Alternate providers: even=openai, odd=anthropic
      const provider = i % 2 === 0 ? 'openai' : 'anthropic';

      agents.push({
        id: AGENT_NAMES[i].toLowerCase(),
        name: AGENT_NAMES[i],
        color: AGENT_COLORS[i],
        personality: '',  // LLM will develop its own personality
        provider: provider as 'openai' | 'anthropic',
        attributes: attrs,
        resources: { ...BASE_RESOURCES },
        totalUnits: BASE_UNITS,
        cloneCount: 0,
        maxClones: MAX_CLONES,
        isAlive: true,
        reputation: 50,
        memory: [],
        xp: 0,
        level: 1,
        kills: 0,
        battlesWon: 0,
        battlesLost: 0,
        treatiesMade: 0,
        treatiesBroken: 0,
        peakTerritory: 0,
      });
    }
    return agents;
  }

  getState(): GameState {
    return this.state;
  }

  getThinkingLogs(): Record<string, TurnDecision[]> {
    const result: Record<string, TurnDecision[]> = {};
    for (const agent of this.state.agents) {
      result[agent.id] = this.agentManager.getThinkingLog(agent.id);
    }
    return result;
  }

  private grantXP(agent: Agent, amount: number): void {
    agent.xp += amount;
    while (agent.xp >= xpForLevel(agent.level)) {
      agent.xp -= xpForLevel(agent.level);
      agent.level++;
      // Level-up bonus: +1 to a random attribute
      const keys = ['strength', 'wisdom', 'agility', 'engineering', 'charisma'] as const;
      const key = keys[Math.floor(Math.random() * keys.length)];
      (agent.attributes as any)[key] += 1;
      agent.attributes.hp += 5;
      logger.info(`${agent.name} leveled up to ${agent.level}! +1 ${key}, +5 HP`);
    }
  }

  setSpeed(ms: number): void {
    this.speedMs = ms;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.state.phase = 'running';
    this.onStateUpdate(this.state);

    while (this.running && !this.state.gameOver) {
      await this.executeTurn();
      this.checkWinConditions();
      this.onStateUpdate(this.state);
      await this.delay(this.speedMs);
    }
  }

  pause(): void {
    this.running = false;
    this.state.phase = 'paused';
    this.onStateUpdate(this.state);
  }

  resume(): void {
    if (this.state.gameOver) return;
    this.start();
  }

  private async executeTurn(): Promise<void> {
    this.state.turn++;
    logger.info(`── Turn ${this.state.turn} ──`);

    // Phase 1: Resource gathering + depletion
    for (const agent of this.state.agents) {
      if (!agent.isAlive) continue;
      const gathered = this.resourceManager.gatherResources(this.state, agent);
      this.resourceManager.applyGatheredResources(agent, gathered);
    }
    this.resourceManager.regenerateResources(this.state);

    // Phase 2: Tick diplomacy timers
    for (const [key, rel] of Object.entries(this.state.diplomacy)) {
      if (rel.turnsRemaining > 0) {
        rel.turnsRemaining--;
        if (rel.turnsRemaining === 0 && (rel.type === 'peace' || rel.type === 'alliance')) {
          rel.type = 'neutral';
          logger.info(`Diplomacy expired: ${key} → neutral`);
        }
      }
    }

    // Phase 3: Get actions from all alive agents in parallel
    this.combatResolver.clearFortifications();
    const aliveAgents = this.state.agents.filter(a => a.isAlive);

    const actionSets = await Promise.all(
      aliveAgents.map(agent => this.agentManager.getActions(this.state, agent)),
    );

    // Phase 4: Sort by agility and execute
    const allActions: { agent: Agent; actions: Action[] }[] = aliveAgents.map((agent, i) => ({
      agent,
      actions: actionSets[i],
    }));
    allActions.sort((a, b) => b.agent.attributes.agility - a.agent.attributes.agility);

    for (const { agent, actions } of allActions) {
      for (const action of actions) {
        const result = this.executeAction(agent, action);
        this.state.turnLog.push({
          turn: this.state.turn,
          agentId: agent.id,
          agentName: agent.name,
          action,
          result: result.message,
          success: result.success,
        });
        // Grant XP
        if (result.success) {
          this.grantXP(agent, XP_REWARDS[action.type] || 1);
        }
        // Add to agent memory
        if (result.success && action.type !== 'gather') {
          agent.memory.push(`T${this.state.turn}: ${action.type} → ${result.message}`);
          if (agent.memory.length > 20) agent.memory.shift();
        }
      }
      // Track peak territory
      const territory = this.state.map.flat().filter(c => c.owner === agent.id).length;
      if (territory > agent.peakTerritory) agent.peakTerritory = territory;
    }

    // Phase 5: Food upkeep
    for (const agent of aliveAgents) {
      const upkeep = Math.ceil(agent.totalUnits * FOOD_PER_UNIT);
      agent.resources.food = Math.max(0, agent.resources.food - upkeep);
      if (agent.resources.food === 0 && agent.totalUnits > 3) {
        const lost = Math.max(1, Math.floor(agent.totalUnits * STARVATION_LOSS_PERCENT));
        agent.totalUnits -= lost;
        this.removeUnitsFromMap(agent.id, lost);
        agent.memory.push(`T${this.state.turn}: STARVATION! Lost ${lost} units`);
        logger.info(`${agent.name} lost ${lost} units to starvation`);
      }
    }

    // Trim turn log to last 200 entries to prevent unbounded growth
    if (this.state.turnLog.length > 200) {
      this.state.turnLog = this.state.turnLog.slice(-200);
    }
  }

  private executeAction(agent: Agent, action: Action): { success: boolean; message: string } {
    switch (action.type) {
      case 'gather':
        return { success: true, message: 'Gathered resources' };

      case 'build': {
        if (action.targetX == null || action.targetY == null || !action.buildingType) {
          return { success: false, message: 'Build missing target or type' };
        }
        const built = this.buildingManager.build(
          this.state, agent.id, action.targetX, action.targetY, action.buildingType,
        );
        return built
          ? { success: true, message: `Built ${action.buildingType} at (${action.targetX},${action.targetY})` }
          : { success: false, message: `Failed to build ${action.buildingType}` };
      }

      case 'train': {
        const capacity = this.resourceManager.getTrainingCapacity(this.state, agent.id);
        const count = Math.min(action.unitCount || capacity, capacity);
        if (!this.resourceManager.canAffordTraining(agent, count)) {
          return { success: false, message: 'Cannot afford training' };
        }
        this.resourceManager.payTrainingCost(agent, count);
        agent.totalUnits += count;
        this.placeUnits(agent.id, count);
        return { success: true, message: `Trained ${count} units` };
      }

      case 'clone': {
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
        this.placeUnits(agent.id, 5);
        return { success: true, message: `Cloned! (#${agent.cloneCount})` };
      }

      case 'move': {
        if (action.sourceX == null || action.sourceY == null || action.targetX == null || action.targetY == null) {
          return { success: false, message: 'Move missing coordinates' };
        }
        const src = this.state.map[action.sourceY]?.[action.sourceX];
        const tgt = this.state.map[action.targetY]?.[action.targetX];
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

      case 'attack': {
        if (action.sourceX == null || action.sourceY == null || action.targetX == null || action.targetY == null) {
          return { success: false, message: 'Attack missing coordinates' };
        }
        const aSrc = this.state.map[action.sourceY]?.[action.sourceX];
        const aTgt = this.state.map[action.targetY]?.[action.targetX];
        if (!aSrc || !aTgt) return { success: false, message: 'Invalid coordinates' };
        if (aSrc.owner !== agent.id) return { success: false, message: 'Source not owned' };
        if (aTgt.terrain === 'water') return { success: false, message: 'Cannot attack water' };

        const atkDist = Math.abs(action.targetX - action.sourceX) + Math.abs(action.targetY - action.sourceY);
        if (atkDist > 1) return { success: false, message: 'Only adjacent cells' };

        // Check diplomacy
        if (aTgt.owner) {
          const dipKey = getDiplomacyKey(agent.id, aTgt.owner);
          const rel = this.state.diplomacy[dipKey];
          if (rel && (rel.type === 'peace' || rel.type === 'alliance')) {
            // Breaking a treaty!
            rel.type = 'war';
            rel.turnsRemaining = 0;
            agent.reputation = Math.max(0, agent.reputation - BETRAYAL_REPUTATION_PENALTY);
            agent.memory.push(`T${this.state.turn}: BETRAYED ${aTgt.owner}! Reputation dropped.`);
            // All other agents learn about this betrayal
            for (const other of this.state.agents) {
              if (other.id !== agent.id && other.isAlive) {
                other.memory.push(`T${this.state.turn}: ${agent.name} BETRAYED a treaty with ${aTgt.owner}!`);
              }
            }
          }
        }

        const atkUnits = Math.min(action.unitCount || aSrc.units, aSrc.units);
        if (atkUnits <= 0) return { success: false, message: 'No units' };

        const defender = aTgt.owner ? this.state.agents.find(a => a.id === aTgt.owner) || null : null;
        const combatResult = this.combatResolver.resolve(
          this.state, agent, defender, aSrc, aTgt, atkUnits,
        );
        const msg = this.combatResolver.applyCombatResult(
          combatResult, agent, defender, aSrc, aTgt, atkUnits,
        );

        // Track battle stats
        if (msg.includes('conquered') || msg.includes('won')) {
          agent.battlesWon++;
          this.grantXP(agent, XP_REWARDS.win_battle);
          if (defender) defender.battlesLost++;
        } else if (msg.includes('repelled')) {
          agent.battlesLost++;
          if (defender) {
            defender.battlesWon++;
            this.grantXP(defender, XP_REWARDS.win_battle);
          }
        }

        if (defender && defender.totalUnits <= 0) {
          defender.isAlive = false;
          agent.kills++;
          this.grantXP(agent, XP_REWARDS.kill);
          logger.info(`${defender.name} eliminated!`);
          for (const other of this.state.agents) {
            if (other.isAlive) {
              other.memory.push(`T${this.state.turn}: ${defender.name} was eliminated by ${agent.name}!`);
            }
          }
        }

        return { success: true, message: msg };
      }

      case 'research': {
        if (!action.attribute) return { success: false, message: 'No attribute' };
        if (!this.resourceManager.canAffordResearch(agent)) {
          return { success: false, message: 'Cannot afford research' };
        }
        this.resourceManager.payResearchCost(agent);
        (agent.attributes as any)[action.attribute] += RESEARCH_BOOST;
        return { success: true, message: `Researched ${action.attribute} (+${RESEARCH_BOOST})` };
      }

      case 'fortify': {
        if (action.targetX == null || action.targetY == null) {
          return { success: false, message: 'Fortify missing target' };
        }
        const fCell = this.state.map[action.targetY]?.[action.targetX];
        if (!fCell || fCell.owner !== agent.id) {
          return { success: false, message: 'Cannot fortify unowned cell' };
        }
        this.combatResolver.fortify(action.targetX, action.targetY);
        return { success: true, message: `Fortified (${action.targetX},${action.targetY})` };
      }

      case 'propose_peace': {
        if (!action.targetAgentId) return { success: false, message: 'No target agent' };
        const target = this.state.agents.find(a => a.id === action.targetAgentId && a.isAlive);
        if (!target) return { success: false, message: 'Target not found' };

        const key = getDiplomacyKey(agent.id, target.id);
        const rel = this.state.diplomacy[key];
        if (!rel) return { success: false, message: 'Invalid relation' };
        if (rel.type === 'peace' || rel.type === 'alliance') {
          return { success: false, message: 'Already at peace' };
        }

        // Auto-accept based on target's charisma + proposer reputation
        const acceptChance = 0.3 + agent.reputation * 0.004 + agent.attributes.charisma * 0.01;
        if (Math.random() < acceptChance) {
          rel.type = 'peace';
          rel.turnsRemaining = PEACE_TREATY_DURATION;
          rel.proposedBy = agent.id;
          agent.treatiesMade++;
          target.treatiesMade++;
          agent.memory.push(`T${this.state.turn}: Peace treaty with ${target.name} accepted!`);
          target.memory.push(`T${this.state.turn}: Accepted peace with ${agent.name}`);
          return { success: true, message: `Peace with ${target.name}! (${PEACE_TREATY_DURATION} turns)` };
        }
        agent.memory.push(`T${this.state.turn}: ${target.name} rejected peace proposal`);
        return { success: false, message: `${target.name} rejected peace` };
      }

      case 'propose_alliance': {
        if (!action.targetAgentId) return { success: false, message: 'No target agent' };
        const allyTarget = this.state.agents.find(a => a.id === action.targetAgentId && a.isAlive);
        if (!allyTarget) return { success: false, message: 'Target not found' };

        const allyKey = getDiplomacyKey(agent.id, allyTarget.id);
        const allyRel = this.state.diplomacy[allyKey];
        if (!allyRel) return { success: false, message: 'Invalid relation' };
        if (allyRel.type === 'alliance') return { success: false, message: 'Already allied' };

        // Higher bar for alliance
        const allyChance = 0.15 + agent.reputation * 0.005 + agent.attributes.charisma * 0.015;
        if (Math.random() < allyChance) {
          allyRel.type = 'alliance';
          allyRel.turnsRemaining = ALLIANCE_DURATION;
          allyRel.proposedBy = agent.id;
          agent.treatiesMade++;
          allyTarget.treatiesMade++;
          agent.memory.push(`T${this.state.turn}: Alliance with ${allyTarget.name}!`);
          allyTarget.memory.push(`T${this.state.turn}: Allied with ${agent.name}`);
          return { success: true, message: `Allied with ${allyTarget.name}! (${ALLIANCE_DURATION} turns)` };
        }
        return { success: false, message: `${allyTarget.name} rejected alliance` };
      }

      case 'break_treaty': {
        if (!action.targetAgentId) return { success: false, message: 'No target agent' };
        const breakKey = getDiplomacyKey(agent.id, action.targetAgentId);
        const breakRel = this.state.diplomacy[breakKey];
        if (!breakRel || breakRel.type === 'neutral' || breakRel.type === 'war') {
          return { success: false, message: 'No treaty to break' };
        }
        breakRel.type = 'war';
        breakRel.turnsRemaining = 0;
        agent.reputation = Math.max(0, agent.reputation - BETRAYAL_REPUTATION_PENALTY);
        agent.treatiesBroken++;
        agent.memory.push(`T${this.state.turn}: Broke treaty with ${action.targetAgentId}`);
        return { success: true, message: `Broke treaty with ${action.targetAgentId}! Reputation -${BETRAYAL_REPUTATION_PENALTY}` };
      }

      default:
        return { success: false, message: `Unknown: ${action.type}` };
    }
  }

  private placeUnits(agentId: string, count: number): void {
    for (const row of this.state.map) {
      for (const cell of row) {
        if (cell.owner === agentId && cell.building?.type === 'barracks') {
          cell.units += count;
          return;
        }
      }
    }
    for (const row of this.state.map) {
      for (const cell of row) {
        if (cell.owner === agentId) {
          cell.units += count;
          return;
        }
      }
    }
  }

  private removeUnitsFromMap(agentId: string, count: number): void {
    let remaining = count;
    for (const row of this.state.map) {
      for (const cell of row) {
        if (cell.owner === agentId && cell.units > 0 && remaining > 0) {
          const remove = Math.min(cell.units, remaining);
          cell.units -= remove;
          remaining -= remove;
        }
      }
    }
  }

  private checkWinConditions(): void {
    const totalCells = MAP_WIDTH * MAP_HEIGHT;
    const waterCells = this.state.map.flat().filter(c => c.terrain === 'water').length;
    const landCells = totalCells - waterCells;

    for (const agent of this.state.agents) {
      if (!agent.isAlive) continue;
      const ownedCells = this.state.map.flat().filter(c => c.owner === agent.id).length;
      if (ownedCells >= landCells * WIN_TERRITORY_PERCENT) {
        this.endGame(agent.id, `${agent.name} controls ${Math.round(ownedCells / landCells * 100)}% of territory!`);
        return;
      }
    }

    const alive = this.state.agents.filter(a => a.isAlive);
    if (alive.length === 1) {
      this.endGame(alive[0].id, `${alive[0].name} eliminated all opponents!`);
      return;
    }
    if (alive.length === 0) {
      this.endGame('', 'All agents eliminated - draw!');
      return;
    }

    if (this.state.turn >= this.state.maxTurns) {
      const scores = alive.map(a => ({
        id: a.id, name: a.name, score: this.calculateScore(a),
      }));
      scores.sort((a, b) => b.score - a.score);
      this.endGame(scores[0].id, `Turn limit! ${scores[0].name} wins (score ${scores[0].score})`);
    }
  }

  private calculateScore(agent: Agent): number {
    const territory = this.state.map.flat().filter(c => c.owner === agent.id).length * 10;
    const resources =
      agent.resources.gold + agent.resources.food + agent.resources.wood +
      agent.resources.iron + agent.resources.knowledge;
    const buildings = this.state.map.flat().filter(c => c.owner === agent.id && c.building).length * 20;
    const units = agent.totalUnits * 5;
    return territory + resources + buildings + units;
  }

  private endGame(winnerId: string, reason: string): void {
    this.state.gameOver = true;
    this.state.winner = winnerId;
    this.state.phase = 'finished';
    this.running = false;
    logger.info(`Game Over: ${reason}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
