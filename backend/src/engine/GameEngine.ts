import { GameState, Agent, Action, TurnDecision, SKILL_DEFINITIONS, MapCell } from '../models/GameState.js';
import { generateMap } from './MapGenerator.js';
import { ResourceManager } from './ResourceManager.js';
import { BuildingManager } from './BuildingManager.js';
import { CombatResolver } from './CombatResolver.js';
import { ActionExecutor } from './ActionExecutor.js';
import { DiplomacyManager } from './DiplomacyManager.js';
import { AgentManager } from '../agents/AgentManager.js';
import {
  BASE_ATTRIBUTES,
  BASE_RESOURCES,
  BASE_UNITS,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_TURNS,
  WIN_TERRITORY_PERCENT,
  BONUS_ATTRIBUTE_POINTS,
  AGENT_NAMES,
  AGENT_COLORS,
  MAX_CLONES,
  FOOD_PER_UNIT,
  STARVATION_LOSS_PERCENT,
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

export class GameEngine {
  private state: GameState;
  private resourceManager: ResourceManager;
  private combatResolver: CombatResolver;
  private actionExecutor: ActionExecutor;
  private diplomacyManager: DiplomacyManager;
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
    this.combatResolver = new CombatResolver();
    this.diplomacyManager = new DiplomacyManager();
    this.actionExecutor = new ActionExecutor(
      this.resourceManager,
      new BuildingManager(this.resourceManager),
      this.combatResolver,
      this.diplomacyManager,
    );
    this.agentManager = agentManager;
    this.onStateUpdate = onStateUpdate;
    this.speedMs = speedMs;

    const agents = this.createAgents();
    const map = generateMap(agents.map(a => a.id));

    this.state = {
      map,
      agents,
      turn: 0,
      maxTurns: MAX_TURNS,
      turnLog: [],
      gameOver: false,
      winner: null,
      phase: 'waiting',
      diplomacy: this.diplomacyManager.initializeDiplomacy(agents),
    };
  }

  private createAgents(): Agent[] {
    const agents: Agent[] = [];
    for (let i = 0; i < 10; i++) {
      const attrs = { ...BASE_ATTRIBUTES };
      let points = BONUS_ATTRIBUTE_POINTS;
      const attrKeys = ['strength', 'wisdom', 'agility', 'engineering', 'charisma'] as const;
      while (points > 0) {
        const key = attrKeys[Math.floor(Math.random() * attrKeys.length)];
        const add = Math.min(points, Math.floor(Math.random() * 4) + 1);
        (attrs as any)[key] += add;
        points -= add;
      }

      const provider = i % 2 === 0 ? 'openai' : 'anthropic';

      agents.push({
        id: AGENT_NAMES[i].toLowerCase(),
        name: AGENT_NAMES[i],
        color: AGENT_COLORS[i],
        personality: '',
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
        skills: SKILL_DEFINITIONS.map(s => ({ id: s.id, level: 0, unlockedAtTurn: 0 })),
        skillPoints: 1,
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

  /** Build a cache of owned cells per agent — avoids repeated map.flat().filter() */
  private buildOwnershipCache(): Map<string, MapCell[]> {
    const cache = new Map<string, MapCell[]>();
    for (const row of this.state.map) {
      for (const cell of row) {
        if (cell.owner) {
          let arr = cache.get(cell.owner);
          if (!arr) { arr = []; cache.set(cell.owner, arr); }
          arr.push(cell);
        }
      }
    }
    return cache;
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
    this.diplomacyManager.tickTimers(this.state.diplomacy);

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
        const result = this.actionExecutor.execute(this.state, agent, action);
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

        // Track battle stats from attack results
        if (action.type === 'attack' && result.success) {
          if (result.message.includes('victory')) {
            agent.battlesWon++;
            this.grantXP(agent, XP_REWARDS.win_battle);
            const defender = this.findDefender(action);
            if (defender) defender.battlesLost++;
          } else if (result.message.includes('Defeat') || result.message.includes('Stalemate')) {
            agent.battlesLost++;
            const defender = this.findDefender(action);
            if (defender) {
              defender.battlesWon++;
              this.grantXP(defender, XP_REWARDS.win_battle);
            }
          }
          // Check eliminations
          for (const a of this.state.agents) {
            if (a.isAlive && a.totalUnits <= 0 && a.id !== agent.id) {
              a.isAlive = false;
              agent.kills++;
              this.grantXP(agent, XP_REWARDS.kill);
              logger.info(`${a.name} eliminated!`);
              for (const other of this.state.agents) {
                if (other.isAlive) {
                  other.memory.push(`T${this.state.turn}: ${a.name} was eliminated by ${agent.name}!`);
                }
              }
            }
          }
        }

        // Add to agent memory
        if (result.success && action.type !== 'gather') {
          agent.memory.push(`T${this.state.turn}: ${action.type} → ${result.message}`);
          if (agent.memory.length > 20) agent.memory.shift();
        }
      }

      // Track peak territory using cache
      const ownerCache = this.buildOwnershipCache();
      const territory = (ownerCache.get(agent.id) || []).length;
      if (territory > agent.peakTerritory) agent.peakTerritory = territory;
    }

    // Phase 5: Food upkeep
    for (const agent of aliveAgents) {
      const upkeep = Math.ceil(agent.totalUnits * FOOD_PER_UNIT);
      agent.resources.food = Math.max(0, agent.resources.food - upkeep);
      if (agent.resources.food === 0 && agent.totalUnits > 3) {
        const lost = Math.max(1, Math.floor(agent.totalUnits * STARVATION_LOSS_PERCENT));
        agent.totalUnits -= lost;
        this.actionExecutor.removeUnitsFromMap(this.state, agent.id, lost);
        agent.memory.push(`T${this.state.turn}: STARVATION! Lost ${lost} units`);
        logger.info(`${agent.name} lost ${lost} units to starvation`);
      }
    }

    // Trim turn log
    if (this.state.turnLog.length > 200) {
      this.state.turnLog = this.state.turnLog.slice(-200);
    }
  }

  private findDefender(action: Action): Agent | null {
    if (action.targetX == null || action.targetY == null) return null;
    const cell = this.state.map[action.targetY]?.[action.targetX];
    if (!cell?.owner) return null;
    return this.state.agents.find(a => a.id === cell.owner) || null;
  }

  private grantXP(agent: Agent, amount: number): void {
    const quickStudy = agent.skills.find(s => s.id === 'quickStudy');
    if (quickStudy && quickStudy.level > 0) {
      amount = Math.floor(amount * (1 + quickStudy.level * 0.25));
    }

    agent.xp += amount;
    while (agent.xp >= xpForLevel(agent.level)) {
      agent.xp -= xpForLevel(agent.level);
      agent.level++;
      agent.skillPoints++;
      const keys = ['strength', 'wisdom', 'agility', 'engineering', 'charisma'] as const;
      const key = keys[Math.floor(Math.random() * keys.length)];
      (agent.attributes as any)[key] += 1;
      agent.attributes.hp += 5;
      logger.info(`${agent.name} leveled up to ${agent.level}! +1 ${key}, +5 HP, +1 skill point`);
    }

    this.autoSpendSkillPoints(agent);
  }

  private autoSpendSkillPoints(agent: Agent): void {
    while (agent.skillPoints > 0) {
      const upgradeable = SKILL_DEFINITIONS.filter(def => {
        const skill = agent.skills.find(s => s.id === def.id);
        if (!skill || skill.level >= def.maxLevel) return false;
        if (def.requires) {
          const prereq = agent.skills.find(s => s.id === def.requires);
          if (!prereq || prereq.level === 0) return false;
        }
        return true;
      });

      if (upgradeable.length === 0) break;

      const weights: Record<string, number> = {
        military: agent.attributes.strength,
        economy: agent.attributes.engineering,
        diplomacy: agent.attributes.charisma,
        knowledge: agent.attributes.wisdom,
      };

      const weighted = upgradeable.map(s => ({
        skill: s,
        weight: weights[s.category] || 8,
      }));
      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
      let roll = Math.random() * totalWeight;
      let chosen = weighted[0].skill;
      for (const w of weighted) {
        roll -= w.weight;
        if (roll <= 0) { chosen = w.skill; break; }
      }

      const skill = agent.skills.find(s => s.id === chosen.id)!;
      skill.level++;
      skill.unlockedAtTurn = this.state.turn;
      agent.skillPoints--;
      agent.memory.push(`T${this.state.turn}: Learned ${chosen.name} (Lv${skill.level})`);
      logger.info(`${agent.name} learned ${chosen.name} Lv${skill.level}`);
    }
  }

  private checkWinConditions(): void {
    const ownerCache = this.buildOwnershipCache();

    let waterCells = 0;
    for (const row of this.state.map) {
      for (const cell of row) {
        if (cell.terrain === 'water') waterCells++;
      }
    }
    const landCells = MAP_WIDTH * MAP_HEIGHT - waterCells;

    for (const agent of this.state.agents) {
      if (!agent.isAlive) continue;
      const ownedCount = (ownerCache.get(agent.id) || []).length;
      if (ownedCount >= landCells * WIN_TERRITORY_PERCENT) {
        this.endGame(agent.id, `${agent.name} controls ${Math.round(ownedCount / landCells * 100)}% of territory!`);
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
        id: a.id, name: a.name, score: this.calculateScore(a, ownerCache),
      }));
      scores.sort((a, b) => b.score - a.score);
      this.endGame(scores[0].id, `Turn limit! ${scores[0].name} wins (score ${scores[0].score})`);
    }
  }

  private calculateScore(agent: Agent, ownerCache: Map<string, MapCell[]>): number {
    const owned = ownerCache.get(agent.id) || [];
    const territory = owned.length * 10;
    const resources =
      agent.resources.gold + agent.resources.food + agent.resources.wood +
      agent.resources.iron + agent.resources.knowledge;
    const buildings = owned.filter(c => c.building).length * 20;
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
