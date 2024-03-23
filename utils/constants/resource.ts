import { BarrenResource, FruitResource, LiquidResource, OreResource, Resource, ResourceLine, ResourceRarity, ResourceType } from '../../models/resource';

/**
 * Maps each resource line to its corresponding resources based on rarity.
 */
export const resourceMapping: Record<ResourceLine, Record<ResourceRarity, ResourceType>> = {
    [ResourceLine.BARREN]: {
        [ResourceRarity.COMMON]: BarrenResource.SEAWEED,
        [ResourceRarity.UNCOMMON]: BarrenResource.SEAWEED,
        [ResourceRarity.RARE]: BarrenResource.SEAWEED,
        [ResourceRarity.EPIC]: BarrenResource.SEAWEED,
        [ResourceRarity.LEGENDARY]: BarrenResource.SEAWEED,
    },
    [ResourceLine.ORE]: {
        [ResourceRarity.COMMON]: OreResource.STONE,
        [ResourceRarity.UNCOMMON]: OreResource.COPPER,
        [ResourceRarity.RARE]: OreResource.IRON,
        [ResourceRarity.EPIC]: OreResource.SILVER,
        [ResourceRarity.LEGENDARY]: OreResource.GOLD,
    },
    [ResourceLine.FRUIT]: {
        [ResourceRarity.COMMON]: FruitResource.BLUEBERRY,
        [ResourceRarity.UNCOMMON]: FruitResource.APPLE,
        [ResourceRarity.RARE]: FruitResource.STAR_FRUIT,
        [ResourceRarity.EPIC]: FruitResource.MELON,
        [ResourceRarity.LEGENDARY]: FruitResource.DRAGON_FRUIT,
    },
    [ResourceLine.LIQUID]: {
        [ResourceRarity.COMMON]: LiquidResource.WATER,
        [ResourceRarity.UNCOMMON]: LiquidResource.MAPLE_SYRUP,
        [ResourceRarity.RARE]: LiquidResource.HONEY,
        [ResourceRarity.EPIC]: LiquidResource.MOONLIGHT_DEW,
        [ResourceRarity.LEGENDARY]: LiquidResource.PHOENIX_TEAR,
    },
}

/**
 * Gets a Resource instance based on the given resource line and, if applicable, rarity.
 */
export const getResource = (line: ResourceLine, rarity: ResourceRarity | null = ResourceRarity.COMMON): Resource => {
    // For barren resources, default rarity to COMMON if not provided
    if (line === ResourceLine.BARREN && rarity === null) {
        rarity = ResourceRarity.COMMON;
    }

    // Check for valid rarity
    if (!rarity || !Object.values(ResourceRarity).includes(rarity)) {
        throw new Error('Invalid or missing rarity for resource.');
    }

    // Get the resource type based on line and rarity
    const resourceType = resourceMapping[line]?.[rarity];
    if (!resourceType) {
        throw new Error('Invalid resource line or rarity.');
    }

    return {
        type: resourceType,
        line,
        rarity
    };
};