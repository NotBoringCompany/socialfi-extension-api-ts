import mongoose from 'mongoose';
import { ShopBitOrb, ShopFood, ShopTerraCapsulator } from '../models/shop';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopSchema } from '../schemas/Shop';

/**
 * Creates a new shop. Should only be called once. Requires admin key.
 */
export const createShop = async (
    bitOrbs: ShopBitOrb,
    terraCapsulators: ShopTerraCapsulator,
    foods: ShopFood[],
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
            bitOrbs,
            terraCapsulators,
            foods
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

/**
 * Fetches the shop.
 */
export const getShop = async (): Promise<ReturnValue> => {
    const Shop = mongoose.model('Shop', ShopSchema, 'Shop');

    try {
        const shop = await Shop.findOne();

        if (!shop) {
            return {
                status: Status.ERROR,
                message: `(getShop) No shop found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getShop) Shop fetched.`,
            data: {
                shop
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getShop) ${err.message}`
        }
    }
}