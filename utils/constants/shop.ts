import Bull from 'bull';
import { ShopAssetModel, ShopAssetPurchaseModel, UserModel } from './db';
import { Status } from '../retVal';
import { purchasePremiumWonderpass } from '../../api/wonderpass';
import { ShopAssetEffectDurationType, ShopAssetIGCPaymentMethod, ShopAssetPurchaseConfirmationAttemptType } from '../../models/shop';
import { DiamondSource, ExtendedDiamondData, ExtendedXCookieData, XCookieSource } from '../../models/user';
import { Food } from '../../models/food';
import { Item } from '../../models/item';
import { generateObjectId } from '../crypto';

/**
 * Creates a new Bull instance for shop asset purchases and processing.
 */
export const SHOP_QUEUE = new Bull('shopQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Whenever an invoice is successfully paid with Telegram Stars, deliver the assets to the user.
 */
SHOP_QUEUE.process('deliverShopAssetViaSuccessfulTelegramStarsPayment', async (job) => {
    const { shopAsset: shopAssetName, amount, chatId, userId, invoicePayload, telegramPaymentChargeId, providerPaymentChargeId } = job.data;

    console.log(`Delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}`);

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

    if (!invoicePayload || !telegramPaymentChargeId || !providerPaymentChargeId) {
        return {
            status: Status.ERROR,
            message: `(deliverShopAssetViaSuccessfulTelegramStarsPayment) Missing required parameters for Telegram Stars payment.`
        }
    }

    try {
        // a user that has only logged in with telegram will have their ID stored in `twitterId`
        // if they logged in with both telegram and twitter, it will be stored in `telegramProfile.telegramId`.
        // therefore, the query will need to check either (or) of these fields.
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { 'telegramProfile.telegramId': userId }] });

        if (!user) {
            throw new Error(`User not found for user ID ${userId}`);
        }

        // check what the shop asset gives us
        const shopAsset = await ShopAssetModel.findOne({ assetName: shopAssetName });

        if (!shopAsset) {
            throw new Error(`Shop asset not found for asset name ${shopAssetName}`);
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
                const { status, message, data } = await purchasePremiumWonderpass(user.twitterId);

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

                await ShopAssetModel.updateOne({ assetName: shopAssetName }, shopAssetPurchaseUpdateOperations);
            }
        } 

        // update the user's inventory and add the purchase to the ShopAssetPurchases collection
        // divide the update operations into $set + $inc and $push and $pull for UserModel
        await Promise.all([
            UserModel.updateOne({ twitterId: user.twitterId }, {
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
                    baseCost: shopAsset.price.finalUsd * amount,
                    baseCurrency: 'usd',
                    actualCost: shopAsset.price.finalUsd * amount,
                    actualCurrency: 'usd',
                },
                blockchainData: null,
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

        await UserModel.updateOne({ twitterId: user.twitterId }, {
            $push: userUpdateOperations.$push,
            $pull: userUpdateOperations.$pull
        });

        console.log(`Delivered shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}`);

        return;
    } catch (err: any) {
        console.error(`(deliverShopAssetViaSuccessfulTelegramStarsPayment) Error delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}: ${err.message}`);
        throw new Error(`(deliverShopAssetViaSuccessfulTelegramStarsPayment) Error delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}: ${err.message}`);
    }
});