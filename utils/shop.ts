import { FoodType } from '../models/food';
import { Shop } from '../models/shop';

/**
 * Since we don't require the shop to be dynamic for now (i.e. not requiring the database), we can just hardcode the shop.
 */
export const shop: Shop = {
    bitOrbs: {
        xCookies: 200
    },
    terraCapsulators: {
        xCookies: 600
    },
    foods: [
        {
            type: FoodType.CANDY,
            xCookies: 0.1
        },
        {
            type: FoodType.CHOCOLATE,
            xCookies: 0.2
        },
        {
            type: FoodType.JUICE,
            xCookies: 0.35
        },
        {
            type: FoodType.BURGER,
            xCookies: 0.6
        }
    ]
}