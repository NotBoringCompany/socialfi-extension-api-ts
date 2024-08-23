/****************
 * SHOP-RELATED MODELS
 ****************/

import { AssetType } from './asset';
import { FoodType } from './food';
import { ItemType } from './item';
import { TxParsedMessage } from './web3';

/**
 * Represents an asset in the shop.
 */
export interface ShopAsset {
    // the name of the asset
    assetName: string | ShopAssetType;
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
 * Represents an asset in the shop with extended pricing data, which includes the value of the asset in different currencies.
 * 
 * This is only used for purchases with real currency (i.e. USD), which can be converted to, for example, cryptocurrency values.
 * 
 * Mostly used to handle currency conversions in the frontend to get the source of truth for the asset's price in different currencies from the backend.
 */
export interface ShopAssetExtendedPricing extends ShopAsset {
    // the extended price data of the asset in different currencies as required to execute purchases in the frontend.
    extendedPriceData: ShopAssetExtendedPriceData[];
}

export interface ShopAssetExtendedPriceData {
    // the price of the asset in the extended currency
    extendedPrice: number;
    // the extended currency of the asset
    extendedCurrency: string;
}

/**
 * Represents the price of an asset in the shop.
 * 
 * For in-app purchases/purchases with real money, `usd` should exist and NOT be 0, or else it will be considered as an in-game purchase (via virtual currency, i.e. xCookies).
 */
export interface ShopPrice {
    xCookies: number;
    // base USD value of the asset
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
    // lasts 1 day from the date of purchase (exactly)
    DAILY = 'Daily',
    // lasts 1 day on whole day intervals (i.e. until 23:59 UTC of the day)
    FULL_DAILY = 'Full Daily',
    // lasts 1 week from the date of purchase (exactly)
    WEEKLY = 'Weekly',
    // lasts 1 week on whole day intervals (i.e. until 23:59 UTC of the last day of the week)
    FULL_WEEKLY = 'Full Weekly',
    // lasts 1 month from the date of purchase (exactly)
    MONTHLY = 'Monthly',
    // lasts 1 month on whole day intervals (i.e. until 23:59 UTC of the last day of the month)
    FULL_MONTHLY = 'Full Monthly',
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
    content: ItemType | FoodType | 'xCookies' | 'diamonds' | 'monthlyPass';
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
    // if the payment is done via blockchain, this will contain the blockchain data (e.g. which chain the payment was done on, the purchaser's wallet address, etc.)
    // else, this will be null.
    blockchainData: ShopAssetPurchaseBlockchainData;
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
 * Represents the blockchain data of a shop asset purchase.
 * 
 * If the payment was done via xCookies, then this entire instance will be null.
 */
export interface ShopAssetPurchaseBlockchainData {
    // the address used by the user to make the payment
    address: string;
    // the chain the payment was done on (e.g. 'ethereum', 'tron', 'bsc', etc.)
    // also available in number/hex format.
    chain: string | number;
    // the tx hash (or signed BOC for TON payments) of the payment
    txHash: string;
    // the parsed payload message of the transaction
    // this is not required but highly recommended to ensure that the payment contents are correct.
    txPayload: TxParsedMessage;
    // an array of different strings that represent the status of each payment confirmation attempt.
    // because the node providers may be subjected to rate limiting,
    // there may be times where double-checking the `txHash` will result in rate limiting errors.
    // for example, if the first attempt failed due to an api error, then it will be ['apiError'].
    // if the second attempt also failed, then it will be ['apiError', 'apiError'].
    // if the third payment is unsuccessful due to no valid transaction found, then it will be ['apiError', 'apiError', 'noValidTx'].
    // `confirmationAttempts` will stop updating once any result apart from `apiError` or `dbError` is reached.
    // users should NOT receive any items until `success` is reached.
    // if `itemMismatch` was on the array, then items given to the user MAY have to be manually handled/fixed.
    confirmationAttempts: ShopAssetPurchaseConfirmationAttemptType[];
}

/**
 * Represents the different types of shop asset purchase confirmation attempts.
 */
export enum ShopAssetPurchaseConfirmationAttemptType {
    // payment verification successful
    SUCCESS = 'success',
    // error with the API to verify (blockchain)
    API_ERROR = 'apiError',
    // no valid transaction with given params found
    NO_VALID_TX = 'noValidTx',
    // payment sent with the transaction is lower than the required amount to pay for the asset
    PAYMENT_TOO_LOW = 'paymentMismatch',
    // item mismatch between the items given to the user and the items in the payload
    ITEM_MISMATCH = 'itemMismatch',
    // user ID not found in database when verifying
    USER_NOT_FOUND = 'userNotFound',
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
