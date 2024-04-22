import { BitRarity } from '../../models/bit';
import { BitOrbType } from '../../models/bitOrb';

/**
 * Gets the Bit's rarity based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
export const RANDOMIZE_RARITY_FROM_ORB = (type: BitOrbType): BitRarity => {
    const rand = Math.floor(Math.random() * 1000) + 1;

    if (type === BitOrbType.BIT_ORB_I) {
        if (rand <= 750) {
            return BitRarity.COMMON;
        } else if (rand <= 950) {
            return BitRarity.UNCOMMON;
        } else {
            return BitRarity.RARE;
        }
    } else if (type === BitOrbType.BIT_ORB_II) {
        if (rand <= 450) {
            return BitRarity.COMMON;
        } else if (rand <= 850) {
            return BitRarity.UNCOMMON;
        } else if (rand <= 985) {
            return BitRarity.RARE;
        } else {
            return BitRarity.EPIC;
        }
    } else if (type === BitOrbType.BIT_ORB_III) {
        if (rand <= 350) {
            return BitRarity.UNCOMMON;
        } else if (rand <= 850) {
            return BitRarity.RARE;
        } else if (rand <= 985) {
            return BitRarity.EPIC;
        } else {
            return BitRarity.LEGENDARY;
        }
    }
}