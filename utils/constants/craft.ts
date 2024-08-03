import { CarpentingCraft, CookingCraft, CraftItem, CraftItemLine, CraftItemRarity, CraftType, SmeltingCraft, TailoringCraft } from "../../models/craft";
import { BarrenResource, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceType, SimplifiedResource } from "../../models/resource";


export const GET_CRAFT_RECIPE = (resultItem: ResourceType): SimplifiedResource[] => {
    switch (resultItem) {
        case LiquidResource.MAPLE_SYRUP:
            return[{type: LiquidResource.WATER, amount: 3}, {type: FruitResource.APPLE, amount:2}];
        case OreResource.GOLD:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.MAPLE_SYRUP, amount:7}];
        case OreResource.SILVER:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.WATER, amount:7}];
        case OreResource.SILVER:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.WATER, amount:7}];
        case OreResource.SILVER:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.WATER, amount:7}];
        case OreResource.SILVER:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.WATER, amount:7}];
        case OreResource.SILVER:
            return[{type: OreResource.IRON, amount: 1}, {type: LiquidResource.WATER, amount:7}];
        default:
            return[];
    }
}

export const getAllCraftItems = (): CraftItem[] =>{
    return craftItems;
}

// export const getCraftItem = (type: CraftType): CraftItem =>{
//     return craftItems.find(craftitem => craftitem.type === type);
// }

export const getCraftItem = (type: ResourceType): CraftItem =>{
    return craftItems.find(craftItem => craftItem.type === type);
}

export const getCraftItemCriteria = (line: CraftItemLine) : CraftItem[] =>{
    var result = new Array();
    for(let i = 0 ; i < craftItems.length ; i++)
    {
        if(craftItems[i].line === line)
        {
            result.push(craftItems[i]);
        }
    }
    return result;
}


