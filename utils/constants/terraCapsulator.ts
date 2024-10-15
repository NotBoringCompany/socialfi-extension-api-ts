import { IslandType } from '../../models/island';
import { TerraCapsulatorType } from '../../models/item';

/**
 * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 1000
 * and the Terra Capsulator type.
 */
export const randomizeTypeFromCapsulator = (type: TerraCapsulatorType): IslandType => {
    const rand = Math.floor(Math.random() * 1000) + 1;  // Random number between 1 and 1000

    if (type === TerraCapsulatorType.TERRA_CAPSULATOR_I) {
        // TERRA_CAPSULATOR_I isn't possible to yield CRYSTAL_ISLES & CELESTIAL_ISLES
        if (rand <= 650) {  // 65% chance (1 - 650)
            return IslandType.PRIMAL_ISLES;
        } else if (rand <= 900) {  // 25% chance (651 - 900)
            return IslandType.VERDANT_ISLES;
        } else {  // 10% chance (901 - 1000)
            return IslandType.EXOTIC_ISLES;
        }
    } else if (type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
        // TERRA_CAPSULATOR_II isn't possible to yield PRIMAL_ISLES
        if (rand <= 150) { // 15% chance (1 - 150)
            return IslandType.VERDANT_ISLES;
        } else if (rand <= 850) { // 70% chance (151 - 850)
            return IslandType.EXOTIC_ISLES;
        } else if (rand <= 950) { // 10% chance (851 - 950)
            return IslandType.CRYSTAL_ISLES;
        } else { // 5% chance (951 - 1000)
            return IslandType.CELESTIAL_ISLES;
        }
    } else {
        throw new Error('Invalid Terra Capsulator type');
    }
}