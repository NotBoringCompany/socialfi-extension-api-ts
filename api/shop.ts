import { Food, FoodType } from '../models/food';
import { ShopAsset, ShopAssetType, ShopPackageType } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { shop } from '../utils/shop';
import { ShopAssetModel, ShopAssetPurchaseModel, UserModel } from '../utils/constants/db';
import { Item, ItemType } from '../models/item';
import { generateObjectId } from '../utils/crypto';

/**
 * Fetches all shop assets from the database and return them as a shop instance.
 */
export const getShop = async (): Promise<ReturnValue> => {
    try {
        const shopAssets = await ShopAssetModel.find({}).lean();

        if (!shopAssets || shopAssets.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getShop) Shop not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getShop) Shop fetched.`,
            data: {
                shop: {
                    // exclude `__v` and `_id` from the response
                    assets: shopAssets.map(asset => {
                        return {
                            assetName: asset.assetName,
                            assetType: asset.assetType,
                            price: {
                                xCookies: asset.price.xCookies,
                                usd: asset.price.usd
                            },
                            expirationDate: asset.expirationDate,
                            stockData: asset.stockData,
                            purchaseLimit: asset.purchaseLimit,
                            effectDuration: asset.effectDuration,
                            refreshIntervalData: asset.refreshIntervalData,
                            levelRequirement: asset.levelRequirement,
                            givenContent: asset.givenContent
                        }
                    })
                }
            }
        }
    } catch (err: any) {
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

// export const transferShopToDB = async (): Promise<void> => {
//     try {
//         // for each asset in `shop`, add it to the database
//         for (const asset of shop.items) {
//             const shopAsset = new ShopAssetModel({
//                 _id: generateObjectId(),
//                 assetName: asset.type,
//                 assetType: 'item',
//                 price: {
//                     xCookies: asset.price.xCookies,
//                     usd: 0
//                 },
//                 expirationDate: 'never',
//                 stockData: {
//                     totalStock: 'unlimited',
//                     currentStock: 'unlimited'
//                 },
//                 purchaseLimit: 'unlimited',
//                 effectDuration: 'One Time',
//                 refreshIntervalData: {
//                     intervalType: 'none',
//                     lastRefreshed: Math.floor(Date.now() / 1000),
//                 },
//                 levelRequirement: 'none',
//                 givenContent: {
//                     contentType: 'item',
//                     content: asset.type,
//                     amount: 1
//                 }
//             });

//             await shopAsset.save();
//         }

//         for (const asset of shop.foods) {
//             const shopAsset = new ShopAssetModel({
//                 _id: generateObjectId(),
//                 assetName: asset.type,
//                 assetType: 'food',
//                 price: {
//                     xCookies: asset.price.xCookies,
//                     usd: 0
//                 },
//                 expirationDate: 'never',
//                 purchaseLimit: 'unlimited',
//                 effectDuration: 'One Time',
//                 refreshIntervalData: {
//                     intervalType: 'none',
//                     lastRefreshed: Math.floor(Date.now() / 1000),
//                 },
//                 levelRequirement: 'none',
//                 givenContent: {
//                     contentType: 'food',
//                     content: asset.type,
//                     amount: 1
//                 }
//             });

//             await shopAsset.save();
//         }

//         console.log(`(transferShopToDB) Shop transferred to database.`);
//     } catch (err: any) {
//         console.error(`(transferShopToDB) ${err.message}`);
//     }
// }


/**
 * (User) Purchases `amount` of a shop asset. Requires enough xCookies.
 */
export const purchaseShopAsset = async (
    twitterId: string,
    amount: number,
    asset: ShopAssetType,
    payment: 'xCookies' | 'usd' = 'xCookies',
    // for blockchain txs only; the address the payment was made from.
    address?: string,
    // for blockchain txs only; the chain the payment was made on.
    chain?: string | number,
    // for blockchain txs only; the hex string of the transaction hash (for EVM chains) or the signed BOC (bag of cells; for TON).
    txHash?: string
): Promise<ReturnValue> => {
    if (!twitterId) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(purchaseShopAsset) No twitterId provided.`
        }
    }

    if (!asset) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) No asset provided.`
        }
    }

    if (!amount || amount <= 0) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) Invalid amount provided.`
        }
    }

    const userUpdateOperations = {
        $pull: {},
        $inc: {},
        $set: {},
        $push: {}
    }

    const shopAssetPurchaseUpdateOperations = {
        $pull: {},
        $inc: {},
        $set: {},
        $push: {}
    }

    try {
        let assetPrice = 0;

        // fetch the asset from the database
        const shopAsset = await ShopAssetModel.findOne({ assetName: asset }).lean();

        if (!shopAsset) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Asset not found.`
            }
        }

        // check if asset is expired
        if (shopAsset.expirationDate !== 'never' && shopAsset.expirationDate < Math.floor(Date.now() / 1000)) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Asset is already expired.`
            }
        }

        // check if asset is out of stock
        if (
            shopAsset.stockData.currentStock !== 'unlimited' &&
            (shopAsset.stockData.currentStock <= 0 || shopAsset.stockData.currentStock < amount)
        ) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Not enough stock for purchase.`
            }
        }

        // fetch the user
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) User not found.`
            }
        }

        // if the asset has a level requirement, check if the user meets the requirement
        if (shopAsset.levelRequirement !== 'none' && user.inGameData.level < shopAsset.levelRequirement) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) User does not meet the level requirement for this asset.`
            }
        }

        // check if this asset has a purchase limit. if it has, fetch the ShopAssetPurchases collection and
        // check the amount of times the user has purchased this asset.
        if (shopAsset.purchaseLimit !== 'unlimited') {
            // fetch the user's purchase history of this asset
            const assetPurchaseHistory = await ShopAssetPurchaseModel.find({ userId: user._id, assetId: shopAsset._id }).lean();

            // get the `amount` purchased per asset (i.e. per document)
            const assetPurchaseAmount = assetPurchaseHistory.reduce((acc, curr) => acc + curr.amount, 0);

            console.log(`(purchaseShopAsset) total assets purchased for User ${user.twitterUsername}: ${assetPurchaseAmount}`);
            
            if (assetPurchaseAmount + amount > shopAsset.purchaseLimit) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) User has reached the purchase limit for this asset.`
                }
            }
        }

        // fetch user's xCookies
        const userXCookies = user.inventory?.xCookieData.currentXCookies;

        // check payment type.
        if (payment === 'xCookies') {
            // check if the user has enough xCookies to purchase the asset
            assetPrice = shopAsset.price.xCookies;

            if (userXCookies < (assetPrice * amount)) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Not enough xCookies.`
                }
            }

            // deduct the asset price from the user's xCookies and increment `totalXCookiesSpent` and `weeklyXCookiesSpent`
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -(assetPrice * amount);
            userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = assetPrice * amount;
            userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = assetPrice * amount;
        } else if (payment === 'usd') {
            // not implemented yet.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) USD payment not implemented yet.`
            }
        } else {
            // invalid payment type for now.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Invalid payment type.`
            }
        }

        // check if the asset is an item
        if (shopAsset.assetType === 'item') {
            // add the item to the user's inventory
            const existingItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === asset);

            if (existingItemIndex !== -1) {
                userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = amount;
            } else {
                userUpdateOperations.$push['inventory.items'] = { 
                    type: asset, 
                    amount,
                    totalAmountConsumed: 0,
                    weeklyAmountConsumed: 0
                };
            }
        } else if (shopAsset.assetType === 'food') {
            // add the food to the user's inventory
            const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === asset);

            if (existingFoodIndex !== -1) {
                userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = amount;
            } else {
                userUpdateOperations.$push['inventory.foods'] = { type: asset, amount };
            }
        } else if (shopAsset.assetType === 'package') {
            // not implemented yet.
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) Package purchase not implemented yet.`
            }
        }

        // calculate timestamp of effect expiration.
        // if one time, set to 'never'.
        // if daily, weekly or monthly, set to exactly 1, 7 or 30 days from now.
        // if full daily, full weekly or full monthly, set to 23:59 UTC of the next day, week or month; so in most cases, it will be a bit more than 1, 7 or 30 days.
        const effectExpiration = (): number | 'never' => {
            const now = new Date();

            switch (shopAsset.effectDuration) {
                case 'One Time':
                    return 'never';
                case 'Daily':
                    return Math.floor(now.getTime() / 1000) + 86400;
                case 'Weekly':
                    return Math.floor(now.getTime() / 1000) + 604800;
                case 'Monthly':
                    return Math.floor(now.getTime() / 1000) + 2592000;
                case 'Full Daily':
                    // get the timestamp of 23:59 UTC of the next day
                    const endOfNextDay = new Date(Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate() + 1,
                        23, 59, 0
                    ));
                    return Math.floor(endOfNextDay.getTime() / 1000);
                case 'Full Weekly':
                    // get the timestamp of 23:59 UTC in 7 days
                    const endOf7Days = new Date(Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate() + 7,
                        23, 59, 0
                    ));
                    return Math.floor(endOf7Days.getTime() / 1000);
                case 'Full Monthly':
                    // get the timestamp of 23:59 UTC in 30 days
                    const endOf30Days = new Date(Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate() + 30,
                        23, 59, 0
                    ));

                    return Math.floor(endOf30Days.getTime() / 1000);
                default:
                    return 'never';
            }
        }

        // update the user's inventory and add the purchase to the ShopAssetPurchases collection
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            ShopAssetPurchaseModel.create({
                _id: generateObjectId(),
                userId: user._id,
                assetId: shopAsset._id,
                assetName: shopAsset.assetName,
                amount,
                totalCost: {
                    baseCost: assetPrice * amount,
                    baseCurrency: payment,
                    /// TO DO: right now, payment is only via xCookies. USD is not implemented yet.
                    /// ONCE IMPLEMENTED, actualCost and actualCurrency will include TON, NOT and Telegram Stars and the actual value.
                    actualCost: assetPrice * amount,
                    actualCurrency: payment
                },
                blockchainData: {
                    address,
                    chain,
                    txHash,
                    // txPayload will be added upon verification of the transaction.
                    txPayload: null,
                    // if payment is done via xCookies, then the confirmationAttempts will be ['success'].
                    // else, confirmation will be done immediately after this function.
                    confirmationAttempts: payment === 'xCookies' ? ['success'] : []
                },
                purchaseTimestamp: Math.floor(Date.now() / 1000),
                effectExpiration: effectExpiration(),
                givenContent: shopAsset.givenContent
            })
        ])

        // if stock is not unlimited, decrement the stock of the asset
        if (shopAsset.stockData.totalStock !== 'unlimited') {
            shopAssetPurchaseUpdateOperations.$inc['stockData.currentStock'] = -amount;

            await ShopAssetModel.updateOne({ assetName: asset }, shopAssetPurchaseUpdateOperations);
        }

        /// TO DO:
        /// ADD CONFIRMATION CHECK FOR BLCOCKCHAIN PAYMENTS HERE.

        return {
            status: Status.SUCCESS,
            message: `(purchaseShopAsset) Asset purchased successfully.`,
            data: {
                asset,
                amount,
                payment
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) ${err.message}`
        }
    }
}