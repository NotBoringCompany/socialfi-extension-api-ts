import { IslandType } from '../../models/island';

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
 * Gets the default resource drop chances for an Island based on its type.
 */
export const DEFAULT_RESOURCE_DROP_CHANCES = (type: IslandType) => {
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