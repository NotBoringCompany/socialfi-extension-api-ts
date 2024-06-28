import { BitOrbType } from './bitOrb';
import { BoosterItem } from './booster';
import { FoodType } from './food';
import { BarrenResource, FruitResource, LiquidResource, OreResource } from './resource';
import { TerraCapsulatorType } from './terraCapsulator';

/**
 * Represents a Point of Interest (POI).
 */
export interface POI {
    /** the POI name */
    name: POIName;
    /** the distance from this POI to another POI (in meters) */
    distanceTo: {
        [destination in POIName]?: number;
    }
    /** the POI's shop */
    shop: POIShop;
}

/**
 * Lists all POI names.
 */
export enum POIName {
    HOME = 'Home',
    EVERGREEN_VILLAGE = 'Evergreen Village',
    PALMSHADE_VILLAGE = 'Palmshade Village',
    SEABREEZE_HARBOR = 'Seabreeze Harbor',
    STARFALL_SANCTUARY = 'Starfall Sanctuary',
}

/**
 * Represents a POI's shop.
 */
export interface POIShop {
    /** all global items that can be bought by everyone */
    globalItems: POIShopGlobalItem[];
    /** 
     * all player items that can be bought by each player respectively.
     * currently, each player should see the same items on the shop. however, the exact amount limit that can be bought (or sold) may differ per player.
     * e.g. player 1 can buy 10 of item A, player 2 can buy 20 of item A.
     */
    playerItems: POIShopPlayerItem[];
}

/**
 * Represents a global item in a POI's shop.
 */
export interface POIShopGlobalItem {
    /** the item name */
    name: POIShopItemName;
    /** 
     * the amount of this item that can be bought (by everyone)
     * e.g. only 50 can be bought; user 1 buys 40, user 2 buys 10. no other user can buy anymore.
     * 
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    buyableAmount: number | 'infinite';
    /**
     * the current buyable amount. this value decreases when users buy this item and gets reset to `buyableAmount` 
     * when the shop resets each day at 00:00 UTC.
     */
    currentBuyableAmount: number | 'infinite';
    /** 
     * the amount of this item that can be sold (by everyone) 
     * e.g. only 50 can be sold; user 1 sells 40, user 2 sells 10. no other user can sell anymore.
     * 
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    sellableAmount: number | 'infinite';
    /**
     * the current sellable amount. this value decreases when users sell this item and gets reset to `sellableAmount` 
     * when the shop resets each day at 00:00 UTC.
     */
    currentSellableAmount: number | 'infinite';
    /** the item's buying price (if the user wants to buy 1 of this item) */
    buyingPrice: POIShopItemBuyingPrice;
    /** the item's selling price (what the user can get if they sell 1 of this item) */
    sellingPrice: POIShopItemSellingPrice;
}

/**
 * Represents a player item in a POI's shop.
 */
export interface POIShopPlayerItem {
    /** the item name */
    name: POIShopItemName;
    /**
     * the amount of this item that can be bought by each player respectively.
     * 
     * unlike `buyableAmount` in `POIShopGlobalItem`, this value doesn't decrease when users buy this item.
     * instead, the `boughtAmount` in `userTransactionData` will be updated to check if the user has reached the limit.
     * 
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    buyableAmount: number | 'infinite';
    /**
     * the amount of this item that can be sold by each player respectively.
     * 
     * unlike `sellableAmount` in `POIShopGlobalItem`, this value doesn't decrease when users sell this item.
     * instead, the `soldAmount` in `userTransactionData` will be updated to check if the user has reached the limit.
     * 
     * if 'infinite', then there is no limit to the amount that can be sold until otherwise specified.
     */
    sellableAmount: number | 'infinite';
    /** the item's buying price (if the user wants to buy 1 of this item) */
    buyingPrice: POIShopItemBuyingPrice;
    /** the item's selling price (what the user can get if they sell 1 of this item) */
    sellingPrice: POIShopItemSellingPrice;
    /** 
     * the transaction data for each user for this item.
     * 
     * this includes the amount of this item that has been bought/sold.
     */
    userTransactionData: ShopItemUserTransactionData[];
}

export interface ShopItemUserTransactionData {
    /** the user's database ID */
    userId: string;
    /** the amount of this item that has been bought by this user */
    boughtAmount: number;
    /** the amount of this item that has been sold by this user */
    soldAmount: number;
    // /** 
    //  * the buying limit for this user for this item 
    //  * 
    //  * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
    //  */
    // buyingLimit: number | 'infinite';
    // /** 
    //  * the selling limit for this user for this item 
    //  * 
    //  * if 'infinite', then there is no limit to the amount that can be sold until otherwise specified.
    //  */
    // sellingLimit: number | 'infinite';
}

