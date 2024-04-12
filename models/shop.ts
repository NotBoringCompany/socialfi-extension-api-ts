/****************
 * SHOP-RELATED MODELS
 ****************/

import { FoodType } from "./food";

/**
 * Represents the in-game shop.
 */
export interface Shop {
  /** the bit orbs in the shop */
  bitOrbs: ShopBitOrb;
  /** the bit orbs in the shop */
  bitOrbs2: ShopBitOrb;
  /** the bit orbs in the shop */
  bitOrbs3: ShopBitOrb;
  /** the terra capsulators in the shop */
  terraCapsulators: ShopTerraCapsulator;
  /** the terra capsulators in the shop */
  terraCapsulators2: ShopTerraCapsulator;
  /** the foods in the shop */
  foods: ShopFood[];
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

/**
 * Represents the type of shop asset.
 *
 * Used to determine which asset the user is purchasing from the shop.
 */
export enum ShopAsset {
  BIT_ORB = "Bit Orb",
  TERRA_CAPSULATOR = "Terra Capsulator",
  FOOD = "Food",
}
