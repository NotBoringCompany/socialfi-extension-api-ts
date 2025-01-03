import { BarrenResource, FruitResource, LiquidResource, OreResource, Resource, ResourceLine, ResourceRarity, ResourceType, WoodResource } from '../../models/resource';

export const resources: Resource[] = [
    // Ore resources
    { type: OreResource.STONE, line: ResourceLine.ORE, rarity: ResourceRarity.COMMON, weight: 5 },
    { type: OreResource.COPPER, line: ResourceLine.ORE, rarity: ResourceRarity.UNCOMMON, weight: 5 },
    { type: OreResource.IRON, line: ResourceLine.ORE, rarity: ResourceRarity.RARE, weight: 5 },
    { type: OreResource.SILVER, line: ResourceLine.ORE, rarity: ResourceRarity.EPIC, weight: 5 },
    { type: OreResource.GOLD, line: ResourceLine.ORE, rarity: ResourceRarity.LEGENDARY, weight: 5 },
    // Fruit resources
    { type: FruitResource.TOMATO, line: ResourceLine.FRUIT, rarity: ResourceRarity.COMMON, weight: 2 },
    { type: FruitResource.APPLE, line: ResourceLine.FRUIT, rarity: ResourceRarity.UNCOMMON, weight: 2 },
    { type: FruitResource.STAR_FRUIT, line: ResourceLine.FRUIT, rarity: ResourceRarity.RARE, weight: 2 },
    { type: FruitResource.MELON, line: ResourceLine.FRUIT, rarity: ResourceRarity.EPIC, weight: 2 },
    { type: FruitResource.DRAGON_FRUIT, line: ResourceLine.FRUIT, rarity: ResourceRarity.LEGENDARY, weight: 2 },
    // Liquid resources
    { type: LiquidResource.WATER, line: ResourceLine.LIQUID, rarity: ResourceRarity.COMMON, weight: 1 },
    { type: LiquidResource.MAPLE_SYRUP, line: ResourceLine.LIQUID, rarity: ResourceRarity.UNCOMMON, weight: 1 },
    { type: LiquidResource.HONEY, line: ResourceLine.LIQUID, rarity: ResourceRarity.RARE, weight: 1 },
    { type: LiquidResource.MOONLIGHT_DEW, line: ResourceLine.LIQUID, rarity: ResourceRarity.EPIC, weight: 1 },
    { type: LiquidResource.PHOENIX_TEAR, line: ResourceLine.LIQUID, rarity: ResourceRarity.LEGENDARY, weight: 1 },
    // Wood resources
    { type: WoodResource.PINE_WOOD, line: ResourceLine.WOOD, rarity: ResourceRarity.COMMON, weight: 4 },
    { type: WoodResource.OAK_WOOD, line: ResourceLine.WOOD, rarity: ResourceRarity.UNCOMMON, weight: 4 },
    { type: WoodResource.MAHOGANY_WOOD, line: ResourceLine.WOOD, rarity: ResourceRarity.RARE, weight: 4 },
    { type: WoodResource.TEAK_WOOD, line: ResourceLine.WOOD, rarity: ResourceRarity.EPIC, weight: 4 },
    { type: WoodResource.EBONY_WOOD, line: ResourceLine.WOOD, rarity: ResourceRarity.LEGENDARY, weight: 4 },
];

