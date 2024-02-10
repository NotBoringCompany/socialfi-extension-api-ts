import { BitRarity } from '../../models/bit';

/**
 * Gets the Bit's rarity based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
export const RANDOMIZE_RARITY_FROM_ORB = (): BitRarity => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 76:
            return BitRarity.COMMON; // 75% chance
        case rand < 96:
            return BitRarity.UNCOMMON; // 20% chance
        default:
            return BitRarity.RARE; // 5% chance
    }
}