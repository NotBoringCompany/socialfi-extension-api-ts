import { FoodType } from '../models/food';
import { Shop } from '../models/shop';

/**
 * Since we don't require the shop to be dynamic for now (i.e. not requiring the database), we can just hardcode the shop.
 */
export const shop: Shop = {
    bitOrbs: {
        xCookies: 100
    },
    terraCapsulators: {
        xCookies: 300
    },
    foods: [
        {
            type: FoodType.APPLE,
            xCookies: 2
        },
        {
            type: FoodType.CHOCOLATE,
            xCookies: 4
        },
        {
            type: FoodType.JUICE,
            xCookies: 8
        },
        {
            type: FoodType.BURGER,
            xCookies: 15
        }
    ]
}