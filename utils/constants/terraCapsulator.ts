import { IslandType } from '../../models/island';
import { TerraCapsulatorType } from '../../models/terraCapsulator';

/**
 * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 * and the Terra Capsulator type.
 */
export const randomizeTypeFromCapsulator = (type: TerraCapsulatorType): IslandType => {
    const rand = Math.floor(Math.random() * 1000) + 1;

    if (type === TerraCapsulatorType.TERRA_CAPSULATOR_I) {
        if (rand <= 300) {
            return IslandType.PRIMAL_ISLES;
        } else if (rand <= 800) {
            return IslandType.VERDANT_ISLES;
        } else if (rand <= 950) {
            return IslandType.EXOTIC_ISLES;
        } else if (rand <= 996) {
            return IslandType.CRYSTAL_ISLES;
        } else {
            return IslandType.CELESTIAL_ISLES;
        }
    } else if (type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
        if (rand <= 300) {
            return IslandType.VERDANT_ISLES;
        } else if (rand <= 800) {
            return IslandType.EXOTIC_ISLES;
        } else if (rand <= 950) {
            return IslandType.CRYSTAL_ISLES;
        } else {
            return IslandType.CELESTIAL_ISLES;
        }
    } else {
        throw new Error('Invalid Terra Capsulator type');
    }
}