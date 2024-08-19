/****************
 * SHOP-RELATED MODELS
 ****************/

import { FoodType } from './food';
import { ItemType } from './item';

/**
 * Represents an asset in the shop.
 */
export interface ShopAsset {
    // the name of the asset
    assetName: string;
    // the type of asset (e.g. food, item, etc.)
    assetType: ItemType | FoodType | ShopPackageType;
    // the price of the asset
    price: ShopPrice;
    // when the asset will be purchasable until (in unix timestamp)
    // if 'never', then it will be available forever, i.e. no expiration date
    expirationDate: number | 'never';
    // the stock data of the asset
    stockData: ShopAssetStockData;
    // the limit of how many of this asset can be purchased per account
    // if 'unlimited', then there is no limit
    purchaseLimit: number | 'unlimited';
    // the effect of the asset
    // for example, if an asset has a `DAILY` effect duration, the effect given by the `givenContent` will last for 24 hours from the date of purchase.
    effectDuration: ShopAssetEffectDurationType;
    // the refresh interval of the asset
    refreshIntervalData: ShopAssetRefreshIntervalData;
    // the level requirement of the asset
    // if 'none', then players of any level can purchase this asset
    levelRequirement: number | 'none';
    // the data of the content the player receives upon purchasing this asset
    givenContent: ShopAssetGivenContentData;
}

/**
 * Represents the price of an asset in the shop.
 * 
 * For in-app purchases, `usd` should exist and NOT be 0, or else it will be considered as an in-game purchase (via virtual currency, i.e. xCookies).
 */
export interface ShopPrice {
    xCookies: number;
    usd?: number;
}

/**
 * Represents the stock data of a shop asset.
 */
export interface ShopAssetStockData {
    // the total stock of the asset 
    // (this will be the amount `currentStock` will be reset to when the asset is refreshed)
    totalStock: number;
    // the current stock of the asset
    currentStock: number;
}

/**
 * Lists the different effect durations of a shop asset.
 */
export enum ShopAssetEffectDurationType {
    // one time use; no effect duration 
    // (used mainly for assets that give users content directly, like currencies, food, items, etc.)
    ONE_TIME = 'One Time',
    DAILY = 'Daily',
    WEEKLY = 'Weekly',
    // lasts 1 month from the date of purchase
    MONTHLY = 'Monthly',
    // unlike `MONTHLY`, MONTHLY_PASS will only be available until the end of the month it was purchased in
    MONTHLY_PASS = 'Monthly Pass',
}

/**
 * Represents the refresh interval data of a shop asset.
 */
export interface ShopAssetRefreshIntervalData {
    // the type of refresh interval
    // for instance, 'daily' means that the asset's stock can be refreshed daily back to its `totalStock`
    // if 'none', then the asset's stock will not be refreshed or has to be refreshed manually.
    intervalType: 'daily' | 'weekly' | 'monthly' | 'none';
    // when the asset's stock was last refreshed (in unix timestamp)
    lastRefreshed: number;
}

/**
 * Represents the content data that a shop asset gives to the player.
 */
export interface ShopAssetGivenContentData {
    // the type of content. used to easily identify and handle operations for the content given by the asset.
    contentType: 'item' | 'food' | 'xCookies' | 'monthlyPass';
    // the actual content that the asset gives to the player
    content: ItemType | FoodType | 'xCookies' | 'diamonds';
    // the amount of content that the asset gives to the player
    // for monthly passes and other non-quantity-based content, this will be 1
    amount: number;
}

/**
 * A list of packages that can be bought in the shop.
 * 
 * These can range from monthly passes, special event packages, bundles, etc.
 */
export enum ShopPackageType {
    POUCH_OF_ENERGY_POTIONS = 'Pouch of Energy Potions',
}

/**
 * Represents a purchase made in the shop by a user.
 */
export interface ShopAssetPurchase {
    // the user's (who purchased the asset) database object ID 
    userId: string;
    // the purchased asset's database object ID
    assetId: string;
    // the purchased asset's name (for extra reference)
    assetName: string;
    // the purchase timestamp (in unix format)
    purchaseTimestamp: number;
    // the expiration timestamp of the asset's effects (in unix format)
    // used primarily for assets with effect durations (like monthly passes, etc)
    // for one-time use assets, this will be set to `never`.
    effectExpiration: number | 'never';
    // the data of the content the player receives after this asset was purchased
    givenContent: ShopAssetGivenContentData;
}
