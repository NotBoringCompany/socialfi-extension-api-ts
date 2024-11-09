import { Food, FoodType } from '../models/food';
import { ShopAsset, ShopAssetCurrencyConversionData, ShopAssetEffectDurationType, ShopAssetExtended, ShopAssetExternalPaymentMethod, ShopAssetIGCPaymentMethod, ShopAssetPaymentMethod, ShopAssetPurchaseConfirmationAttemptType, ShopAssetType, ShopPackageType } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopAssetModel, ShopAssetPurchaseModel, UserModel, WonderpassModel } from '../utils/constants/db';
import { Item, ItemType } from '../models/item';
import { generateObjectId } from '../utils/crypto';
import { fetchIAPTickers, verifyTONTransaction } from './web3';
import { TxParsedMessage } from '../models/web3';
import { DiamondSource, ExtendedDiamondData, ExtendedXCookieData, XCookieSource } from '../models/user';
import { USD_TO_STARS_CONVERSION } from '../utils/constants/tg';
import axios from 'axios';
import { purchasePremiumWonderpass } from './wonderpass';

/**
 * Fetches all shop assets from the database and return them as a shop instance.
 */
export const getShop = async (): Promise<ReturnValue> => {
    try {
        const shopAssets = await ShopAssetModel.find({}).lean() as ShopAsset[];

        if (!shopAssets || shopAssets.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getShop) Shop not found.`
            }
        }

        console.log(`shop assets length: ${shopAssets.length}`);

        const extendedShopAssets: ShopAssetExtended[] = [];

        for (const asset of shopAssets) {
            const currencyConversionData: ShopAssetCurrencyConversionData[] = [];
            // get the final purchasable payment methods for this asset.
            const purchasableWith: ShopAssetPaymentMethod[] = [];

            // if the asset contains a price in USD, check the available payment methods.
            if (asset.price.finalUsd > 0) {
                // if payment method contains card, then no issue, simply add CARD to the purchasableWith array.
                if (asset.availablePaymentMethods.includes(ShopAssetExternalPaymentMethod.CARD)) {
                    purchasableWith.push(ShopAssetExternalPaymentMethod.CARD);
                }

                // if payment methods contain TON and NOT, proceed with fetching the conversion rates.
                if (asset.availablePaymentMethods.includes(ShopAssetExternalPaymentMethod.TON) || asset.availablePaymentMethods.includes(ShopAssetExternalPaymentMethod.NOT)) {
                    // fetch the conversion rates from the API.
                    const { data } = await fetchIAPTickers();

                    // no need to check the status here; if the API is down, then the tickers will be null/0 and the conversion rates will be 0.
                    // in that case, the asset will NOT be purchasable with TON or NOT.
                    const { TONTicker, NOTTicker } = data;

                    if (TONTicker && TONTicker > 0) {
                        purchasableWith.push(ShopAssetExternalPaymentMethod.TON);
                    }

                    if (NOTTicker && NOTTicker > 0) {
                        purchasableWith.push(ShopAssetExternalPaymentMethod.NOT);
                    }

                    // calculate the price in TON and NOT.
                    const priceInTON = asset.price.finalUsd / TONTicker;
                    const priceInNOT = asset.price.finalUsd / NOTTicker;

                    // add the conversion data to the array.
                    currencyConversionData.push(
                        {
                            actualPrice: priceInTON,
                            chosenCurrency: 'TON',
                        },
                        {
                            actualPrice: priceInNOT,
                            chosenCurrency: 'NOT',
                        }
                    )
                }

                if (asset.availablePaymentMethods.includes(ShopAssetExternalPaymentMethod.TELEGRAM_STARS)) {
                    // fetch the price in telegram stars.
                    const stars = USD_TO_STARS_CONVERSION(asset.price.finalUsd);

                    // add the conversion data to the array.
                    currencyConversionData.push({
                        actualPrice: stars,
                        chosenCurrency: 'Telegram Stars'
                    });

                    // just add telegram stars.
                    purchasableWith.push(ShopAssetExternalPaymentMethod.TELEGRAM_STARS);
                }
            }

            // if the asset contains a price in xCookies, simply add it to the extendedShopAssets array.
            if (asset.price.finalXCookies > 0) {
                purchasableWith.push(ShopAssetIGCPaymentMethod.X_COOKIES);
            }

            // if the asset contains a price in diamonds, simply add it to the extendedShopAssets array.
            if (asset.price.finalDiamonds > 0) {
                purchasableWith.push(ShopAssetIGCPaymentMethod.DIAMONDS);
            }

            extendedShopAssets.push({
                assetName: asset.assetName,
                assetType: asset.assetType,
                price: asset.price,
                imageUrl: asset.imageUrl ?? '',
                assetClassification: asset.assetClassification,
                availablePaymentMethods: asset.availablePaymentMethods,
                expirationDate: asset.expirationDate,
                stockData: asset.stockData,
                purchaseLimit: asset.purchaseLimit,
                effectDuration: asset.effectDuration,
                refreshIntervalData: asset.refreshIntervalData,
                levelRequirement: asset.levelRequirement,
                givenContents: asset.givenContents,
                currencyConversionData,
                purchasableWith
            });
        }

        return {
            status: Status.SUCCESS,
            message: `(getShop) Shop fetched.`,
            data: {
                shop: {
                    assets: extendedShopAssets
                }
            }
        }
    } catch (err: any) {
        console.error(`(getShop) ${err.message}`);

        return {
            status: Status.ERROR,
            message: `(getShop) ${err.message}`
        }
    }
}

// export const deleteShopFromDB = async (): Promise<void> => {
//     try {
//         await ShopAssetModel.deleteMany({});
//         console.log(`(deleteShopFromDB) Shop deleted from database.`);
//     } catch (err: any) {
//         console.error(`(deleteShopFromDB) ${err.message}`);
//     }
// }

/**
 * Adds one or more shop assets to the database.
 * 
 * NOTE: No sanitization checks or duplicate asset checks here, so proceed with caution.
 */
export const addShopAssets = async (assets: ShopAsset[]): Promise<void> => {
    try {
        // convert into shop asset models and insert many
        const shopAssets = assets.map(asset => new ShopAssetModel({
            _id: generateObjectId(),
            assetName: asset.assetName,
            assetType: asset.assetType,
            price: asset.price,
            availablePaymentMethods: asset.availablePaymentMethods,
            expirationDate: asset.expirationDate,
            stockData: asset.stockData,
            purchaseLimit: asset.purchaseLimit,
            effectDuration: asset.effectDuration,
            refreshIntervalData: asset.refreshIntervalData,
            levelRequirement: asset.levelRequirement,
            givenContents: asset.givenContents
        }));

        await ShopAssetModel.insertMany(shopAssets);

        console.log(`(addShopAssets) Shop assets added to database.`);
    } catch (err: any) {
        console.error(`(addShopAssets) ${err.message}`);
    }
}

/**
 * (User) Purchases `amount` of a shop asset (can be either an in-game purchase or in-app purchase with real currency).
 */
export const purchaseShopAsset = async (
    twitterId: string,
    // the amount of the asset to purchase (NOTE: this is NOT the same as the amount of the content to be obtained).
    // for example, if a package gives 10 candy and the user purchases 2 (which is the `amount`), then the final amount received is 10 * 2 = 20.
    amount: number,
    asset: ShopAssetType,
    payment: ShopAssetPaymentMethod,
    // for blockchain txs only; the address the payment was made from.
    address?: string,
    // for blockchain txs only; the chain the payment was made on.
    chain?: string | number,
    // for blockchain txs only; the hex string of the transaction hash (for EVM chains) or the signed BOC (bag of cells; for TON)
    txHash?: string,
    // for telegram payments only; the payload of the invoice.
    invoicePayload?: string,
    // for telegram payments only; the telegram payment charge ID.
    telegramPaymentChargeId?: string,
    // for external payments only; the provider payment charge ID.
    providerPaymentChargeId?: string,
): Promise<ReturnValue> => {
    console.log(`(purchaseShopAsset) User ${twitterId} attempting to purchase ${amount} of ${asset} with ${payment}.`);

    const userUpdateOperations = {
        $pull: {},
        $inc: {},
        $set: {},
        $push: {
            'inventory.items': { $each: [] },
            'inventory.foods': { $each: [] },
        }
    }

    const shopAssetPurchaseUpdateOperations = {
        $pull: {},
        $inc: {},
        $set: {},
        $push: {}
    }

    try {
        // check if prerequisites are successful.
        const { status: prerequisitesStatus, message: prerequisitesMessage, data: prerequisitesData } = await purchaseShopAssetPrerequisitesCheck(twitterId, asset, amount);

        if (prerequisitesStatus !== Status.SUCCESS) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Prerequisites check failed: ${prerequisitesMessage}`
            }
        }

        // get the user and shop asset from the prerequisites data
        const user = prerequisitesData.user;
        const shopAsset = prerequisitesData.asset;

        // fetch user's xCookies
        const userXCookies = user.inventory?.xCookieData.currentXCookies;
        // fetch user's diamonds
        const userDiamonds = user.inventory?.diamondData.currentDiamonds;

        // Initialize currentCurrenct value. This will be used to store which current Currency value in used as payment choice
        let currentCurrency: number = 0;
        // to store the total cost of the asset(s).
        let totalCost: number = 0;

        // tx payload for blockchain transactions done if payment === 'usd'.
        // used to store the parsed message body of the transaction in the purchase instance.
        let txPayload: TxParsedMessage | null = null;

        if (payment === ShopAssetIGCPaymentMethod.X_COOKIES) {
            if (shopAsset.price.finalXCookies <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Invalid xCookies price for asset.`
                }
            }

            // Set currentCurrency with xCookies value
            currentCurrency = userXCookies;
            // check if the user has enough xCookies to purchase the asset
            totalCost = shopAsset.price.finalXCookies * amount;

            if (userXCookies < totalCost) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Not enough xCookies to purchase asset(s).`
                }
            }

            // deduct the asset price from the user's xCookies and increment `totalXCookiesSpent` and `weeklyXCookiesSpent`
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -totalCost;
            userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = totalCost;
            userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = totalCost;
        } else if (payment === ShopAssetExternalPaymentMethod.CARD) {
            if (shopAsset.price.finalUsd <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Invalid USD price for asset.`
                }
            }

            totalCost = shopAsset.price.finalUsd * amount;

            // TBD. throw error; not implemented yet.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Card payment not implemented yet.`
            }
        } else if (payment === ShopAssetExternalPaymentMethod.TON || payment === ShopAssetExternalPaymentMethod.NOT) {
            if (shopAsset.price.finalUsd <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Invalid USD price for asset.`
                }
            }

            totalCost = shopAsset.price.finalUsd * amount;

            // verify the transaction.
            const {
                status: verificationStatus,
                message: verificationMessage,
                data: verificationData
            } = await verifyTONTransaction(address, txHash, asset, amount, false, null);

            txPayload = verificationData?.txPayload ?? null;

            // if verification failed (even if API error), return the error message and DON'T proceed with the purchase.
            if (verificationStatus !== Status.SUCCESS) {
                // check the error type. create a new purchase instance and add the error message to the confirmationAttempts.
                // then, return early.
                let confirmationAttempt: ShopAssetPurchaseConfirmationAttemptType;

                // if any of these messages are found, then the transaction is invalid.
                if (
                    verificationMessage.includes('Address not found') ||
                    verificationMessage.includes('BOC not found') ||
                    verificationMessage.includes('Asset name or amount not found/invalid') ||
                    verificationMessage.includes('Purchase ID not found') ||
                    verificationMessage.includes('Purchase not found') ||
                    verificationMessage.includes('Receiver address mismatch')
                ) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.NO_VALID_TX;
                } else if (verificationMessage.includes('Value mismatch')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.PAYMENT_MISMATCH;
                } else if (verificationMessage.includes('Asset mismatch')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.ASSET_MISMATCH;
                } else if (verificationMessage.includes('User not found')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.USER_NOT_FOUND;
                } else if (verificationMessage.includes('API error')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.API_ERROR;
                } else {
                    // also return `NO_VALID_TX` if any other error message is returned.
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.NO_VALID_TX;
                }

                // create a new purchase instance and add the error message to the confirmationAttempts.
                const assetPurchaseId = generateObjectId();

                await ShopAssetPurchaseModel.create({
                    _id: assetPurchaseId,
                    userId: user._id,
                    assetId: shopAsset._id,
                    assetName: shopAsset.assetName,
                    amount,
                    totalCost: {
                        baseCost: shopAsset.price.finalUsd * amount,
                        baseCurrency: 'usd',
                        actualCost: null,
                        actualCurrency: null
                    },
                    blockchainData: {
                        address,
                        chain,
                        txHash,
                        txPayload,
                        confirmationAttempts: [confirmationAttempt]
                    },
                    telegramData: null,
                    purchaseTimestamp: Math.floor(Date.now() / 1000),
                    effectExpiration: 'never',
                    givenContents: shopAsset.givenContents
                });

                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Error from verifyTONTransaction: ${verificationMessage}`
                }
            }

            // one final check - see if the txHash is already used for a different purchase. if yes, return an error.
            const txHashExists = await ShopAssetPurchaseModel.findOne({ 'blockchainData.txHash': txHash }).lean();

            if (txHashExists) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Transaction hash already used for a different purchase.`
                }
            }

            console.log(`(purchaseShopAsset) Transaction verified for User ${twitterId}. Moving on to asset logic.`);

            // at this point, if verification is successful, no need to deduct anything currency-wise because the user has already paid for the asset.
            // simply continue and get out of the if-else block.
        } else if (payment === ShopAssetExternalPaymentMethod.TELEGRAM_STARS) {
            if (shopAsset.price.finalUsd <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Invalid USD price for asset.`
                }
            }

            totalCost = shopAsset.price.finalUsd * amount;

            // TBD. throw error; not implemented yet.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Telegram Stars payment not implemented yet.`
            }
        } else if (payment === ShopAssetIGCPaymentMethod.DIAMONDS) {
            if (shopAsset.price.finalDiamonds <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Invalid diamonds price for asset.`
                }
            }

            // Set currentCurrency with diamonds value
            currentCurrency = userDiamonds;
            // check if the user has enough diamonds to purchase the asset
            totalCost = shopAsset.price.finalDiamonds * amount;

            if (userDiamonds < totalCost) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Not enough diamonds to purchase asset(s).`
                }
            }

            // deduct the asset price from the user's diamonds and increment `totalDiamondsSpent` and `weeklyDiamondsSpent`
            userUpdateOperations.$inc['inventory.diamondData.currentDiamonds'] = -totalCost;
            userUpdateOperations.$inc['inventory.diamondData.totalDiamondsSpent'] = totalCost;
            userUpdateOperations.$inc['inventory.diamondData.weeklyDiamondsSpent'] = totalCost;
        } else {
            totalCost = shopAsset.price.finalUsd * amount;

            // other payments are also TBD. not implemented yet.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Other payment methods not implemented yet.`
            }
        }

        // loop through each of the `givenContents` and give the user the appropriate asset.
        for (const givenContent of shopAsset.givenContents) {
            // check if the asset is an item
            if (givenContent.contentType === 'item') {
                // add the item to the user's inventory
                const existingItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === givenContent.content);

                if (existingItemIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = givenContent.amount * amount;
                } else {
                    userUpdateOperations.$push['inventory.items'].$each.push({
                        type: givenContent.content,
                        amount: givenContent.amount * amount,
                        totalAmountConsumed: 0,
                        weeklyAmountConsumed: 0
                    });
                }
            } else if (givenContent.contentType === 'food') {
                // add the food to the user's inventory
                const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === givenContent.content);

                if (existingFoodIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = (givenContent.amount * amount);
                } else {
                    userUpdateOperations.$push['inventory.foods'].$each.push({ type: givenContent.content, amount: (givenContent.amount * amount) });
                }
            } else if (givenContent.contentType === 'igc') {
                switch (givenContent.content) {
                    case 'xCookies':
                        // add the xCookies to the user's inventory
                        userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = givenContent.amount * amount;

                        // check if the user already has the source `SHOP_PURCHASE` in their extended xCookie data.
                        // if yes, increment the amount, if not, add it to the user's extended xCookie data.
                        const existingSourceIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(d => d.source === XCookieSource.SHOP_PURCHASE);

                        if (existingSourceIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${existingSourceIndex}.xCookies`] = givenContent.amount * amount;
                        } else {
                            userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                                source: XCookieSource.SHOP_PURCHASE,
                                xCookies: givenContent.amount * amount,
                            }
                        }
                    case 'diamonds':
                        // add the diamonds to the user's inventory
                        userUpdateOperations.$inc['inventory.diamondData.currentDiamonds'] = givenContent.amount * amount;

                        // check if the user already has the source `SHOP_PURCHASE` in their extended diamond data.
                        // if yes, increment the amount, if not, add it to the user's extended diamond data.
                        const existingDiamondSourceIndex = (user.inventory?.diamondData.extendedDiamondData as ExtendedDiamondData[]).findIndex(d => d.source === DiamondSource.SHOP_PURCHASE);

                        if (existingDiamondSourceIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.diamondData.extendedDiamondData.${existingDiamondSourceIndex}.diamonds`] = givenContent.amount * amount;
                        } else {
                            userUpdateOperations.$push['inventory.diamondData.extendedDiamondData'] = {
                                source: DiamondSource.SHOP_PURCHASE,
                                diamonds: givenContent.amount * amount,
                            }
                        }
                    // other currencies are TBD. not implemented yet.
                    default:
                        return {
                            status: Status.ERROR,
                            message: `(purchaseShopAsset) Other currencies not implemented yet.`
                        }
                }
            } else if (givenContent.contentType === 'wonderpass') {
                // call `purchasePremiumWonderpass`
                // WARNING: payment will be done on the block below, so if there is a problem with the final part of the operations,
                // users MAY get the premium wonderpass for free. we will need to check this.
                const { status, message, data } = await purchasePremiumWonderpass(twitterId);

                if (status !== Status.SUCCESS) {
                    return {
                        status: Status.ERROR,
                        message: `(purchaseShopAsset) Error in purchasing Wonderpass: ${message}`
                    }
                }
            }
        }

        // calculate timestamp of effect expiration.
        const effectExpiration = (): number | 'never' => {
            // if effect duration is null, then the effect is a one-time effect. set to 'never'.
            if (!shopAsset.effectDuration) {
                return 'never';
            }

            // if effect duration type is `DURATION_BASED`, then add the current timestamp by the `value`.
            if (shopAsset.effectDuration.durationType === ShopAssetEffectDurationType.DURATION_BASED) {
                return Math.floor(Date.now() / 1000) + shopAsset.effectDuration.value;
            }

            // if effect duration type is `UNTIL`, then the effect expiration will be on `value`.
            if (shopAsset.effectDuration.durationType === ShopAssetEffectDurationType.UNTIL) {
                return shopAsset.effectDuration.value;
            }

            // default to `never` just in case for other cases.
            return 'never';
        }

        // if stock is not unlimited, decrement the stock of the asset
        if (shopAsset.stockData.totalStock !== 'unlimited') {
            // only decrement amount if `currentStock` is not unlimited.
            if (shopAsset.stockData.currentStock !== 'unlimited') {
                shopAssetPurchaseUpdateOperations.$inc['stockData.currentStock'] = -amount;

                await ShopAssetModel.updateOne({ assetName: asset }, shopAssetPurchaseUpdateOperations);
            }
        }

        console.log(`(purchaseShopAsset) User ${twitterId} update operations: ${JSON.stringify(userUpdateOperations, null, 2)}`);

        // update the user's inventory and add the purchase to the ShopAssetPurchases collection
        // divide the update operations into $set + $inc and $push and $pull for UserModel
        await Promise.all([
            UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            }),
            ShopAssetPurchaseModel.create({
                _id: generateObjectId(),
                userId: user._id,
                assetId: shopAsset._id,
                assetName: shopAsset.assetName,
                amount,
                totalCost: {
                    baseCost: totalCost,
                    baseCurrency: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod)
                        ? 'xCookies' 
                        : 'usd',
                    // include the txPayload cost only if payment is NOT via an in-game currency.
                    actualCost: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod)
                        ? totalCost
                        : txPayload?.cost,
                    // include the txPayload currency only if payment is NOT via an in-game currency, else set equal to the in-game currency.
                    actualCurrency: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod)
                        ? payment
                        : txPayload?.curr
                },
                blockchainData: txHash && address && chain ? {
                    address,
                    chain,
                    txHash,
                    txPayload,
                    confirmationAttempts: [ShopAssetPurchaseConfirmationAttemptType.SUCCESS]
                } : null,
                telegramData: invoicePayload && telegramPaymentChargeId && providerPaymentChargeId ? {
                    invoicePayload,
                    telegramPaymentChargeId,
                    providerPaymentChargeId,
                    confirmationAttempts: [ShopAssetPurchaseConfirmationAttemptType.SUCCESS]
                } : null,
                purchaseTimestamp: Math.floor(Date.now() / 1000),
                effectExpiration: effectExpiration(),
                givenContents: shopAsset.givenContents
            })
        ]);

        await UserModel.updateOne({ twitterId }, {
            $push: userUpdateOperations.$push,
            $pull: userUpdateOperations.$pull
        });

        return {
            status: Status.SUCCESS,
            message: `(purchaseShopAsset) Asset purchased successfully.`,
            data: {
                twitterId: twitterId,
                asset: asset,
                amount: amount,
                totalPaid: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod)
                    ? totalCost
                    : txPayload?.cost,
                paymentChoice: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod)
                    ? payment
                    : txPayload?.curr,
                address: address ?? null,
                chain: chain ?? null,
                txHash: txHash ?? null,
                txPayload: txPayload ?? null,
                userCurrency: typeof payment === 'string' && Object.values(ShopAssetIGCPaymentMethod).includes(payment as ShopAssetIGCPaymentMethod) ? {
                    currentValue: currentCurrency,
                    updatedValue: Math.max(currentCurrency - totalCost, 0),
                } : null,
                invoicePayload: invoicePayload ?? null,
                telegramPaymentChargeId: telegramPaymentChargeId ?? null,
                providerPaymentChargeId: providerPaymentChargeId ?? null,
            }
        }
    } catch (err: any) {
        console.error(`(purchaseShopAsset) Error for User ${twitterId} ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) ${err.message}`
        }
    }
}

