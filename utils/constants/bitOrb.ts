import { BitRarity } from '../../models/bit';

/**
 * Gets the Bit's rarity based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
export const BIT_ORB_PROBABILITY = (rand: number): BitRarity => {
    switch (true) {
        case rand < 76:
            return BitRarity.COMMON; // 75% chance
        case rand < 96:
            return BitRarity.UNCOMMON; // 20% chance
        case rand < 101:
            return BitRarity.RARE; // 5% chance
        default:
            throw new Error(`(BIT_ORB_PROBABILITY) Invalid rand: ${rand}`);
    }
}