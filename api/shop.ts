import mongoose from 'mongoose';
import { ShopBitOrb, ShopFood, ShopTerraCapsulator } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopSchema } from '../schemas/Shop';

/**
 * Creates a new shop. Should only be called once. Requires admin key.
 */
export const createShop = async (
    shopBitOrbs: ShopBitOrb,
    shopTerraCapsulators: ShopTerraCapsulator,
    shopFoods: ShopFood[],
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(createShop) Unauthorized. Wrong admin key.`
        }
    }

    const Shop = mongoose.model('Shop', ShopSchema, 'Shop');

    try {
        const shop = new Shop({
            bitOrbs: shopBitOrbs,
            terraCapsulators: shopTerraCapsulators,
            foods: shopFoods
        });

        await shop.save();

        return {
            status: Status.SUCCESS,
            message: `(createShop) Shop created.`,
            data: {
                shop
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(createShop) ${err.message}`
        }
    }
}