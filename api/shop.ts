import { Food, FoodType } from '../models/food';
import { ShopAsset, ShopPackageType } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { shop } from '../utils/shop';
import { ShopAssetModel, UserModel } from '../utils/constants/db';
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

// /**
//  * (User) Purchases `amount` of a shop asset. Requires enough xCookies.
//  */
// export const purchaseShopAsset = async (
//     twitterId: string,
//     amount: number,
//     asset: ShopAsset
// ): Promise<ReturnValue> => {
//     if (!twitterId) {
//         return {
//             status: Status.UNAUTHORIZED,
//             message: `(purchaseShopAsset) No twitterId provided.`
//         }
//     }

//     if (!asset) {
//         return {
//             status: Status.ERROR,
//             message: `(purchaseShopAsset) No asset provided.`
//         }
//     }

//     const userUpdateOperations = {
//         $pull: {},
//         $inc: {},
//         $set: {},
//         $push: {}
//     }

//     try {
//         // since prices are currently only available in xCookies, we dont check for other payment methods
//         let assetPrice = 0;

//         // check if the asset specified exists in `shop.items` or `shop.foods`
//         const shopItem = shop.items.find(i => i.type === asset);
//         const shopFood = shop.foods.find(f => f.type === asset);

//         if (!shopItem && !shopFood) {
//             return {
//                 status: Status.ERROR,
//                 message: `(purchaseShopAsset) Asset not found.`
//             }
//         }

//         // fetch user
//         const user = await UserModel.findOne({ twitterId }).lean();

//         if (!user) {
//             return {
//                 status: Status.ERROR,
//                 message: `(purchaseShopAsset) User not found.`
//             }
//         }

//         // fetch user's xCookies
//         const userXCookies = user.inventory?.xCookieData.currentXCookies;

//         // check if the user has enough xCookies to purchase the asset
//         if (shopItem) {
//             assetPrice = shopItem.price.xCookies;
//         } else {
//             assetPrice = shopFood.price.xCookies;
//         }

//         if (userXCookies < (assetPrice * amount)) {
//             return {
//                 status: Status.ERROR,
//                 message: `(purchaseShopAsset) Not enough xCookies.`
//             }
//         }

//         if (shopItem) {
//             // add the item to the user's inventory
//             const existingItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === asset);

//             console.log(`existing item index for asset: ${asset}: ${existingItemIndex}`);

//             if (existingItemIndex !== -1) {
//                 userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = amount;
//             } else {
//                 userUpdateOperations.$push['inventory.items'] = { 
//                     type: asset, 
//                     amount,
//                     totalAmountConsumed: 0,
//                     weeklyAmountConsumed: 0
//                 };
//             }
//         // if item is food
//         } else {
//             // add the food to the user's inventory
//             const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === asset);

//             if (existingFoodIndex !== -1) {
//                 userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = amount;
//             } else {
//                 userUpdateOperations.$push['inventory.foods'] = { type: asset, amount };
//             }
//         }

//         // deduct the asset price from the user's xCookies and increment `totalXCookiesSpent` and `weeklyXCookiesSpent`
//         userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -(assetPrice * amount);
//         userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = assetPrice * amount;
//         userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = assetPrice * amount;

//         // update the user's inventory
//         await UserModel.updateOne({ twitterId }, userUpdateOperations);

//         return {
//             status: Status.SUCCESS,
//             message: `(purchaseShopAsset) Asset purchased.`,
//             data: {
//                 asset,
//                 amount,
//                 totalPaid: assetPrice,
//                 paymentChoice: 'xCookies',
//             }
//         }
//     } catch (err: any) {
//         return {
//             status: Status.ERROR,
//             message: `(purchaseShopAsset) ${err.message}`
//         }
//     }
// }