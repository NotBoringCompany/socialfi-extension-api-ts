import { BitRarity } from '../../models/bit';
import { IslandType, RarityDeviationReduction, ResourceDropChance, ResourceDropChanceDiff } from '../../models/island';

/** max level for any island type */
export const MAX_ISLAND_LEVEL = 20;

/** claim cooldown for claiming resources (in seconds) */
export const RESOURCES_CLAIM_COOLDOWN = 86400;

/** claim cooldown for claiming xCookies [FROM THE ISLAND] (in seconds) */
export const X_COOKIE_CLAIM_COOLDOWN = 86400;

/** reduction modifier for effective gathering rate for having multiple bits on an island */
export const GATHERING_RATE_REDUCTION_MODIFIER = 0.1;

/** reduction modifier for effective earning rate for having multiple bits on an island */
export const EARNING_RATE_REDUCTION_MODIFIER = 0.1;

/** exponential decay for gathering rate calculation (both bit and island) */
export const GATHERING_RATE_EXPONENTIAL_DECAY = 0.03;

/** exponential decay for earning rate calculation (both bit and island) */
export const EARNING_RATE_EXPONENTIAL_DECAY = 0.03;

/** the amount of bits that can be placed in an island */
export const BIT_PLACEMENT_CAP = 5;

/** 
 * the amount of islands the user can have at a time to farm resources/earn back cookies. 
 * 
 * however, the user is of course still allowed to have more islands in their inventory.
 */
export const TOTAL_ACTIVE_ISLANDS_ALLOWED = 30;

/** cost to evolve an island (in xCookies) based on the island type and the island's current level */
export const ISLAND_EVOLUTION_COST = (type: IslandType, currentLevel: number) => {
    if (currentLevel === MAX_ISLAND_LEVEL) throw new Error(`(ISLAND_EVOLUTION_COST) Island is already at max level: ${currentLevel}`);
    
    // higher rarity islands will cost more each time it levels up
    switch (type) {
        case IslandType.PRIMAL_ISLES:
            if (currentLevel === 1) {
                return 50;
            } else {
                return 50 + (15 * (currentLevel - 1));
            }
        case IslandType.VERDANT_ISLES:
            if (currentLevel === 1) {
                return 100;
            } else {
                return 100 + (30 * (currentLevel - 1));
            }
        case IslandType.EXOTIC_ISLES:
            if (currentLevel === 1) {
                return 250;
            } else {
                return 250 + (75 * (currentLevel - 1));
            }
        case IslandType.CRYSTAL_ISLES:
            if (currentLevel === 1) {
                return 700;
            } else {
                return 700 + (210 * (currentLevel - 1));
            }
        case IslandType.CELESTIAL_ISLES:
            if (currentLevel === 1) {
                return 1500;
            } else {
                return 1500 + (450 * (currentLevel - 1));
            }
    }
}

/**
 * Gets the default resource cap for an Island based on its type.
 */
export const DEFAULT_RESOURCE_CAP = (type: IslandType) => {
    switch (type) {
        case IslandType.PRIMAL_ISLES:
            return 100;
        case IslandType.VERDANT_ISLES:
            return 100;
        case IslandType.EXOTIC_ISLES:
            return 100;
        case IslandType.CRYSTAL_ISLES:
            return 100;
        case IslandType.CELESTIAL_ISLES:
            return 75;
    }
}

/**
 * Gets the resource drop chances for an Island based on its type.
 */
export const RESOURCE_DROP_CHANCES = (type: IslandType): ResourceDropChance => {
    switch (type) {
        case IslandType.PRIMAL_ISLES:
            return {
                stone: 77.5,
                keratin: 18.5,
                silver: 4,
                diamond: 0,
                relic: 0
            }
        case IslandType.VERDANT_ISLES:
            return {
                stone: 62.5,
                keratin: 28.7,
                silver: 8.6,
                diamond: 0.2,
                relic: 0
            }
        case IslandType.EXOTIC_ISLES:
            return {
                stone: 50,
                keratin: 33.745,
                silver: 15,
                diamond: 1.25,
                relic: 0.005
            }
        case IslandType.CRYSTAL_ISLES:
            return {
                stone: 35.5,
                keratin: 34,
                silver: 25,
                diamond: 5,
                relic: 0.5
            }
        case IslandType.CELESTIAL_ISLES:
            return {
                stone: 15,
                keratin: 20,
                silver: 40,
                diamond: 20,
                relic: 5
            }
    }
}

/**
 * Gets the percentage modifier (diff) for the resource drop chances of an island every time it levels up.
 */
