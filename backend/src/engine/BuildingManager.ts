import { GameState, BuildingType } from '../models/GameState.js';
import { ResourceManager } from './ResourceManager.js';

export class BuildingManager {
  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  canBuild(
    state: GameState,
    agentId: string,
    x: number,
    y: number,
    buildingType: BuildingType,
  ): { ok: boolean; reason?: string } {
    const cell = state.map[y]?.[x];
    if (!cell) return { ok: false, reason: 'Cell out of bounds' };
    if (cell.owner !== agentId) return { ok: false, reason: 'Cell not owned' };
    if (cell.building) return { ok: false, reason: 'Cell already has a building' };
    if (cell.terrain === 'water') return { ok: false, reason: 'Cannot build on water' };

    if (buildingType === 'mine' && cell.terrain !== 'mountains') {
      return { ok: false, reason: 'Mine requires mountains' };
    }
    if (buildingType === 'lumberMill' && !['forest', 'jungle'].includes(cell.terrain)) {
      return { ok: false, reason: 'Lumber mill requires forest or jungle' };
    }

    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return { ok: false, reason: 'Agent not found' };

    if (!this.resourceManager.canAffordBuilding(agent, buildingType)) {
      return { ok: false, reason: 'Insufficient resources' };
    }

    return { ok: true };
  }

  build(state: GameState, agentId: string, x: number, y: number, buildingType: BuildingType): boolean {
    const check = this.canBuild(state, agentId, x, y, buildingType);
    if (!check.ok) return false;

    const agent = state.agents.find(a => a.id === agentId)!;
    this.resourceManager.payBuildingCost(agent, buildingType);

    const engineeringBonus = 1 + agent.attributes.engineering * 0.02;
    const baseHp = buildingType === 'wall' ? 200 : 100;

    state.map[y][x].building = {
      type: buildingType,
      hp: Math.floor(baseHp * engineeringBonus),
      level: 1,
    };

    return true;
  }
}
