import { BitGender, BitRarity, EnergyThresholdReduction } from '../../models/bit';

/** gets the max level for a bit given their rarity */
export const MAX_BIT_LEVEL = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 20;
        case BitRarity.UNCOMMON:
            return 30;
        case BitRarity.RARE:
            return 40;
        case BitRarity.EPIC:
            return 50;
        case BitRarity.LEGENDARY:
            return 65;
    }
}

/** regardless of rarity, the max level bits can be in a raft is 30 */
export const MAX_BIT_LEVEL_RAFT = 30;

/** gets the cost (in xCookies) of evolving a bit, based on its current level */
export const BIT_EVOLVING_COST = (currentLevel: number): number => {
    // level once upgraded = 2 to 9
    if (currentLevel >= 1 && currentLevel <= 8) {
        return 30;
    // level once upgraded = 10 to 19
    } else if (currentLevel >= 9 && currentLevel <= 18) {
        return 60; // 2x of prev level range
    // level once upgraded = 20 to 29
    } else if (currentLevel >= 19 && currentLevel <= 28) {
        return 120; // 2x of prev level range
    // level once upgraded = 30 to 39
    } else if (currentLevel >= 29 && currentLevel <= 38) {
        return 360; // 3x of prev level range
    // level once upgraded = 40 to 49
    } else if (currentLevel >= 39 && currentLevel <= 48) {
        return 1080; // 3x of prev level range
    // level once upgraded = 50 to 59
    } else if (currentLevel >= 49 && currentLevel <= 58) {
        return 3240; // 3x of prev level range
    // level once upgraded = 60 to 65
    } else if (currentLevel >= 59 && currentLevel <= 64) {
        return 12960; // 4x of prev level range
    }
}

/**
 * Calculates the cost (in seaweed) to evolve a bit placed in a user's raft given the current level of the bit.
 * 
 * Unlike bit evolution in islands, the cost to evolve a bit in a raft uses seaweed.
 */
export const BIT_RAFT_EVOLUTION_COST = (currentLevel: number): number => {
    if (currentLevel === 30) throw new Error(`(RAFT_EVOLUTION_COST) Raft is already at max level: ${currentLevel}`);

    // level 1 starts with 10 seaweed, and every level after is 1.125x the previous level
    return 10 * (1.125 ** (currentLevel - 1)); 
}

/** gets the cost (in seaweed) of evolving a bit in a raft, based on its current level */
export const BIT_EVOLVING_COST_RAFT = (currentLevel: number): number => {
    // if current level is 1, cost is 10 seaweed. every level after is 1.125x the previous level
    return 10 * (1.125 ** (currentLevel - 1));
}

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
 * Gets the default gathering rate (excl. +-10%; in % of total resources/hour) for a Bit based on its rarity.
 */
export const DEFAULT_GATHERING_RATE = (rarity: BitRarity): number => {
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
 * Gets the default gathering rate growth (excl. +-10%; fixed increase in % of total resources/hour for every level increase) for a Bit based on its rarity.
 */
export const DEFAULT_GATHERING_RATE_GROWTH = (rarity: BitRarity): number => {
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
 * Gets the default earning rate (excl. +-10%; in % of total xCookies spent/hour) for a Bit based on its rarity.
 */
export const DEFAULT_EARNING_RATE = (rarity: BitRarity): number => {
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
 * Gets the default earning rate growth (excl. +-10%; fixed increase in % of total xCookies spent/hour for every level increase) for a Bit based on its rarity.
 */
export const DEFAULT_EARNING_RATE_GROWTH = (rarity: BitRarity): number => {
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

/** base energy depletion rate of bits in % of energy bar/hour (regardless of rarity). actual depletion rate will include +-25% */
export const BASE_ENERGY_DEPLETION_RATE: number = 5;

/** returns the reductions in earning and gathering rate (by a fixed %) if the bit's energy goes below a certain threshold */
export const ENERGY_THRESHOLD_REDUCTIONS = (energy: number): EnergyThresholdReduction => {
    switch (true) {
        case energy <= 0:
            return {
                gatheringRateReduction: 100,
                earningRateReduction: 100
            }
        case energy < 25:
            return {
                gatheringRateReduction: 50,
                earningRateReduction: 50
            }
        case energy < 50:
            return {
                gatheringRateReduction: 20,
                earningRateReduction: 20,
            }
        default: {
            return {
                gatheringRateReduction: 0,
                earningRateReduction: 0
            }
        }

    }
}