export const RESOURCE_DROP_CHANCES_LEVEL_DIFF = (type: IslandType): ResourceDropChanceDiff => {
    switch (type) {
        case IslandType.PRIMAL_ISLES:
            return {
                stone: -0.13,
                keratin: 0.12,
                silver: 0.01,
                diamond: 0,
                relic: 0
            }
        case IslandType.VERDANT_ISLES:
            return {
                stone: -0.21001,
                keratin: 0.155,
                silver: 0.05,
                diamond: 0.005,
                relic: 0
            }
        case IslandType.EXOTIC_ISLES:
            return {
                stone: -0.44825,
                keratin: 0.175,
                silver: 0.25,
                diamond: 0.0225,
                relic: 0.00075
            }
        case IslandType.CRYSTAL_ISLES:
            return {
                stone: -0.429,
                keratin: 0.02,
                silver: 0.3,
                diamond: 0.1,
                relic: 0.009
            }
        case IslandType.CELESTIAL_ISLES:
            return {
                stone: -0.55,
                keratin: -0.175,
                silver: 0.3,
                diamond: 0.25,
                relic: 0.175
            }
    }
}

/**
 * Returrns the minimum rarity the bit needs to be to be placed on an island based on its type.
 */
export const BIT_PLACEMENT_MIN_RARITY_REQUIREMENT = (type: IslandType): BitRarity => {
    switch (type) {
        case IslandType.PRIMAL_ISLES:
            return BitRarity.COMMON;
        case IslandType.VERDANT_ISLES:
            return BitRarity.COMMON;
        case IslandType.EXOTIC_ISLES:
            return BitRarity.COMMON;
        case IslandType.CRYSTAL_ISLES:
            return BitRarity.UNCOMMON;
        case IslandType.CELESTIAL_ISLES:
            return BitRarity.RARE;
    }
}

/**
 * Shows the different negative modifiers when the bit's rarity deviates from the island's type (in rarity format).
 * 
 * For instance, if a common Bit is placed on Verdant Isles (in rarity format: uncommon), there will be a negative modifier for gathering rate and resource cap.
 */
export const RARITY_DEVIATION_REDUCTIONS = (type: IslandType, rarity: BitRarity): RarityDeviationReduction => {
    switch (type) {
        // for primal isles, all bits from common to legendary will NOT receive any reductions
        case IslandType.PRIMAL_ISLES:
            return {
                gatheringRateReduction: 0,
                resourceCapReduction: 0
            }
        // for verdant isles, only common bits will get reductions.
        case IslandType.VERDANT_ISLES:
            switch (rarity) {
                case BitRarity.COMMON:
                    return {
                        gatheringRateReduction: 2,
                        resourceCapReduction: 5
                    }
                default:
                    return {
                        gatheringRateReduction: 0,
                        resourceCapReduction: 0
                    }
            }
        // for exotic isles, only common and uncommon bits will get reductions.
        case IslandType.EXOTIC_ISLES:
            switch (rarity) {
                case BitRarity.COMMON:
                    return {
                        gatheringRateReduction: 5,
                        resourceCapReduction: 7.75
                    }
                case BitRarity.UNCOMMON:
                    return {
                        gatheringRateReduction: 3,
                        resourceCapReduction: 6
                    }
            }
        // for crystal isles, commons cannot be placed, so technically only uncommons and rares will get reductions.
        case IslandType.CRYSTAL_ISLES:
            switch (rarity) {
                case BitRarity.COMMON:
                    throw new Error(`(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Crystal Isles.`)
                case BitRarity.UNCOMMON:
                    return {
                        gatheringRateReduction: 5.75,
                        resourceCapReduction: 10
                    }
                case BitRarity.RARE:
                    return {
                        gatheringRateReduction: 4,
                        resourceCapReduction: 7
                    }
            }
        // for celestial isles, commons and uncommons cannot be placed, so technically only rares and epics will get reductions.
        case IslandType.CELESTIAL_ISLES:
            switch (rarity) {
                case BitRarity.COMMON:
                    throw new Error(`(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Celestial Isles.`)
                case BitRarity.UNCOMMON:
                    throw new Error(`(RARITY_DEVIATION_REDUCTIONS) Uncommon bits are not allowed to be placed on Celestial Isles.`)
                case BitRarity.RARE:
                    return {
                        gatheringRateReduction: 7.5,
                        resourceCapReduction: 11.5
                    }
                case BitRarity.EPIC:
                    return {
                        gatheringRateReduction: 5.25,
                        resourceCapReduction: 8.25
                    }
                case BitRarity.LEGENDARY:
                    return {
                        gatheringRateReduction: 0,
                        resourceCapReduction: 0
                    }
            }
    }
}

