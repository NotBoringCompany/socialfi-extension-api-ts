import mongoose from 'mongoose';
import { Food, FoodType } from '../models/food';
import { ShopAsset, ShopFood } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { shop } from '../utils/shop';
import { getOwnedXCookies } from './cookies';
import { UserSchema } from '../schemas/User';
import { User } from '../models/user';

/**
 * Fetches the shop.
 */
export const getShop = (): ReturnValue => {
    return {
        status: Status.SUCCESS,
        message: `(getShop) Shop fetched.`,
        data: {
            shop
        }
    }
}

/**
 * (User) Purchases a shop asset. Requires enough xCookies.
 */
export const purchaseShopAsset = async (
    twitterId: string,
    asset: ShopAsset,
    foodType?: FoodType
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

    if (asset === ShopAsset.FOOD && !foodType) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) No foodType provided.`
        }
    }

    try {
        // fetch user's xCookies
        const { status, message, data } = await getOwnedXCookies(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(purchaseShopAsset) Error from getOwnedXCookies: ${message}`
            }
        }

        const xCookies = data.xCookies;
        // fetch the price via the switch statement
        let assetPrice = 0;

        // check if user has enough xCookies by checking the price of the asset
        switch (asset) {
            // food will be handled differently because it has different prices for different foods
            case ShopAsset.FOOD:
                // find the food instance that matches `foodType`
                const food = shop.foods.find((f: ShopFood) => f.type === foodType);

                // if food is not found, return an error
                if (!food) {
                    return {
                        status: Status.ERROR,
                        message: `(purchaseShopAsset) Food not found.`
                    }
                }

                assetPrice = food.xCookies;

                // if user doesn't have enough xCookies, return an error
                if (xCookies < food.xCookies) {
                    return {
                        status: Status.ERROR,
                        message: `(purchaseShopAsset) Not enough xCookies.`
                    }
                }

                break;
            case ShopAsset.BIT_ORB:
                assetPrice = shop.bitOrbs.xCookies;

                if (xCookies < shop.bitOrbs.xCookies) {
                    return {
                        status: Status.ERROR,
                        message: `(purchaseShopAsset) Not enough xCookies.`
                    }
                }

                break;
            case ShopAsset.TERRA_CAPSULATOR:
                assetPrice = shop.terraCapsulators.xCookies;

                if (xCookies < shop.terraCapsulators.xCookies) {
                    return {
                        status: Status.ERROR,
                        message: `(purchaseShopAsset) Not enough xCookies.`
                    }
                }

                break;
        }

        // deduct the price of the asset from the user's xCookies
        const User = mongoose.model<User>('Users', UserSchema, 'Users');

        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(purchaseShopAsset) User not found.`
            }
        }

        // Deduct the asset price from the user's xCookies
        const updatedXCookies = xCookies - assetPrice;

        // Prepare the update operation to deduct the asset price from the user's xCookies
        const updateOperation: any = {
            $set: { 'inventory.xCookies': updatedXCookies }
        };

        // Update the user's inventory based on the asset type
        switch (asset) {
            case ShopAsset.FOOD:
                const existingFoodIndex = user.inventory.foods.findIndex(f => f.type === foodType);

                if (existingFoodIndex !== -1) {
                    // If the food already exists, increment its amount
                    updateOperation.$inc = { [`inventory.foods.${existingFoodIndex}.amount`]: 1 };
                } else {
                    // If the food doesn't exist, push a new food item
                    updateOperation.$push = { 'inventory.foods': { type: foodType, amount: 1 } };
                }
                break;
            case ShopAsset.BIT_ORB:
                // Increment totalBitOrbs count
                updateOperation.$inc = { 'inventory.totalBitOrbs': 1 };
                break;
            case ShopAsset.TERRA_CAPSULATOR:
                // Increment totalTerraCapulators count
                updateOperation.$inc = { 'inventory.totalTerraCapulators': 1 };
                break;
        }

        return {
            status: Status.SUCCESS,
            message: `(purchaseShopAsset) Asset purchased and xCookies deducted.`,
            data: {
                asset,
                foodType
            }
        }

    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(purchaseShopAsset) ${err.message}`
        }
    }
}