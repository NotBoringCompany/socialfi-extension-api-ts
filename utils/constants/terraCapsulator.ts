import { IslandType } from '../../models/island';

/**
 * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
export const RANDOMIZE_TYPE_FROM_CAPSULATOR = (): IslandType => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 76:
            return IslandType.PRIMAL_ISLES; // 75% chance
        case rand < 96:
            return IslandType.VERDANT_ISLES; // 20% chance
        default:
            return IslandType.EXOTIC_ISLES; // 5% chance
    }
}