import { BitCosmetic, BitCosmeticInventory, BitCosmeticRarity, BitCosmeticSlot } from '../models/cosmetic';
import { BitCosmeticModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
/**
 * Adds one or multiple bit cosmetics to the database.
 */
export const addBitCosmetics = async (
  cosmetics: BitCosmetic[]
): Promise<ReturnValue> => {
  try {
    // check if any of the cosmetics already exist.
    const existingCosmetics = await BitCosmeticModel.find().lean();

    // filter out the cosmetics that already exist and only add the new ones.
    const newCosmeticsToAdd = cosmetics.filter(cosmetic => {
      return !existingCosmetics.some(existing => existing.name.toLowerCase() === cosmetic.name.toLowerCase());
    });

    // add the new cosmetics to the database.
    await BitCosmeticModel.insertMany(newCosmeticsToAdd);

    console.log(`(addBitCosmetics) Successfully added ${newCosmeticsToAdd.length} new bit cosmetics to the database.`);
    console.log(`(addBitCosmetics) Number of cosmetics that already exist: ${existingCosmetics.length - newCosmeticsToAdd.length}`);

    return {
      status: Status.SUCCESS,
      message: `(addBitCosmetics) Successfully added ${newCosmeticsToAdd.length} new bit cosmetics to the database`
    }
  } catch (err: any) {
    console.error(`(addBitCosmetic) Error: ${err.message}`);
    
    return {
      status: Status.ERROR,
      message: `(addBitCosmetics) Error: ${err.message}`
    }
  }
}

/**
 * Fetches all owned bit cosmetics and group them per slot.
 */
export const fetchOwnedBitCosmetics = async (twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(fetchOwnedBitCosmetics) User with Twitter ID: ${twitterId} not found`,
      };
    }

    const cosmetics = user?.inventory?.bitCosmetics as BitCosmeticInventory[];

    // group them into the 4 slots: head, body, arms, back.
    const groupedCosmetics: { [key in BitCosmeticSlot]: BitCosmeticInventory[] } = {
      head: [],
      body: [],
      arms: [],
      back: [],
    }

    cosmetics.forEach(cosmetic => {
      // the cosmetic will be named something like `Myconid (Head)`. The slot will always be between the `()` brackets.
      // we will need to extract it.
      const slot = cosmetic.cosmeticName.match(/\((.*?)\)/)?.[1] as BitCosmeticSlot;

      groupedCosmetics[slot].push(cosmetic);
    });

    return {
      status: Status.SUCCESS,
      message: `(fetchOwnedBitCosmetics) Successfully fetched all owned bit cosmetics for user with Twitter ID: ${twitterId}`,
      data: {
        groupedCosmetics
      },
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(fetchOwnedBitCosmetics) Error: ${err.message}`,
    }
  }
}

// export const getAllUserCosmetics = async (userId: string): Promise<ReturnValue> => {
//   try {
//     // check real idUser exists
//     const user = await UserModel.findOne({ _id: userId }).lean();
//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(getAllUserCosmetics) User with ID: ${userId} not found`,
//       };
//     }
//     // get all cosmetics
//     const data = await CosmeticModel.find({ owner: userId }).lean();
//     return {
//       status: Status.SUCCESS,
//       message: `(getAllUserCosmetics) Successfully retrieved all cosmetics for user with ID: ${userId}`,
//       data
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getAllUserCosmetics) Error: ${err.message}`,
//     };
//   }
// }

// export const getCosmeticMatch = async (userId: string): Promise<ReturnValue> => {
//   try {
//     // get all cosmetics
//     const data = await CosmeticModel.aggregate([
//       // filter by owner
//       { $match: { owner: userId } },
//       // group by name and slot, if same name and slot, sum quantity
//       {
//         $group: {
//           _id: { name: "$name", slot: "$slot" },
//           quantity: { $sum: 1 }
//         }
//       },
//       {
//         // recreate the object
//         $project: {
//           _id: 0,
//           name: "$_id.name",
//           slot: "$_id.slot",
//           quantity: "$quantity"
//         }
//       }
//     ])
//     return {
//       status: Status.SUCCESS,
//       message: `(getCosmeticMatch) Successfully retrieved all cosmetics`,
//       data
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getCosmeticMatch) Error: ${err.message}`,
//     };
//   }
// }

