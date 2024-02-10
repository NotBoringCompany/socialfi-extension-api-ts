import { IslandType, ResourceDropChance, ResourceDropChanceDiff } from '../../models/island';

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
                silver: 77.5,
                emerald: 18.5,
                diamond: 4,
                tanzanite: 0,
                relic: 0
            }
        case IslandType.VERDANT_ISLES:
            return {
                silver: 62.5,
                emerald: 28.7,
                diamond: 8.6,
                tanzanite: 0.2,
                relic: 0
            }
        case IslandType.EXOTIC_ISLES:
            return {
                silver: 50,
                emerald: 33.745,
                diamond: 15,
                tanzanite: 1.25,
                relic: 0.005
            }
        case IslandType.CRYSTAL_ISLES:
            return {
                silver: 35.5,
                emerald: 34,
                diamond: 25,
                tanzanite: 5,
                relic: 0.5
            }
        case IslandType.CELESTIAL_ISLES:
            return {
                silver: 17.5,
                emerald: 20,
                diamond: 45,
                tanzanite: 15,
                relic: 2.5
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
                silver: -0.13,
                emerald: 0.12,
                diamond: 0.01,
                tanzanite: 0,
                relic: 0
            }
        case IslandType.VERDANT_ISLES:
            return {
                silver: -0.21001,
                emerald: 0.155,
                diamond: 0.05,
                tanzanite: 0.005,
                relic: 0
            }
        case IslandType.EXOTIC_ISLES:
            return {
                silver: -0.44825,
                emerald: 0.175,
                diamond: 0.25,
                tanzanite: 0.0225,
                relic: 0.00075
            }
        case IslandType.CRYSTAL_ISLES:
            return {
                silver: -0.429,
                emerald: 0.02,
                diamond: 0.3,
                tanzanite: 0.1,
                relic: 0.009
            }
        case IslandType.CELESTIAL_ISLES:
            return {
                silver: -0.4875,
                emerald: -0.1,
                diamond: 0.25,
                tanzanite: 0.25,
                relic: 0.0875
            }
    }
}