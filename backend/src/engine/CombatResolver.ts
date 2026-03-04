import { GameState, Agent, MapCell } from '../models/GameState.js';
import {
  TERRAIN_ATTACK_MOD,
  TERRAIN_DEFENSE_MOD,
  WALL_DEFENSE_BONUS,
  FORTIFY_DEFENSE_BONUS,
} from '../utils/constants.js';

interface CombatResult {
  attackerWins: boolean;
  decisive: boolean;
  attackerLosses: number;
  defenderLosses: number;
}

export class CombatResolver {
  private fortifiedCells = new Set<string>();

  fortify(x: number, y: number): void {
    this.fortifiedCells.add(`${x},${y}`);
  }

  clearFortifications(): void {
    this.fortifiedCells.clear();
  }

  resolve(
    _state: GameState,
    attackerAgent: Agent,
    defenderAgent: Agent | null,
    _sourceCell: MapCell,
    targetCell: MapCell,
    attackingUnits: number,
  ): CombatResult {
    const defenderUnits = targetCell.units;

    const weaponBonus = 1 + attackerAgent.attributes.strength * 0.05;
    const terrainAttackMod = TERRAIN_ATTACK_MOD[targetCell.terrain] || 0;
    const wisdomAttackBonus = attackerAgent.attributes.wisdom * 0.03;
    const attackPower =
      attackingUnits * attackerAgent.attributes.strength * weaponBonus +
      terrainAttackMod + attackingUnits * wisdomAttackBonus;

    const defStrength = defenderAgent ? defenderAgent.attributes.strength : 8;
    const defWisdom = defenderAgent ? defenderAgent.attributes.wisdom : 5;
    const wallBonus = targetCell.building?.type === 'wall' ? WALL_DEFENSE_BONUS : 0;
    const fortifyBonus = this.fortifiedCells.has(`${targetCell.x},${targetCell.y}`)
      ? FORTIFY_DEFENSE_BONUS : 0;
    const terrainDefMod = TERRAIN_DEFENSE_MOD[targetCell.terrain] || 0;
    const wisdomDefBonus = defWisdom * 0.03;
    const defensePower =
      defenderUnits * defStrength * (1 + defStrength * 0.05) +
      wallBonus + fortifyBonus + terrainDefMod + defenderUnits * wisdomDefBonus;

    const defenderAgility = defenderAgent ? defenderAgent.attributes.agility : 5;
    const attackerAgility = attackerAgent.attributes.agility;

    let attackerLosses: number, defenderLosses: number, attackerWins: boolean, decisive: boolean;

    if (attackPower > defensePower * 1.2) {
      attackerWins = true; decisive = true;
      defenderLosses = defenderUnits;
      attackerLosses = Math.max(1, Math.floor(attackingUnits * 0.1 * (1 - defenderAgility * 0.02)));
    } else if (attackPower > defensePower) {
      attackerWins = true; decisive = false;
      defenderLosses = defenderUnits;
      attackerLosses = Math.max(1, Math.floor(attackingUnits * 0.4 * (1 - defenderAgility * 0.02)));
    } else if (defensePower > attackPower * 1.2) {
      attackerWins = false; decisive = true;
      attackerLosses = Math.floor(attackingUnits * 0.8);
      defenderLosses = Math.max(1, Math.floor(defenderUnits * 0.1 * (1 - attackerAgility * 0.02)));
    } else {
      attackerWins = false; decisive = false;
      attackerLosses = Math.floor(attackingUnits * 0.5);
      defenderLosses = Math.floor(defenderUnits * 0.3);
    }

    return { attackerWins, decisive, attackerLosses, defenderLosses };
  }

  applyCombatResult(
    result: CombatResult,
    attackerAgent: Agent,
    defenderAgent: Agent | null,
    sourceCell: MapCell,
    targetCell: MapCell,
    attackingUnits: number,
  ): string {
    const survivingAttackers = attackingUnits - result.attackerLosses;

    sourceCell.units -= attackingUnits;
    attackerAgent.totalUnits -= result.attackerLosses;

    if (result.attackerWins) {
      targetCell.owner = attackerAgent.id;
      targetCell.units = survivingAttackers;
      if (defenderAgent) defenderAgent.totalUnits -= result.defenderLosses;
      if (targetCell.building && targetCell.building.type !== 'wall') targetCell.building = null;
      return result.decisive
        ? `Decisive victory! -${result.attackerLosses} atk, -${result.defenderLosses} def`
        : `Narrow victory! -${result.attackerLosses} atk, -${result.defenderLosses} def`;
    } else {
      targetCell.units = Math.max(0, targetCell.units - result.defenderLosses);
      if (defenderAgent) defenderAgent.totalUnits -= result.defenderLosses;
      sourceCell.units += survivingAttackers;
      return result.decisive
        ? `Defeat! -${result.attackerLosses} atk`
        : `Stalemate! -${result.attackerLosses} atk, -${result.defenderLosses} def`;
    }
  }
}