/**
 * Checks to ensure that a shop asset purchase can be done given some requirements.
 * 
 * Used directly inside `purchaseShopAsset` as well as independently when purchasing via Telegram Stars (since it won't use `purchaseShopAsset`).
 */
export const purchaseShopAssetPrerequisitesCheck = async (
    twitterOrTelegramId: string,
    asset: ShopAssetType,
    amount: number,
): Promise<ReturnValue> => {
    if (!twitterOrTelegramId) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(purchaseShopAssetPrerequisitesCheck) No telegramId provided.`
        }
    }

    if (!asset) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAssetPrerequisitesCheck) No asset provided.`
        }
    }

    if (!amount || amount <= 0) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAssetPrerequisitesCheck) Invalid amount provided.`
        }
    }

    try {
        const shopAsset = await ShopAssetModel.findOne({ assetName: asset }).lean();

        if (!shopAsset) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAssetPrerequisitesCheck) Asset not found.`
            }
        }

        // check if asset is expired
        if (shopAsset.expirationDate !== 'never' && shopAsset.expirationDate < Math.floor(Date.now() / 1000)) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAssetPrerequisitesCheck) Asset is already expired.`
            }
        }

        // check if asset is out of stock
        if (
            shopAsset.stockData.currentStock !== 'unlimited' &&
            (shopAsset.stockData.currentStock <= 0 || shopAsset.stockData.currentStock < amount)
        ) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAssetPrerequisitesCheck) Not enough stock for purchase.`
            }
        }

        // fetch the user
        // the telegram id can be in the `twitterId` field or `telegramProfile.telegramId` field.
        // we need to check either or.
        const user = await UserModel.findOne({ $or: [{ twitterId: twitterOrTelegramId }, { 'telegramProfile.telegramId': twitterOrTelegramId }] }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAssetPrerequisitesCheck) User not found.`
            }
        }

        // if the asset has a level requirement, check if the user meets the requirement
        if (shopAsset.levelRequirement !== 'none' && user.inGameData.level < shopAsset.levelRequirement) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAssetPrerequisitesCheck) User does not meet the level requirement for this asset.`
            }
        }

        // check if this asset has a purchase limit. if it has, fetch the ShopAssetPurchases collection and
        // check the amount of times the user has purchased this asset.
        if (shopAsset.purchaseLimit !== 'unlimited') {
            // fetch the user's purchase history of this asset
            const assetPurchaseHistory = await ShopAssetPurchaseModel.find({ userId: user._id, assetId: shopAsset._id }).lean();

            // get the `amount` purchased per asset (i.e. per document)
            const assetPurchaseAmount = assetPurchaseHistory.reduce((acc, curr) => acc + curr.amount, 0);

            console.log(`(purchaseShopAssetPrerequisitesCheck) total assets purchased for User ${user.twitterUsername}: ${assetPurchaseAmount}`);

            if (assetPurchaseAmount + amount > shopAsset.purchaseLimit) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAssetPrerequisitesCheck) User has reached the purchase limit for this asset.`
                }
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(purchaseShopAssetPrerequisitesCheck) Prerequisites check successful.`,
            data: {
                user: user,
                asset: shopAsset
            }
        }
    } catch (err: any) {
        console.error(`(purchaseShopAssetPrerequisitesCheck) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(purchaseShopAssetPrerequisitesCheck) ${err.message}`
        }
    }
}

