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