/**
 * Shows the tax the user has to pay to claim xCookies from a specific island type given the amount of active islands the user has.
 */
export const X_COOKIE_TAX = (type: IslandType, activeIslands: number): number => {
    if (activeIslands === 0) return 0;

    switch (type) {
        case IslandType.PRIMAL_ISLES:
            if (activeIslands >= 1 && activeIslands <= 4) {
                return 0;
            } else if (activeIslands >= 5 && activeIslands <= 10) {
                // 1% 
                return 1 * (1.15 ** (activeIslands - 5));
            } else if (activeIslands >= 11 && activeIslands <= 20) {
                // 1.05x increase each active island amount increase
                return (1 * (1.15 ** 5)) * (1.05 ** (activeIslands - 10));
            } else if (activeIslands >= 21 && activeIslands <= 30) {
                // 1.025x increase each active island amount increase
                return (1 * (1.15 ** 5)) * (1.05 ** 10) * (1.025 ** (activeIslands - 20));
            } else {
                throw new Error(`(X_COOKIE_TAX) Invalid active islands: ${activeIslands}`);
            }
        case IslandType.VERDANT_ISLES:
            if (activeIslands >= 1 && activeIslands <= 3) {
                return 0;
            } else if (activeIslands >= 4 && activeIslands <= 10) {
                // 1% at 4 active islands; 1.175x increase each active island amount increase
                return 1 * (1.175 ** (activeIslands - 4));
            } else if (activeIslands >= 11 && activeIslands <= 20) {
                // 1.05x increase each active island amount increase
                return (1 * (1.175 ** 6)) * (1.05 ** (activeIslands - 10));
            } else if (activeIslands >= 21 && activeIslands <= 30) {
                // 1.025x increase each active island amount increase
                return (1 * (1.175 ** 6)) * (1.05 ** 10) * (1.025 ** (activeIslands - 20));
            } else {
                throw new Error(`(X_COOKIE_TAX) Invalid active islands: ${activeIslands}`);
            }
        case IslandType.EXOTIC_ISLES:
            if (activeIslands >= 1 && activeIslands <= 2) {
                return 0;
            } else if (activeIslands >= 3 && activeIslands <= 10) {
                // 1% at 4 active islands; 1.2x increase each active island amount increase
                return 1 * (1.2 ** (activeIslands - 3));
            } else if (activeIslands >= 11 && activeIslands <= 20) {
                // 1.05x increase each active island amount increase
                return (1 * (1.2 ** 7)) * (1.05 ** (activeIslands - 10));
            } else if (activeIslands >= 21 && activeIslands <= 30) {
                // 1.025x increase each active island amount increase
                return (1 * (1.2 ** 7)) * (1.05 ** 10) * (1.025 ** (activeIslands - 20));
            } else {
                throw new Error(`(X_COOKIE_TAX) Invalid active islands: ${activeIslands}`);
            }
        case IslandType.CRYSTAL_ISLES:
            if (activeIslands === 1) {
                return 0;
            } else if (activeIslands >= 2 && activeIslands <= 10) {
                // 1% at 2 active islands; 1.225x increase each active island amount increase
                return 1 * (1.225 ** (activeIslands - 2));
            } else if (activeIslands >= 11 && activeIslands <= 20) {
                // 1.05x increase each active island amount increase
                return (1 * (1.225 ** 8)) * (1.05 ** (activeIslands - 10));
            } else if (activeIslands >= 21 && activeIslands <= 30) {
                // 1.025x increase each active island amount increase
                return (1 * (1.225 ** 8)) * (1.05 ** 10) * (1.025 ** (activeIslands - 20));
            } else {
                throw new Error(`(X_COOKIE_TAX) Invalid active islands: ${activeIslands}`);
            }
        case IslandType.CELESTIAL_ISLES:
            if (activeIslands >= 1 && activeIslands <= 10) {
                // 1% at 1 active island; 1.25x increase each active island amount increase
                return 1 * (1.25 ** (activeIslands - 1));
            } else if (activeIslands >= 11 && activeIslands <= 20) {
                // 1.05x increase each active island amount increase
                return (1 * (1.25 ** 9)) * (1.05 ** (activeIslands - 10));
            } else if (activeIslands >= 21 && activeIslands <= 30) {
                // 1.025x increase each active island amount increase
                return (1 * (1.25 ** 9)) * (1.05 ** 10) * (1.025 ** (activeIslands - 20));
            }
    }
}