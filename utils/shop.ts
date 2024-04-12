import { FoodType } from "../models/food";
import { Shop } from "../models/shop";

/**
 * Since we don't require the shop to be dynamic for now (i.e. not requiring the database), we can just hardcode the shop.
 */
export const shop: Shop = {
  bitOrbs: {
    xCookies: 300,
  },
  bitOrbs2: {
    xCookies: 1500,
  },
  bitOrbs3: {
    xCookies: 10000,
  },
  terraCapsulators: {
    xCookies: 200,
  },
  terraCapsulators2: {
    xCookies: 1500,
  },

  foods: [
    {
      type: FoodType.CANDY,
      xCookies: 0.4,
    },
    {
      type: FoodType.CHOCOLATE,
      xCookies: 0.8,
    },
    {
      type: FoodType.JUICE,
      xCookies: 1,
    },
    {
      type: FoodType.BURGER,
      xCookies: 2.5,
    },
  ],
};
