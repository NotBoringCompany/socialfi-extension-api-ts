import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { BitCosmetic, BitCosmeticInventory } from '../models/cosmetic';
// import { Cosmetic, CosmeticEquip, CosmeticName, CosmeticSlot } from '../models/cosmetic';

/**
 * Bit cosmetic schema. Represents closely to the `BitCosmetic` interface in `models/cosmetic.ts`.
 */
export const BitCosmeticSchema = new mongoose.Schema<BitCosmetic>({
  _id: {
    type: String,
    default: generateObjectId()
  },
  name: String,
  set: String,
  slot: String,
  rarity: String,
  imageUrl: String
});

/**
 * Bit Cosmetic schema for a user. Represents closely to the `BitCosmeticInventory` interface in `models/cosmetic.ts`.
 */
export const UserBitCosmeticSchema = new mongoose.Schema<BitCosmeticInventory>({
  _id: {
    type: String,
    default: generateObjectId()
  },
  name: String,
  set: String,
  slot: String,
  rarity: String,
  imageUrl: String,
  bitCosmeticId: Number,
  ownerData: {
    currentOwnerId: String,
    originalOwnerId: String,
    currentOwnerAddress: String,
    inCustody: Boolean,
    originalOwnerAddress: String
  },
  blockchainData: {
    mintable: Boolean,
    minted: Boolean,
    tokenId: Number,
    chain: String,
    contractAddress: String,
    transactionHash: String
  }
});

// /**
//  * Represents the equipped data of a cosmetic item.
//  */
// export const CosmeticEquipSchema = new Schema<CosmeticEquip>({
//   /**
//    * The id of the bit that is being equipped.
//    */
//   bitId: Number,
//   /**
//    * The timestamp when the cosmetic item is equipped.
//    */
//   equipAt: Number
// }, {
//   _id: false
// });

// /**
//  * Represents a cosmetic item.
//  */
// export const CosmeticSchema = new Schema<Cosmetic>({
//   /**
//    * The id of the cosmetic item.
//    */
//   _id: {
//     type: String,
//     default: generateObjectId()
//   },
//   /**
//    * The id of the user who owns the cosmetic item.
//    */
//   owner: String,
//   /**
//    * The name of the cosmetic item.
//    */
//   name: {
//     type: String,
//     enum: Object.values(CosmeticName)
//   },
//   /**
//    * The slot of the cosmetic item.
//    */
//   slot: {
//     type: String,
//     enum: Object.values(CosmeticSlot)
//   },
//   /**
//    * The equipped data of the cosmetic item.
//    */
//   equipped: CosmeticEquipSchema || null
// });
