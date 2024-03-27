import { Resource } from './resource';

/**
 * Represents a city.
 */
export interface City {
    /** the city name */
    name: CityName;
    /** the time it takes to travel to another city (in seconds) from this city */
    travelTimeTo: {
        [destination in CityName]?: number;
    }
    /** the city's shop */
    shop: CityShop;
}

/**
 * Lists all city names.
 */
export enum CityName {
    HOME = 'Home',
    EVERGREEN_VILLAGE = 'Evergreen Village',
    PALMSHADE_VILLAGE = 'Palmshade Village',
    SEABREEZE_HARBOR = 'Seabreeze Harbor',
    STARFALL_SANCTUARY = 'Starfall Sanctuary',
}

/**
 * Represents a city's shop.
 */
export interface CityShop {
    /** all global items that can be bought by everyone */
    globalItems: CityShopGlobalItem[];
    /** 
     * all player items that can be bought by each player respectively.
     * currently, each player should see the same items on the shop. however, the exact amount limit that can be bought (or sold) may differ per player.
     * e.g. player 1 can buy 10 of item A, player 2 can buy 20 of item A.
     */
    playerItems: CityShopPlayerItem[];
}

/**
 * Represents a global item in a city's shop.
 */
export interface CityShopGlobalItem {
    /** the item name */
    name: CityShopItemName;
    /** 
     * the amount of this item that can be bought (by everyone)
     * e.g. only 50 can be bought; user 1 buys 40, user 2 buys 10. no other user can buy anymore.
     */
    buyableAmount: number;
    /** 
     * the amount of this item that can be sold (by everyone) 
     * e.g. only 50 can be sold; user 1 sells 40, user 2 sells 10. no other user can sell anymore.
     */
    sellableAmount: number;
    /** the item's buying price (if the user wants to buy 1 of this item) */
    buyingPrice: CityShopItemBuyingPrice[];
    /** the item's selling price (what the user can get if they sell 1 of this item) */
    sellingPrice: CityShopItemSellingPrice[];
}

/**
 * Represents a player item in a city's shop.
 */
export interface CityShopPlayerItem {
    /** the item name */
    name: CityShopItemName;
    /** the item's buying price (if the user wants to buy 1 of this item) */
    buyingPrice: CityShopItemBuyingPrice[];
    /** the item's selling price (what the user can get if they sell 1 of this item) */
    sellingPrice: CityShopItemSellingPrice[];
    /** 
     * the transaction data for each user for this item.
     * 
     * this includes the amount of this item that has been bought/sold, and the buying/selling limit for each user for this item.
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
    /** the buying limit for this user for this item */
    buyingLimit: number;
    /** the selling limit for this user for this item */
    sellingLimit: number;
}

/**
 * Lists all shop items in cities.
 */
export enum CityShopItemName {
    SEAWEED = 'Seaweed',
    STONE = 'Stone',
    COPPER = 'Copper',
    IRON = 'Iron',
    SILVER = 'Silver',
    GOLD = 'Gold',
    BLUEBERRY = 'Blueberry',
    APPLE = 'Apple',
    STAR_FRUIT = 'Star Fruit',
    MELON = 'Melon',
    DRAGON_FRUIT = 'Dragon Fruit',
    WATER = 'Water',
    MAPLE_SYRUP = 'Maple Syrup',
    HONEY = 'Honey',
    MOONLIGHT_DEW = 'Moonlight Dew',
    PHOENIX_TEAR = 'Phoenix Tear',
}

/**
 * Represents the buying price of a city shop item.
 * 
 * Unavailable means that the item is not available to be purchased with that currency. If all are unavailable, the item is not available for purchase.
 */
export interface CityShopItemBuyingPrice {
    xCookies: number | 'unavailable';
    cookieCrumbs: number | 'unavailable';
}

/**
 * Represents the selling price of a city shop item.
 * 
 * Unavailable means that the item is not available to be sold for that currency. If all are unavailable, the item is not available for sale.
 */
export interface CityShopItemSellingPrice {
    /** leaderboard points (will be divided once more leaderboards are established) */
    leaderboardPoints: number | 'unavailable';
}