import { BitGender, BitRarity } from '../../models/bit';

/**
 * Randomizes a Bit's gender. 
 */
export const RANDOMIZE_GENDER = (): BitGender => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 51:
            return BitGender.MALE; // 50% chance
        default:
            return BitGender.FEMALE; // 50% chance
    }
}

/**
 * Gets the base gathering rate (in % of total resources/hour) for a Bit based on its rarity.
 */
export const BASE_GATHERING_RATE = (rarity: BitRarity) => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.02;
        case BitRarity.UNCOMMON:
            return 0.025;
        case BitRarity.RARE:
            return 0.031;
        case BitRarity.EPIC:
            return 0.039;
        case BitRarity.LEGENDARY:
            return 0.05;
        default:
            throw new Error(`(BASE_GATHERING_RATE) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the gathering rate growth (fixed increase in % of total resources/hour for every level increase) for a Bit based on its rarity.
 */
export const GATHERING_RATE_GROWTH = (rarity: BitRarity) => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.0002;
        case BitRarity.UNCOMMON:
            return 0.00025;
        case BitRarity.RARE:
            return 0.00033;
        case BitRarity.EPIC:
            return 0.00045;
        case BitRarity.LEGENDARY:
            return 0.0006;
        default:
            throw new Error(`(BASE_GATHERING_RATE_GROWTH) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the base earning rate (in % of total cookies spent/hour) for a Bit based on its rarity.
 */
export const BASE_EARNING_RATE = (rarity: BitRarity) => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.03;
        case BitRarity.UNCOMMON:
            return 0.036;
        case BitRarity.RARE:
            return 0.044;
        case BitRarity.EPIC:
            return 0.055;
        case BitRarity.LEGENDARY:
            return 0.07;
        default:
            throw new Error(`(BASE_EARNING_RATE) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the earning rate growth (fixed increase in % of total cookies spent/hour for every level increase) for a Bit based on its rarity.
 */
export const EARNING_RATE_GROWTH = (rarity: BitRarity) => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.00025;
        case BitRarity.UNCOMMON:
            return 0.00032;
        case BitRarity.RARE:
            return 0.0004;
        case BitRarity.EPIC:
            return 0.0005;
        case BitRarity.LEGENDARY:
            return 0.00065;
        default:
            throw new Error(`(EARNING_RATE_GROWTH) Invalid rarity: ${rarity}`);
    }
}

/** base energy depletion rate of bits in % of energy bar/hour (regardless of rarity). actual energy depletion rate will be +-25% of this value. */
export const BASE_ENERGY_DEPLETION_RATE = 5;