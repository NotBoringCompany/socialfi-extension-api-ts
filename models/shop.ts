/****************
 * SHOP-RELATED MODELS
 ****************/

import { FoodType } from './food';
import { ItemType } from './item';

/**
 * Represents the in-game shop.
 */
export interface Shop {
    /** a list of items with their respective prices */
    items: ShopItem[];
    /** a list of foods with their respective prices */
    foods: ShopFood[];
}

/**
 * Represents an item in the shop.
 */
export interface ShopItem {
    type: ItemType;
    price: ShopPrice;
}

/**
 * Represents a food in the shop.
 */
export interface ShopFood {
    /** the type of food */
    type: FoodType;
    price: ShopPrice;
}

/**
 * Represents the price of a shop asset.
 */
export interface ShopPrice {
    /** the price of the asset in xCookies */
    xCookies: number;
}

/** Represents all available assets in the shop */
export type ShopAsset = ItemType | FoodType;