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
     * the amount of this item that can be sold (by everyone) 
     * e.g. only 50 can be sold; user 1 sells 40, user 2 sells 10. no other user can sell anymore.
     * 
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    sellableAmount: number | 'infinite';
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
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    buyableAmount: number | 'infinite';
    /**
     * the amount of this item that can be sold by each player respectively.
     * 
     * if 'infinite', then there is no limit to the amount that can be sold until otherwise specified.
     */
    sellableAmount: number | 'infinite';
    /** the item's buying price (if the user wants to buy 1 of this item) */
    buyingPrice: POIShopItemBuyingPrice;
    /** the item's selling price (what the user can get if they sell 1 of this item) */
    sellingPrice: POIShopItemSellingPrice;
    // WILL BE USED IN FUTURE SEASONS.
    // /** 
    //  * the transaction data for each user for this item.
    //  * 
    //  * this includes the amount of this item that has been bought/sold, and the buying/selling limit for each user for this item.
    //  */
    // userTransactionData: ShopItemUserTransactionData[];
}

export interface ShopItemUserTransactionData {
    /** the user's database ID */
    userId: string;
    /** the amount of this item that has been bought by this user */
    boughtAmount: number;
    /** the amount of this item that has been sold by this user */
    soldAmount: number;
    /** 
     * the buying limit for this user for this item 
     * 
     * if 'infinite', then there is no limit to the amount that can be bought until otherwise specified.
     */
    buyingLimit: number | 'infinite';
    /** 
     * the selling limit for this user for this item 
     * 
     * if 'infinite', then there is no limit to the amount that can be sold until otherwise specified.
     */
    sellingLimit: number | 'infinite';
}

/**
 * Lists all shop items in cities.
 */
export enum POIShopItemName {
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
    CANDY = 'Candy',
    CHOCOLATE = 'Chocolate',
    JUICE = 'Juice',
    BURGER = 'Burger',
    TERRA_CAPSULATOR = 'Terra Capsulator',
    BIT_ORB = 'Bit Orb',
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