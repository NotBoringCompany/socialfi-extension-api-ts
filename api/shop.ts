import { Food, FoodType } from '../models/food';
import { ShopAsset, ShopAssetCurrencyConversionData, ShopAssetExtendedPricing, ShopAssetPurchaseConfirmationAttemptType, ShopAssetType, ShopPackageType } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopAssetModel, ShopAssetPurchaseModel, UserModel } from '../utils/constants/db';
import { Item, ItemType } from '../models/item';
import { generateObjectId } from '../utils/crypto';
import { fetchIAPTickers, verifyTONTransaction } from './web3';
import { TxParsedMessage } from '../models/web3';

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

        // for each asset marked with `usd`, include the currency conversion rate to: TON and NOT (for now).
        const extendedShopAssets: ShopAssetExtendedPricing[] = [];

        for (const asset of shopAssets) {
            const currencyConversionData: ShopAssetCurrencyConversionData[] = [];

            // if the asset contains a price in USD, fetch the conversion rates to TON and NOT (for now; add more if needed in the future).
            if (asset.price.usd > 0) {
                const { status, data } = await fetchIAPTickers();

                if (status !== Status.SUCCESS) {
                    // if an error occurs, it's most likely due to an API error (such as rate limiting).
                    // in this case, just return the asset as is without the conversion data (empty array).
                    // in the frontend, this asset SHOULD be marked as "unavailable" for purchase until the API is back up.
                    extendedShopAssets.push({
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
                        givenContent: asset.givenContent,
                        currencyConversionData,
                    });
                }

                // if the API is up, proceed with fetching the conversion rates.
                const { TONTicker, NOTTicker } = data;

                // calculate the price in TON and NOT.
                const priceInTON = asset.price.usd * TONTicker;
                const priceInNOT = asset.price.usd * NOTTicker;

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

                // push the asset to the extendedShopAssets array.
                extendedShopAssets.push({
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
                    givenContent: asset.givenContent,
                    currencyConversionData,
                });
            // otherwise, just push the asset to the extendedShopAssets array without the conversion data.
            // this is because the asset is only purchasable with xCookies.
            } else {
                extendedShopAssets.push({
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
                    givenContent: asset.givenContent,
                    currencyConversionData,
                });
            }
        }

        console.log(`assets: ${JSON.stringify(extendedShopAssets, null, 2)}`);

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
        return {
            status: Status.ERROR,
            message: `(getShop) ${err.message}`
        }
    }
}

getShop();

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
            expirationDate: asset.expirationDate,
            stockData: asset.stockData,
            purchaseLimit: asset.purchaseLimit,
            effectDuration: asset.effectDuration,
            refreshIntervalData: asset.refreshIntervalData,
            levelRequirement: asset.levelRequirement,
            givenContent: asset.givenContent
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

        // tx payload for blockchain transactions done if payment === 'usd'.
        // used to store the parsed message body of the transaction in the purchase instance.
        let txPayload: TxParsedMessage | null = null;

        // check payment type.
        if (payment === 'xCookies') {
            // check if the user has enough xCookies to purchase the asset
            assetPrice = shopAsset.price.xCookies * amount;

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
                if (verificationMessage.includes(
                    'Address not found' ||
                    'BOC not found' ||
                    'Asset name or amount not found/invalid' ||
                    'Purchase ID not found' ||
                    'Purchase not found' ||
                    'Receiver address mismatch'
                )) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.NO_VALID_TX;
                } else if (verificationMessage.includes('Value mismatch')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.PAYMENT_TOO_LOW;
                } else if (verificationMessage.includes('Item mismatch')) {
                    confirmationAttempt = ShopAssetPurchaseConfirmationAttemptType.ITEM_MISMATCH;
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
                        baseCost: assetPrice * amount,
                        baseCurrency: payment,
                        actualCost: null,
                        actualCurrency: null
                    },
                    blockchainData: {
                        address,
                        chain,
                        txHash,
                        txPayload: verificationData?.txPayload ?? null,
                        confirmationAttempts: [confirmationAttempt]
                    },
                    purchaseTimestamp: Math.floor(Date.now() / 1000),
                    effectExpiration: 'never',
                    givenContent: shopAsset.givenContent
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

            // if verification is successful, no need to deduct anything currency-wise because the user has already paid for the asset.
            // simply continue and get out of the if-else block.
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

        // if stock is not unlimited, decrement the stock of the asset
        if (shopAsset.stockData.totalStock !== 'unlimited') {
            shopAssetPurchaseUpdateOperations.$inc['stockData.currentStock'] = -amount;

            await ShopAssetModel.updateOne({ assetName: asset }, shopAssetPurchaseUpdateOperations);
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
                    actualCost: txPayload.cost,
                    actualCurrency: txPayload.curr
                },
                blockchainData: {
                    address,
                    chain,
                    txHash,
                    txPayload,
                    confirmationAttempts: [ShopAssetPurchaseConfirmationAttemptType.SUCCESS]
                },
                purchaseTimestamp: Math.floor(Date.now() / 1000),
                effectExpiration: effectExpiration(),
                givenContent: shopAsset.givenContent
            })
        ])

        return {
            status: Status.SUCCESS,
            message: `(purchaseShopAsset) Asset purchased successfully.`,
            data: {
                twitterId,
                asset,
                amount,
                payment,
                address,
                chain,
                txHash,
                txPayload
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