/**
 * Sends an invoice to a user attempting to purchase an asset with Telegram Stars.
 * 
 * Once the invoice is paid, the user SHOULD receive the asset.
 */
export const sendTelegramStarsInvoice = async (
    asset: ShopAssetExtended,
    chatId: string,
): Promise<ReturnValue> => {
    try {
        // double check to see if the asset matches with the asset on the database.
        const dbAsset = await ShopAssetModel.findOne({ assetName: asset.assetName }).lean();

        if (!dbAsset) {
            return {
                status: Status.ERROR,
                message: `(sendTelegramStarsInvoice) Asset not found.`
            }
        }

        // to ensure that only legit data is sent to the Telegram API, the asset data is fetched from the database.
        const payload = {
            chat_id: chatId,
            title: dbAsset.assetName,
            description: dbAsset.assetName,
            // TO DO: cost in telegram stars (need the API).
            payload: `"asset":"${dbAsset.assetName}","amt":1,"cost":"${USD_TO_STARS_CONVERSION(dbAsset.price.finalUsd)} TG Stars","curr":"TG Stars"`,
            provider_token: '',
            // currency for telegram stars
            currency: 'XTR',
            prices: [
                {
                    label: 'USD',
                    // needs to be converted into the smallest units of the currency (e.g. cents for USD). so multiply by 100.
                    amount: dbAsset.price.finalUsd * 100,
                }
            ]
        }

        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`;

        console.log(`(sendTelegramStarsInvoice) Sending invoice to Telegram API: ${url}`);

        const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`, payload);

        console.log('response.data: ', response.data);

        // send a message saying the invoice will be deleted after 10 minutes.
        const reminderResponse = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `This invoice will be deleted after 10 minutes. Please ensure to pay within the given time.`
        });

        // delete invoice and reminder message after 10 seconds
        setTimeout(async () => {
            console.log(`(sendTelegramStarsInvoice) Deleting invoice after 10 minutes.`);

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                chat_id: chatId,
                message_id: response.data.result.message_id
            });

            // also delete the reminder message
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                chat_id: chatId,
                message_id: reminderResponse.data.result.message_id
            });

        }, 600000);

        return {
            status: Status.SUCCESS,
            message: `(sendTelegramStarsInvoice) Invoice sent successfully.`,
            data: response.data
        }
    } catch (err: any) {
        console.error(`(sendTelegramStarsInvoice) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(sendTelegramStarsInvoice) ${err.message}`
        }
    }
}