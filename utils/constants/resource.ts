import { BarrenResource, FruitResource, LiquidResource, OreResource, Resource, ResourceLine, ResourceRarity } from '../../models/resource';

export const resources: Resource[] = [
    // Barren resources
    { type: BarrenResource.SEAWEED, line: ResourceLine.BARREN, rarity: ResourceRarity.COMMON, weight: 1 },
    // Ore resources
    { type: OreResource.STONE, line: ResourceLine.ORE, rarity: ResourceRarity.COMMON, weight: 5 },
    { type: OreResource.COPPER, line: ResourceLine.ORE, rarity: ResourceRarity.UNCOMMON, weight: 10 },
    { type: OreResource.IRON, line: ResourceLine.ORE, rarity: ResourceRarity.RARE, weight: 15 },
    { type: OreResource.SILVER, line: ResourceLine.ORE, rarity: ResourceRarity.EPIC, weight: 20 },
    { type: OreResource.GOLD, line: ResourceLine.ORE, rarity: ResourceRarity.LEGENDARY, weight: 25 },
    // Fruit resources
    { type: FruitResource.BLUEBERRY, line: ResourceLine.FRUIT, rarity: ResourceRarity.COMMON, weight: 0.1 },
    { type: FruitResource.APPLE, line: ResourceLine.FRUIT, rarity: ResourceRarity.UNCOMMON, weight: 0.2 },
    { type: FruitResource.STAR_FRUIT, line: ResourceLine.FRUIT, rarity: ResourceRarity.RARE, weight: 0.3 },
    { type: FruitResource.MELON, line: ResourceLine.FRUIT, rarity: ResourceRarity.EPIC, weight: 1.5 },
    { type: FruitResource.DRAGON_FRUIT, line: ResourceLine.FRUIT, rarity: ResourceRarity.LEGENDARY, weight: 2 },
    // Liquid resources
    { type: LiquidResource.WATER, line: ResourceLine.LIQUID, rarity: ResourceRarity.COMMON, weight: 1 },
    { type: LiquidResource.MAPLE_SYRUP, line: ResourceLine.LIQUID, rarity: ResourceRarity.UNCOMMON, weight: 1.2 },
    { type: LiquidResource.HONEY, line: ResourceLine.LIQUID, rarity: ResourceRarity.RARE, weight: 1.4 },
    { type: LiquidResource.MOONLIGHT_DEW, line: ResourceLine.LIQUID, rarity: ResourceRarity.EPIC, weight: 1.6 },
    { type: LiquidResource.PHOENIX_TEAR, line: ResourceLine.LIQUID, rarity: ResourceRarity.LEGENDARY, weight: 1.8 },
];