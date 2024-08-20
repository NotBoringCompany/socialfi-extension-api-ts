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
    payment: 'xCookies' | 'usd' = 'xCookies'
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

            if (assetPurchaseHistory.length >= shopAsset.purchaseLimit) {
                return {
                    status: Status.ERROR,
                    message: `(purchaseShopAsset) Purchase limit reached for this asset.`
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

        // update the user's inventory and add the purchase to the ShopAssetPurchases collection
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            ShopAssetPurchaseModel.create({
                userId: user._id,
                assetId: shopAsset._id,
                assetName: shopAsset.assetName,
                amount,
                totalCost: {
                    cost: assetPrice * amount,
                    currency: payment,
                    /// TO DO: right now, payment is only via xCookies. USD is not implemented yet.
                    /// ONCE IMPLEMENTED, paidInCurrency will include TON, NOT and Telegram Stars.
                    paidInCurrency: payment
                },
                purchaseTimestamp: Math.floor(Date.now() / 1000),
                // if asset is monthly pass, effect expires at 23:59 UTC at the end of this month.
                // otherwise, just add the effect duration to the current timestamp.
                effectExpiration: 
                    shopAsset.effectDuration === 'Monthly Pass' ? 
                        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).getTime() / 1000 : 
                        Math.floor(Date.now() / 1000) + shopAsset.effectDuration,
                givenContent: shopAsset.givenContent
            })
        ])

        // if stock is not unlimited, decrement the stock of the asset
        if (shopAsset.stockData.totalStock !== 'unlimited') {
            shopAssetPurchaseUpdateOperations.$inc['stockData.currentStock'] = -amount;

            await ShopAssetModel.updateOne({ assetName: asset }, shopAssetPurchaseUpdateOperations);
        }

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