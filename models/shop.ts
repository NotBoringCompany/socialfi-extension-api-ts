/****************
 * SHOP-RELATED MODELS
 ****************/

import { AssetType } from './asset';
import { FoodType } from './food';
import { ItemType } from './item';

/**
 * Represents an asset in the shop.
 */
export interface ShopAsset {
    // the name of the asset
    assetName: string;
    // the type of asset (e.g. food, item, in-app package, etc.)
    assetType: 'item' | 'food' | 'package';
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
    // if 'unlimited', then there is no limit to the stock of the asset
    totalStock: number | 'unlimited';
    // the current stock of the asset
    currentStock: number | 'unlimited';
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
    // the amount of the asset purchased
    amount: number;
    // the data of the total cost for this purchase
    totalCost: ShopAssetPurchaseTotalCostData;
    // the tx hash (or BOC for TON payments) of the payment
    // if the payment was made in xCookies, then this will be null.
    txHash: string | null;
    // if the payment was already confirmed (double-checked in the backend). xCookie payments are always confirmed.
    // this is mostly for blockchain payments; because the node providers may be subjected to rate limiting,
    // there may be times where double-checking the `txHash` will result in errors.
    // hence, this field is used to confirm that the payment was indeed successful.
    // if `confirmed` is false, then the confirmation will be attempted again later, and repercussions may follow
    // if the payment was indeed not successful. however, the player SHOULD receive the content they paid for initially,
    // even if the payment was not confirmed.
    confirmed: boolean;
    // amount of times the payment confirmation was attempted (to convert `confirmed` to true)
    // up to X tries (TBD), if the payment is not confirmed, then the purchase will be considered unsuccessful,
    // and repercussions may follow (because the user will already have received the content they "paid" for at this point)
    confirmationTries: number;
    // the purchase timestamp (in unix format)
    purchaseTimestamp: number;
    // the expiration timestamp of the asset's effects (in unix format)
    // used primarily for assets with effect durations (like monthly passes, etc)
    // for one-time use assets, this will be set to `never`.
    effectExpiration: number | 'never';
    // the data of the content the player receives after this asset was purchased
    givenContent: ShopAssetGivenContentData;
}

/**
 * Represents the total cost of a shop asset purchase.
 */
export interface ShopAssetPurchaseTotalCostData {
    // the base value of the total cost (e.g. if 400 xCookies, then 400 is the `baseCost`)
    baseCost: number;
    // the base currency of the payment
    baseCurrency: 'xCookies' | 'usd';
    // the actual cost of the payment after converting the currency into the `actualCurrency`.
    // e.g. say a package is worth 10 USD, and the player pays in TON.
    // say 1 TON is worth 6 USD. then, the `actualCost` will be 1.67 (10/6).
    actualCost: number;
    // if `currency` is xCookies, then `actualCurrency` should be xCookies.
    // however, if currency is USD, then `actualCurrency` can be, for instance, TON, NOT or Telegram Stars,
    // because USD is just the base currency which can be converted to other final (actual) currencies.
    actualCurrency: 'xCookies' | string;
}

// all available shop assets
export type ShopAssetType = AssetType | ShopPackageType;
