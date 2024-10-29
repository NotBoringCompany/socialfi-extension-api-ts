/**
 * Represents the name of a cosmetic item.
 */
export enum CosmeticName {
  /**
   * Myconid cosmetic item.
   */
  MYCONID = "myconid",
  /**
   * Angelic A cosmetic item.
   */
  ANGELIC_A = "angelic_a",
  /**
   * Angelic B cosmetic item.
   */
  ANGELIC_B = "angelic_b",
  /**
   * Caveman A cosmetic item.
   */
  CAVEMAN_A = "caveman_a",
  /**
   * Caveman B cosmetic item.
   */
  CAVEMAN_B = "caveman_b",
  /**
   * Gothic A cosmetic item.
   */
  GOTHIC_A = "gothic_a",
  /**
   * Gothic B cosmetic item.
   */
  GOTHIC_B = "gothic_b",
  /**
   * Pirate cosmetic item.
   */
  PIRATE = "pirate",
  /**
   * Siren cosmetic item.
   */
  SIREN = "siren",
  /**
   * Wood sprite cosmetic item.
   */
  WOODSPRITE = "woodsprite",
}

/**
 * Represents the slot of a cosmetic item.
 */
export enum CosmeticSlot {
  /**
   * Head slot.
   */
  HEAD = "head",
  /**
   * Outfit slot.
   */
  OUTFIT = "outfit",
  /**
   * Hands slot.
   */
  HANDS = "hand",
  /**
   * Back slot.
   */
  BACK = "back",
}

/**
 * Represents the equipped data of a cosmetic item.
 */
export interface CosmeticEquip {
  /**
   * The ID of the cosmetic item.
   */
  _id?: string;
  /**
   * The ID of the bit that the cosmetic item is equipped to.
   */
  bitId: number;
  /**
   * The timestamp of when the cosmetic item was equipped.
   */
  equipAt: number;
}

/**
 * Represents a cosmetic item.
 */
export interface Cosmetic {
  /**
   * The ID of the cosmetic item.
   */
  _id?: string;
  /**
   * The ID of the owner of the cosmetic item.
   */
  owner: string;
  /**
   * The name of the cosmetic item.
   */
  name: CosmeticName;
  /**
   * The slot of the cosmetic item.
   */
  slot: CosmeticSlot;
  /**
   * The equipped data of the cosmetic item.
   */
  equipped: CosmeticEquip | null;
}
