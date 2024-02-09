/****************
 * SHOP-RELATED MODELS
 ****************/

import { FoodType } from './food';

/**
 * Represents the in-game shop.
 */
export interface Shop {
    bitOrbs: ShopBitOrb;
    terraCapsulators: ShopTerraCapsulator;
    food: ShopFood[];
}

/**
 * Represents the bit orb in the shop.
 */
export interface ShopBitOrb {
    /** the price of 1 bit orb in xCookies */
    xCookies: number;
}

/**
 * Represents the terra capsulator in the shop.
 */
export interface ShopTerraCapsulator {
    /** the price of 1 terra capsulator in xCookies */
    xCookies: number;
}

/**
 * Represents a food in the shop.
 */
export interface ShopFood {
    /** the type of food */
    type: FoodType;
    /** the price of one of this food type in xCookies */
    xCookies: number;
}