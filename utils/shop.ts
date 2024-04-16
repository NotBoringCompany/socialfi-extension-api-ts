import { BitOrbType } from '../models/bitOrb';
import { FoodType } from '../models/food';
import { Shop } from '../models/shop';
import { TerraCapsulatorType } from '../models/terraCapsulator';

/**
 * Since we don't require the shop to be dynamic for now (i.e. not requiring the database), we can just hardcode the shop.
 */
export const shop: Shop = {
    items: [
        {
            type: BitOrbType.BIT_ORB_I,
            price: {
                xCookies: 200
            }
        },
        {
            type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
            price: {
                xCookies: 600
            }
        }
    ],
    foods: [
        {
            type: FoodType.CANDY,
            price: {
                xCookies: 0.1
            }
        },
        {
            type: FoodType.CHOCOLATE,
            price: {
                xCookies: 0.2
            }
        },
        {
            type: FoodType.JUICE,
            price: {
                xCookies: 0.35
            }
        },
        {
            type: FoodType.BURGER,
            price: {
                xCookies: 0.6
            }
        }
    ]
}