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
    // the image URL of the asset (for rendering in the frontend)
    // if none, then a default one will be provided in the frontend
    // used mostly for IAP asset backgrounds to differentiate the various categories of IAP assets
    imageUrl: string;
    // the asset's classification.
    // this is mostly used in the frontend, where assets can be classified into non-IAP and IAP, and within IAP into more subcategories.
    // mostly for rendering classification purposes.
    assetClassification: ShopAssetClassification;
    // base available payment methods for the asset
    // final available payment methods will depend on ShopAssetExtended.purchasableWith, depending on if
    // the currency conversion data was successfully fetched, for example.
    availablePaymentMethods: ShopAssetPaymentMethod[];
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
    // the data of the contents the player receives upon purchasing this asset
    givenContents: ShopAssetGivenContentData[];
}

/**
 * Represents the classification of a shop asset.
 */
export enum ShopAssetClassification {
    // non-IAP asset
    NON_IAP = 'nonIAP',
    // special assets with lower/base value for IAP, rendered with a base component (e.g. with just a background)
    SPECIAL_BASE_IAP = 'specialBaseIAP',
    // special higher value assets for IAP, rendered with a special component (e.g. showcasing its contents, with extra sparkling components, etc.)
    SPECIAL_VALUE_IAP = 'specialValueIAP',
    // smaller value/normal in-app purchase assets that will be rendered in smaller components
    NORMAL_IAP = 'normalIAP',
}

/**
 * Represents the different payment methods available for a shop asset with OUR in-game currencies.
 */
export enum ShopAssetIGCPaymentMethod {
    X_COOKIES = 'xCookies',
}

/**
 * Represents the different payment methods available for a shop asset with real or external in-game currencies.
 * 
 * This will be combined into the term 'external payment', where payments via crypto, real money, or external IGCs like Telegram Stars can be made.
 * 
 * They are technically treated as 'real currencies'.
 */
export enum ShopAssetExternalPaymentMethod {
    // main payment for telegram
    TELEGRAM_STARS = 'Telegram Stars',
    // debit card, credit card, etc.
    CARD = 'Card',
    TON = 'TON',
    NOT = 'NOT',
}

/**
 * Represents the different payment methods available for a shop asset.
 */
export type ShopAssetPaymentMethod = ShopAssetIGCPaymentMethod | ShopAssetExternalPaymentMethod;

/**
 * Represents an asset in the shop with extended data, which includes the value of the asset in different currencies and the final payment methods usable for the asset purchase.
 * 
 * This is only used for purchases with real currency (i.e. USD), which can be converted to, for example, cryptocurrency values.
 * 
 * Mostly used to handle currency conversions in the frontend to get the source of truth for the asset's price in different currencies from the backend.
 * 
 * If there are API issues, then `purchasableWith` will only contain the payment methods that were successfully fetched.
 */
export interface ShopAssetExtended extends ShopAsset {
    // the currency conversion of the asset into different currencies as required to execute purchases in the frontend.
    currencyConversionData: ShopAssetCurrencyConversionData[];
    // final payment methods that the asset can be purchased with
    // this is after checking if `currencyConversionData` has the required currency/currencies to purchase the asset.
    // for instance, if the asset can be purchased with TON and NOT, and currencyConversionData only has TON (bc let's say NOT wasn't able to be fetched),
    // then only TON will be in `purchasableWith`.
    purchasableWith: ShopAssetPaymentMethod[];
}

/**
 * Represents the extended price data of a shop asset (currency conversion data).
 */
export interface ShopAssetCurrencyConversionData {
    // the price of the asset in the `chosenCurrency`
    actualPrice: number;
    // the chosen currency to represent the conversion from the base currency (USD) to this currency
    chosenCurrency: string;
}

/**
 * Represents the price of an asset in the shop.
 * 
 * For in-app purchases/purchases with real money, `usd` should exist and NOT be 0, or else it will be considered as an in-game purchase (via virtual currency, i.e. xCookies).
 */
export interface ShopPrice {
    // the base price of the asset in xCookies
    xCookies: number;
    // the final price of the asset in xCookies after discounts (if no discount, then this will be the same as `xCookies`)
    // this will be the price used for the final purchase
    finalXCookies?: number;
    // base non-discounted USD value of the asset
    usd?: number;
    // final USD value of the asset. if discounted, this should be lower than `usd`.
    // this will be the USD-based price used for the final purchase.
    finalUsd?: number;
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
    // igc = in-game currency.
    contentType: 'item' | 'food' | 'igc' | 'monthlyPass';
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
    // test package
    TEST_CANDY_PACKAGE = 'Test Candy Package',
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
    // the data of the contents the player receives after this asset was purchased
    givenContents: ShopAssetGivenContentData[];
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
    // the tx hash (for TON payments: the converted hash from the signed BOC) of the payment
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
    PAYMENT_MISMATCH = 'paymentMismatch',
    // asset mismatch between the asset/contents given to the user and the asset purchased in the payload
    ASSET_MISMATCH = 'assetMismatch',
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
    actualCurrency: ShopAssetPaymentMethod | string;
}

// all available shop assets
export type ShopAssetType = AssetType | ShopPackageType;