export const craftItems : CraftItem[] = 
[
    //Smelting crafts
    // { 
    //     //type: SmeltingCraft.PURIFIED_STONE, 
    //     type: FruitResource.DRAGON_FRUIT,
    //     line: CraftItemLine.SMELTING, 
    //     rarity: CraftItemRarity.COMMON, 
    //     baseEnergy: 10, 
    //     catalyst:
    //     [
    //         {type: OreResource.STONE, amount:1}, 
    //         {type: LiquidResource.WATER, amount:5}
    //     ], 
    //     baseSuccessChance: 100, baseCritChance: 0, points: 10, craftPoints: 5, berries:0.01
    //     ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10
    // }
    // },
    // { 
    //     //type: SmeltingCraft.PURIFIED_IRON, 
    //     type: LiquidResource.MAPLE_SYRUP,
    //     line: CraftItemLine.SMELTING, 
    //     rarity: CraftItemRarity.COMMON, 
    //     baseEnergy: 10, 
    //     catalyst:
    //     [
    //         {type: OreResource.IRON, amount:1}, 
    //         {type: LiquidResource.WATER, amount:5}
    //     ], 
    //     baseSuccessChance: 100, baseCritChance: 0, points: 10, craftPoints: 5, berries:0.01    
    //     ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10
    // },
    { 
        //type: SmeltingCraft.PURIFIED_SILVER, 
        type: LiquidResource.HONEY,
        line: CraftItemLine.SMELTING, 
        rarity: CraftItemRarity.RARE, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: OreResource.SILVER, amount:3}, 
            {type: LiquidResource.WATER, amount:10}
        ], 
        baseSuccessChance: 80, baseCritChance: 0, points: 10, craftPoints: 10, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: SmeltingCraft.PURIFIED_GOLD, 
        type: LiquidResource.MOONLIGHT_DEW,
        line: CraftItemLine.SMELTING, 
        rarity: CraftItemRarity.EPIC, 
        baseEnergy: 20, 
        catalyst:
        [
            {type: OreResource.GOLD, amount:5}, 
            {type: LiquidResource.WATER, amount:25}
        ], 
        baseSuccessChance: 60, baseCritChance: 0, points: 10, craftPoints: 20, berries: 0.01
        ,reqLevel: 4, reqCraftLevel: 1, craftExp: 10, weight: 1
    },

    { 
        //type: SmeltingCraft.PLATINUM_TEAR, 
        type: LiquidResource.PHOENIX_TEAR,
        line: CraftItemLine.SMELTING, 
        rarity: CraftItemRarity.LEGENDARY, 
        baseEnergy: 50, 
        catalyst:
        [
            {type: OreResource.STONE, amount:20}, 
            {type: OreResource.IRON, amount:20}, 
            {type: OreResource.SILVER, amount:20}, 
            {type: OreResource.GOLD, amount:20}, 
            {type: LiquidResource.PHOENIX_TEAR, amount:5}
        ], 
        baseSuccessChance: 40, baseCritChance: 0, points: 30, craftPoints: 50, berries: 0.01
        ,reqLevel: 5, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    //SMELTING END LINE -------------------------



    //Cooking
    { 
        ////type: CookingCraft.REFRESHING_MELON, 
        type: OreResource.STONE,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.COMMON, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: FruitResource.MELON, amount:1}, 
            {type: LiquidResource.WATER, amount:5}
        ], 
        baseSuccessChance: 100, baseCritChance: 0, points: 10, craftPoints: 5, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        ////type: CookingCraft.ROYAL_JELLY, 
        type: OreResource.COPPER,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.COMMON, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: LiquidResource.HONEY, amount:3}, 
            {type: LiquidResource.WATER, amount:5}
        ], 
        baseSuccessChance: 100, baseCritChance: 0, points: 12.5, craftPoints: 8, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        ////type: CookingCraft.HONEYDEW, 
        type: OreResource.IRON,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.UNCOMMON, 
        baseEnergy: 20, 
        catalyst:
        [
            {type: LiquidResource.HONEY, amount:5}, 
            {type: FruitResource.MELON, amount:5}
        ], 
        baseSuccessChance: 80, baseCritChance: 0, points: 15, craftPoints: 8, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CookingCraft.SALAD, 
        type: OreResource.SILVER,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.RARE, 
        baseEnergy: 30, 
        catalyst:
        [
            {type: FruitResource.TOMATO, amount:1}, 
            {type: FruitResource.STAR_FRUIT, amount:1},
            {type: FruitResource.APPLE, amount:1} 
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CookingCraft.SUGAR_RUSH, 
        type: OreResource.GOLD,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.EPIC, 
        baseEnergy: 40, 
        catalyst:
        [
            {type: FruitResource.STAR_FRUIT, amount:15}, 
            {type: LiquidResource.HONEY, amount:15}, 
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 4, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CookingCraft.SWEET_DRAGON, 
        type: FruitResource.TOMATO,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.EPIC, 
        baseEnergy: 40, 
        catalyst:
        [
            {type: FruitResource.DRAGON_FRUIT, amount:15}, 
            {type: LiquidResource.HONEY, amount:25}, 
            {type: LiquidResource.WATER, amount:15}, 
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 4, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CookingCraft.GOLD_SYRUP, 
        type: FruitResource.APPLE,
        line: CraftItemLine.COOKING, 
        rarity: CraftItemRarity.LEGENDARY, 
        baseEnergy: 50, 
        catalyst:
        [
            {type: OreResource.GOLD, amount:25}, 
            {type: LiquidResource.MAPLE_SYRUP, amount:35},
            {type: LiquidResource.MOONLIGHT_DEW, amount:25},
            {type: LiquidResource.HONEY, amount:25} 
        ], 
        baseSuccessChance: 40, baseCritChance: 0, points: 30, craftPoints: 50, berries: 0.01
        ,reqLevel: 5, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CarpentingCraft.BRICKSTONE_WOOD, 
        type: FruitResource.STAR_FRUIT,
        line: CraftItemLine.CARPENTING, 
        rarity: CraftItemRarity.COMMON, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: OreResource.STONE, amount:5}, 
            {type: OreResource.COPPER, amount:5}
        ], 
        baseSuccessChance: 100, baseCritChance: 0, points: 5, craftPoints: 10, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CarpentingCraft.BOLD_BRANCH, 
        type: FruitResource.MELON,
        line: CraftItemLine.CARPENTING, 
        rarity: CraftItemRarity.COMMON, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: OreResource.STONE, amount:5}, 
            {type: OreResource.COPPER, amount:5}
        ], 
        baseSuccessChance: 100, baseCritChance: 0, points: 5, craftPoints: 10, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CarpentingCraft.ADAM_WOOD, 
        type: FruitResource.DRAGON_FRUIT,
        line: CraftItemLine.CARPENTING, 
        rarity: CraftItemRarity.RARE, 
        baseEnergy: 30, 
        catalyst:
        [
            {type: OreResource.STONE, amount:25}, 
            {type: OreResource.COPPER, amount:25}
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: CarpentingCraft.ROOT_OF_EVE, 
        type: LiquidResource.WATER,
        line: CraftItemLine.CARPENTING, 
        rarity: CraftItemRarity.EPIC, 
        baseEnergy: 40, 
        catalyst:
        [
            {type: OreResource.STONE, amount:35}, 
            {type: OreResource.COPPER, amount:35}
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 4, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: TailoringCraft.SHINING_FABRIC, 
        type: LiquidResource.MAPLE_SYRUP,
        line: CraftItemLine.TAILORING, 
        rarity: CraftItemRarity.COMMON, 
        baseEnergy: 10, 
        catalyst:
        [
            {type: OreResource.SILVER, amount:5}, 
            {type: BarrenResource.SEAWEED, amount:5}
        ], 
        baseSuccessChance: 100, baseCritChance: 0, points: 5, craftPoints: 10, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: TailoringCraft.GOLDEN_THREAD, 
        type: LiquidResource.HONEY,
        line: CraftItemLine.TAILORING, 
        rarity: CraftItemRarity.RARE, 
        baseEnergy: 30, 
        catalyst:
        [
            {type: OreResource.GOLD, amount:25}, 
            {type: BarrenResource.SEAWEED, amount:25}
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 1, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: TailoringCraft.DENIM, 
        type: LiquidResource.MOONLIGHT_DEW,
        line: CraftItemLine.TAILORING, 
        rarity: CraftItemRarity.EPIC, 
        baseEnergy: 40, 
        catalyst:
        [
            {type: LiquidResource.WATER, amount:100}, 
            {type: BarrenResource.SEAWEED, amount:5}
        ], 
        baseSuccessChance: 70, baseCritChance: 0, points: 25, craftPoints: 15, berries: 0.01
        ,reqLevel: 4, reqCraftLevel: 1, craftExp: 10, weight: 1
    },
    { 
        //type: TailoringCraft.SATIN, 
        type: LiquidResource.PHOENIX_TEAR,
        line: CraftItemLine.TAILORING, 
        rarity: CraftItemRarity.LEGENDARY, 
        baseEnergy: 50, 
        catalyst:
        [
            {type: LiquidResource.WATER, amount:250}, 
            {type: BarrenResource.SEAWEED, amount:100}
        ], 
        baseSuccessChance: 40, baseCritChance: 0, points: 30, craftPoints: 50, berries: 0.01
        ,reqLevel: 5, reqCraftLevel: 1, craftExp: 10, weight: 1
    }

    
];