import { GameState, Agent, Action, TurnDecision, SKILL_DEFINITIONS, MapCell, AgentDNA, FearProfile, EmotionalState } from '../models/GameState.js';
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
      const name = AGENT_NAMES[i];
      const dna = this.generateInitialDNA(name, attrs);

      agents.push({
        id: name.toLowerCase(),
        name,
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
        dna,
        dnaLog: [],
        fear: {
          emotionalState: 'calm',
          fearLevel: 0,
          deathAwareness: 0,
          threatMultiplier: 1,
          lossStreak: 0,
          betrayalCount: 0,
          starvationTurns: 0,
        },
      });
    }
    return agents;
  }

  /** Generate initial DNA based on agent's attributes — creates emergent personality */
  private generateInitialDNA(name: string, attrs: typeof BASE_ATTRIBUTES): AgentDNA {
    // Find dominant attribute
    const sorted = [
      { key: 'strength', val: attrs.strength },
      { key: 'wisdom', val: attrs.wisdom },
      { key: 'engineering', val: attrs.engineering },
      { key: 'charisma', val: attrs.charisma },
      { key: 'agility', val: attrs.agility },
    ].sort((a, b) => b.val - a.val);

    const dominant = sorted[0].key;
    const secondary = sorted[1].key;

    const identities: Record<string, string> = {
      strength: `${name} is a born warrior-king who believes power is the only currency that matters.`,
      wisdom: `${name} is a scholar-ruler who sees knowledge as the foundation of lasting empires.`,
      engineering: `${name} is a master builder who knows that walls and farms win wars, not swords.`,
      charisma: `${name} is a silver-tongued diplomat who prefers alliances to bloodshed.`,
      agility: `${name} is a swift tactician who strikes fast and retreats before the enemy reacts.`,
    };

    const priorityMap: Record<string, string[]> = {
      strength: ['military', 'expansion', 'defense'],
      wisdom: ['knowledge', 'economy', 'diplomacy'],
      engineering: ['economy', 'defense', 'expansion'],
      charisma: ['diplomacy', 'trade', 'economy'],
      agility: ['expansion', 'military', 'trade'],
    };

    const doctrinePool: Record<string, string[]> = {
      strength: ['Strike first, negotiate later', 'Weakness invites conquest', 'Every border must be defended by force'],
      wisdom: ['Know your enemy before you act', 'Invest in libraries before barracks', 'A wise ruler avoids unnecessary wars'],
      engineering: ['Build before you fight', 'Every territory needs infrastructure', 'Fortify borders, starve the enemy'],
      charisma: ['An ally is worth more than a captured city', 'Trade builds wealth, war destroys it', 'Reputation is your greatest asset'],
      agility: ['Speed wins battles', 'Never stay in one place too long', 'Expand fast, consolidate later'],
    };

    const styles: Record<string, string> = {
      strength: 'aggressive and direct',
      wisdom: 'analytical and cautious',
      engineering: 'methodical and patient',
      charisma: 'persuasive and opportunistic',
      agility: 'bold and unpredictable',
    };

    // Mix dominant + secondary doctrines
    const doctrines = [
      doctrinePool[dominant][0],
      doctrinePool[secondary][Math.floor(Math.random() * doctrinePool[secondary].length)],
    ];

    return {
      version: 1,
      identity: identities[dominant],
      priorities: priorityMap[dominant],
      doctrine: doctrines,
      nonNegotiables: [
        'I follow the game rules — I only choose from available actions',
        'I always cite concrete facts in my reasoning',
        'I acknowledge my failures and adapt',
      ],
      style: styles[dominant],
      trauma: [],
    };
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

    // Phase 2.5: Compute fear/emotional state for each agent
    const ownerCacheForFear = this.buildOwnershipCache();
    for (const agent of this.state.agents) {
      if (!agent.isAlive) continue;
      this.computeFear(agent, ownerCacheForFear);
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
            if (defender) {
              defender.battlesLost++;
              if (defender.battlesLost >= 3) {
                this.addTrauma(defender, `T${this.state.turn}: Suffered ${defender.battlesLost} defeats — my army is weakening`);
              }
            }
          } else if (result.message.includes('Defeat') || result.message.includes('Stalemate')) {
            agent.battlesLost++;
            if (agent.battlesLost >= 3) {
              this.addTrauma(agent, `T${this.state.turn}: Lost ${agent.battlesLost} battles — need to rethink strategy`);
            }
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
              // DNA trauma: killer gets confidence, everyone remembers
              this.addTrauma(agent, `T${this.state.turn}: Eliminated ${a.name} — proved my dominance`);
              for (const other of this.state.agents) {
                if (other.isAlive) {
                  other.memory.push(`T${this.state.turn}: ${a.name} was eliminated by ${agent.name}!`);
                  this.addTrauma(other, `T${this.state.turn}: Witnessed ${agent.name} destroy ${a.name}`);
                }
              }
            }
          }
        }

        // DNA trauma for betrayals + fear tracking
        if (action.type === 'break_treaty' && result.success && action.targetAgentId) {
          this.addTrauma(agent, `T${this.state.turn}: I broke my treaty with ${action.targetAgentId} — this changes who I am`);
          const victim = this.state.agents.find(a => a.id === action.targetAgentId);
          if (victim?.isAlive) {
            victim.fear.betrayalCount++;
            this.addTrauma(victim, `T${this.state.turn}: ${agent.name} betrayed our treaty — I will never forget this`);
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
        if (lost >= 3) this.addTrauma(agent, `T${this.state.turn}: Starvation killed ${lost} of my people — I must secure food`);
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

  /** Compute fear level and emotional state based on game situation */
  private computeFear(agent: Agent, ownerCache: Map<string, MapCell[]>): void {
    const myTerritory = (ownerCache.get(agent.id) || []).length;
    const myUnits = agent.totalUnits;

    // Death awareness: how close to elimination
    const territoryDanger = myTerritory <= 2 ? 80 : myTerritory <= 5 ? 50 : myTerritory <= 10 ? 20 : 0;
    const unitDanger = myUnits <= 3 ? 70 : myUnits <= 6 ? 40 : myUnits <= 10 ? 15 : 0;
    agent.fear.deathAwareness = Math.min(100, Math.max(territoryDanger, unitDanger));

    // Threat multiplier: ratio of nearby enemy strength vs ours
    let nearbyEnemyUnits = 0;
    const myCells = ownerCache.get(agent.id) || [];
    const myCellSet = new Set(myCells.map(c => `${c.x},${c.y}`));
    const h = this.state.map.length;
    const w = this.state.map[0]?.length || 0;

    for (const cell of myCells) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cell.x + dx, ny = cell.y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const neighbor = this.state.map[ny][nx];
        if (neighbor.owner && neighbor.owner !== agent.id && neighbor.units > 0) {
          nearbyEnemyUnits += neighbor.units;
        }
      }
    }
    agent.fear.threatMultiplier = myUnits > 0 ? nearbyEnemyUnits / myUnits : 10;

    // Starvation tracking
    if (agent.resources.food === 0 && myUnits > 3) {
      agent.fear.starvationTurns++;
    } else {
      agent.fear.starvationTurns = Math.max(0, agent.fear.starvationTurns - 1);
    }

    // Loss streak: check if we lost territory since last turn
    if (myTerritory < agent.peakTerritory * 0.7) {
      agent.fear.lossStreak = Math.min(agent.fear.lossStreak + 1, 10);
    } else {
      agent.fear.lossStreak = Math.max(0, agent.fear.lossStreak - 1);
    }

    // Compute overall fear level (0-100)
    let fear = 0;
    fear += agent.fear.deathAwareness * 0.35;
    fear += Math.min(100, agent.fear.threatMultiplier * 25) * 0.25;
    fear += agent.fear.lossStreak * 8;
    fear += agent.fear.starvationTurns * 12;
    fear += agent.fear.betrayalCount * 8;
    agent.fear.fearLevel = Math.min(100, Math.max(0, Math.round(fear)));

    // Determine emotional state
    let state: EmotionalState;
    if (agent.fear.fearLevel >= 75) state = 'desperate';
    else if (agent.fear.fearLevel >= 50) state = 'threatened';
    else if (agent.fear.fearLevel >= 25) state = 'cautious';
    else if (agent.fear.fearLevel <= 5 && myTerritory > 15) state = 'confident';
    else state = 'calm';

    // State change triggers trauma
    if (agent.fear.emotionalState !== state) {
      if (state === 'desperate' && agent.fear.emotionalState !== 'desperate') {
        this.addTrauma(agent, `T${this.state.turn}: DESPERATE — on the verge of destruction, everything I built is crumbling`);
      } else if (state === 'threatened' && agent.fear.emotionalState === 'calm') {
        this.addTrauma(agent, `T${this.state.turn}: Enemies closing in — I feel the walls tightening`);
      }
      agent.fear.emotionalState = state;
    }
  }

  /** Add a defining moment to an agent's DNA trauma list */
  private addTrauma(agent: Agent, event: string): void {
    agent.dna.trauma.push(event);
    if (agent.dna.trauma.length > 5) agent.dna.trauma.shift();
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