// export const equipCosmetic = async (cosmeticId: string, bitId: number, userId: string): Promise<ReturnValue> => {
//   try {
//     // check bitId is valid
//     const bit = await BitModel.findOne({ bitId }).lean();
//     if (!bit) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) Bit with ID: ${bitId} not found`,
//       };
//     }
//     // check bit is owned by user
//     if (bit.owner !== userId) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) Bit with ID: ${bitId} is not owned by user with ID: ${userId}`,
//       };
//     }
//     // check real idUser exists
//     const user = await UserModel.findOne({ _id: userId }).lean();
//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) User with ID: ${userId} not found`,
//       };
//     }
//     // check if cosmetic exists
//     const cosmetic = await CosmeticModel.findOne({ _id: cosmeticId }).lean();
//     if (!cosmetic) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) Cosmetic with ID: ${cosmeticId} not found`,
//       };
//     }
//     // check if user owns cosmetic
//     if (cosmetic.owner !== userId) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) User with ID: ${userId} does not own cosmetic with ID: ${cosmeticId}`,
//       };
//     }
//     // check cosmetic only can be equipped once
//     if (cosmetic.equipped) {
//       return {
//         status: Status.ERROR,
//         message: `(equippedCosmetic) Cosmetic with ID: ${cosmeticId} has already been equipped`,
//       };
//     }
//     // update cosmetic
//     cosmetic.equipped = {
//       bitId,
//       equipAt: Math.floor(Date.now() / 1000),
//     }
//     const data = await CosmeticModel.updateOne({ _id: cosmeticId }, cosmetic).lean();
//     return {
//       status: Status.SUCCESS,
//       message: `(equippedCosmetic) Successfully updated cosmetic with bitId: ${bitId} for user with ID: ${userId}`,
//       data
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(equippedCosmetic) Error: ${err.message}`,
//     };
//   }
// }

// export const unequipCosmetic = async (cosmeticId: string, userId: string): Promise<ReturnValue> => {
//   try {
//     // check real idUser exists
//     const user = await UserModel.findOne({ _id: userId }).lean();
//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(unequippedCosmetic) User with ID: ${userId} not found`,
//       };
//     }
//     // check if cosmetic exists
//     const cosmetic = await CosmeticModel.findOne({ _id: cosmeticId }).lean();
//     if (!cosmetic) {
//       return {
//         status: Status.ERROR,
//         message: `(unequippedCosmetic) Cosmetic with ID: ${cosmeticId} not found`,
//       };
//     }
//     // check if user owns cosmetic
//     if (cosmetic.owner !== userId) {
//       return {
//         status: Status.ERROR,
//         message: `(unequippedCosmetic) User with ID: ${userId} does not own cosmetic with ID: ${cosmeticId}`,
//       };
//     }
//     // update cosmetic
//     cosmetic.equipped = null;
//     const data = await CosmeticModel.updateOne({ _id: cosmeticId }, cosmetic).lean();
//     return {
//       status: Status.SUCCESS,
//       message: `(unequippedCosmetic) Successfully updated cosmetic with ID: ${cosmeticId} for user with ID: ${userId}`,
//       data
//     };
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(unequippedCosmetic) Error: ${err.message}`,
//     };
//   }
// }

// export const getCosmeticsByBit = async (bitId: number): Promise<ReturnValue> => {
//   try {
//     const cosmetics = await CosmeticModel.find({ 'equipped.bitId': bitId }).lean();
//     return {
//       status: Status.SUCCESS,
//       message: `(getBitsCosmetics) Successfully retrieved all cosmetics for bit with ID: ${bitId}`,
//       data: cosmetics
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(getBitsCosmetics) Error: ${err.message}`,
//     };
//   }
// }

// export const batchEquipCosmetics = async (cosmeticIds: string[], bitId: number, userId: string): Promise<ReturnValue> => {
//   try {
//     // check real idUser exists
//     const user = await UserModel.findOne({ _id: userId }).lean();
//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(batchEquipCosmetics) User with ID: ${userId} not found`,
//       };
//     }
//     // check bit is owned by user
//     const bit = await BitModel.findOne({ bitId: bitId }).lean();
//     if (!bit) {
//       return {
//         status: Status.ERROR,
//         message: `(batchEquipCosmetics) Bit with ID: ${bitId} not found`,
//       };
//     }
    
//     if (bit.owner !== userId) {
//       return {
//         status: Status.ERROR,
//         message: `(batchEquipCosmetics) User with ID: ${userId} does not own bit with ID: ${bitId}`,
//       };
//     }
//     // check all cosmetics exist
//     const cosmetics = await CosmeticModel.find({ _id: { $in: cosmeticIds } }).lean();
//     if (cosmetics.length !== cosmeticIds.length) {
//       return {
//         status: Status.ERROR,
//         message: `(batchEquipCosmetics) Some cosmetics with IDs: ${cosmeticIds} not found`,
//       };
//     }
//     // check all cosmetics are owned by user
//     for (const cosmetic of cosmetics) {
//       if (cosmetic.owner !== userId) {
//         return {
//           status: Status.ERROR,
//           message: `(batchEquipCosmetics) User with ID: ${userId} does not own cosmetic with ID: ${cosmetic._id}`,
//         };
//       }
//     }

//     // update cosmetics
//     const data = await CosmeticModel.updateMany({ _id: { $in: cosmeticIds }, equipped: null }, { $set: { equipped: { bitId, equipAt: Math.floor(Date.now() / 1000) } } }).lean();
//     return {
//       status: Status.SUCCESS,
//       message: `(batchEquipCosmetics) Successfully updated cosmetics with bitId: ${bitId} for user with ID: ${userId}`,
//       data
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(batchEquipCosmetics) Error: ${err.message}`,
//     };
//   }
// }