/**
 * Lists all shop items in cities.
 */
export enum POIShopItemName {
    SEAWEED = BarrenResource.SEAWEED,
    STONE = OreResource.STONE,
    COPPER = OreResource.COPPER,
    IRON = OreResource.IRON,
    SILVER = OreResource.SILVER,
    GOLD = OreResource.GOLD,
    TOMATO = FruitResource.TOMATO,
    APPLE = FruitResource.APPLE,
    STAR_FRUIT = FruitResource.STAR_FRUIT,
    MELON = FruitResource.MELON,
    DRAGON_FRUIT = FruitResource.DRAGON_FRUIT,
    WATER = LiquidResource.WATER,
    MAPLE_SYRUP = LiquidResource.MAPLE_SYRUP,
    HONEY = LiquidResource.HONEY,
    MOONLIGHT_DEW = LiquidResource.MOONLIGHT_DEW,
    PHOENIX_TEAR = LiquidResource.PHOENIX_TEAR,
    CANDY = FoodType.CANDY,
    CHOCOLATE = FoodType.CHOCOLATE,
    JUICE = FoodType.JUICE,
    BURGER = FoodType.BURGER,
    GATHERING_PROGRESS_BOOSTER_10 = BoosterItem.GATHERING_PROGRESS_BOOSTER_10,
    GATHERING_PROGRESS_BOOSTER_25 = BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
    GATHERING_PROGRESS_BOOSTER_50 = BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
    GATHERING_PROGRESS_BOOSTER_100 = BoosterItem.GATHERING_PROGRESS_BOOSTER_100,
    GATHERING_PROGRESS_BOOSTER_200 = BoosterItem.GATHERING_PROGRESS_BOOSTER_200,
    GATHERING_PROGRESS_BOOSTER_300 = BoosterItem.GATHERING_PROGRESS_BOOSTER_300,
    GATHERING_PROGRESS_BOOSTER_500 = BoosterItem.GATHERING_PROGRESS_BOOSTER_500,
    GATHERING_PROGRESS_BOOSTER_1000 = BoosterItem.GATHERING_PROGRESS_BOOSTER_1000,
    GATHERING_PROGRESS_BOOSTER_2000 = BoosterItem.GATHERING_PROGRESS_BOOSTER_2000,
    GATHERING_PROGRESS_BOOSTER_3000 = BoosterItem.GATHERING_PROGRESS_BOOSTER_3000,
    RAFT_SPEED_BOOSTER_1_MIN = BoosterItem.RAFT_SPEED_BOOSTER_1_MIN,
    RAFT_SPEED_BOOSTER_2_MIN = BoosterItem.RAFT_SPEED_BOOSTER_2_MIN,
    RAFT_SPEED_BOOSTER_3_MIN = BoosterItem.RAFT_SPEED_BOOSTER_3_MIN,
    RAFT_SPEED_BOOSTER_5_MIN = BoosterItem.RAFT_SPEED_BOOSTER_5_MIN,
    RAFT_SPEED_BOOSTER_10_MIN = BoosterItem.RAFT_SPEED_BOOSTER_10_MIN,
    RAFT_SPEED_BOOSTER_15_MIN = BoosterItem.RAFT_SPEED_BOOSTER_15_MIN,
    RAFT_SPEED_BOOSTER_30_MIN = BoosterItem.RAFT_SPEED_BOOSTER_30_MIN,
    RAFT_SPEED_BOOSTER_60_MIN = BoosterItem.RAFT_SPEED_BOOSTER_60_MIN,
    TERRA_CAPSULATOR_I = TerraCapsulatorType.TERRA_CAPSULATOR_I,
    TERRA_CAPSULATOR_II = TerraCapsulatorType.TERRA_CAPSULATOR_II,
    BIT_ORB_I = BitOrbType.BIT_ORB_I,
    BIT_ORB_II = BitOrbType.BIT_ORB_II,
    BIT_ORB_III = BitOrbType.BIT_ORB_III
}

/**
 * Represents the buying price of a POI shop item.
 * 
 * Unavailable means that the item is not available to be purchased with that currency. If all are unavailable, the item is not available for purchase.
 */
export interface POIShopItemBuyingPrice {
    xCookies: number | 'unavailable';
    cookieCrumbs: number | 'unavailable';
}

/**
 * Represents the selling price of a POI shop item.
 * 
 * Unavailable means that the item is not available to be sold for that currency. If all are unavailable, the item is not available for sale.
 */
export interface POIShopItemSellingPrice {
    /** leaderboard points (will be divided once more leaderboards are established) */
    leaderboardPoints: number | 'unavailable';
}

/**
 * Represents single or batch buying or selling of a POI shop item.
 */
export interface POIShopActionItemData {
    item: POIShopItemName,
    amount: number,
}