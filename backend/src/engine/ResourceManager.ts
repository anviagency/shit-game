import { GameState, Agent, Resources } from '../models/GameState.js';
import {
  TERRAIN_RESOURCE_YIELD,
  BUILDING_PRODUCTION,
  BUILDING_COSTS,
  TRAIN_COST,
  TRAIN_PER_BARRACKS,
  RESEARCH_COST,
  CLONE_BASE_GOLD,
  CLONE_BASE_FOOD,
  GATHER_DRAIN_RATE,
  REGEN_RATE,
  DEPLETED_THRESHOLD,
} from '../utils/constants.js';

export class ResourceManager {
  /** Gather resources from all owned territory, applying depletion */
  gatherResources(state: GameState, agent: Agent): Resources {
    const gained: Resources = { gold: 0, food: 0, wood: 0, iron: 0, knowledge: 0 };
    const wisdomBonus = 1 + agent.attributes.wisdom * 0.01;

    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner !== agent.id) continue;

        // Terrain base resources (affected by depletion)
        const richnessMult = cell.richness / 100;
        if (cell.richness >= DEPLETED_THRESHOLD) {
          const terrainYield = TERRAIN_RESOURCE_YIELD[cell.terrain] || {};
          for (const [res, amount] of Object.entries(terrainYield)) {
            (gained as any)[res] += Math.floor(amount * wisdomBonus * richnessMult);
          }
          // Drain richness
          cell.richness = Math.max(0, cell.richness - GATHER_DRAIN_RATE);
        }

        // Building production (not affected by depletion)
        if (cell.building) {
          const production = BUILDING_PRODUCTION[cell.building.type];
          if (production) {
            for (const [res, amount] of Object.entries(production)) {
              (gained as any)[res] += Math.floor(amount * wisdomBonus);
            }
          }
        }
      }
    }

    return gained;
  }

  /** Regenerate richness on unowned / ungathered cells */
  regenerateResources(state: GameState): void {
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.terrain === 'water') continue;
        // Unowned cells regenerate faster
        const rate = cell.owner ? REGEN_RATE : REGEN_RATE * 2;
        if (cell.richness < 100) {
          cell.richness = Math.min(100, cell.richness + rate);
        }
      }
    }
  }

  applyGatheredResources(agent: Agent, gained: Resources): void {
    agent.resources.gold += gained.gold;
    agent.resources.food += gained.food;
    agent.resources.wood += gained.wood;
    agent.resources.iron += gained.iron;
    agent.resources.knowledge += gained.knowledge;
  }

  canAffordBuilding(agent: Agent, buildingType: string): boolean {
    const cost = BUILDING_COSTS[buildingType];
    if (!cost) return false;
    return (
      agent.resources.gold >= cost.gold &&
      agent.resources.wood >= cost.wood &&
      agent.resources.iron >= cost.iron
    );
  }

  payBuildingCost(agent: Agent, buildingType: string): void {
    const cost = BUILDING_COSTS[buildingType];
    agent.resources.gold -= cost.gold;
    agent.resources.wood -= cost.wood;
    agent.resources.iron -= cost.iron;
  }

  canAffordTraining(agent: Agent, count: number): boolean {
    return (
      agent.resources.gold >= TRAIN_COST.gold * count &&
      agent.resources.food >= TRAIN_COST.food * count
    );
  }

  payTrainingCost(agent: Agent, count: number): void {
    agent.resources.gold -= TRAIN_COST.gold * count;
    agent.resources.food -= TRAIN_COST.food * count;
  }

  getTrainingCapacity(state: GameState, agentId: string): number {
    let barracksCount = 0;
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner === agentId && cell.building?.type === 'barracks') {
          barracksCount++;
        }
      }
    }
    return Math.max(1, barracksCount * TRAIN_PER_BARRACKS);
  }

  canAffordResearch(agent: Agent): boolean {
    return (
      agent.resources.knowledge >= RESEARCH_COST.knowledge &&
      agent.resources.gold >= RESEARCH_COST.gold
    );
  }

  payResearchCost(agent: Agent): void {
    agent.resources.knowledge -= RESEARCH_COST.knowledge;
    agent.resources.gold -= RESEARCH_COST.gold;
  }

  canAffordClone(agent: Agent): boolean {
    const charismaDiscount = 1 - agent.attributes.charisma * 0.01;
    const goldCost = Math.floor(CLONE_BASE_GOLD * charismaDiscount);
    const foodCost = Math.floor(CLONE_BASE_FOOD * charismaDiscount);
    return agent.resources.gold >= goldCost && agent.resources.food >= foodCost;
  }

  payCloneCost(agent: Agent): void {
    const charismaDiscount = 1 - agent.attributes.charisma * 0.01;
    agent.resources.gold -= Math.floor(CLONE_BASE_GOLD * charismaDiscount);
    agent.resources.food -= Math.floor(CLONE_BASE_FOOD * charismaDiscount);
  }
}
