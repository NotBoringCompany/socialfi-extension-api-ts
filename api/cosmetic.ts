import { EquippedCosmeticData } from '../models/bit';
import { BitCosmetic, BitCosmeticInventory, BitCosmeticRarity, BitCosmeticSlot } from '../models/cosmetic';
import { BitCosmeticModel, BitModel, UserBitCosmeticModel, UserModel } from '../utils/constants/db';
import { redis } from '../utils/constants/redis';
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

// /**
//  * Equips a single cosmetic item to one of the bit's slots.
//  */
// export const equipBitCosmetic = async (twitterId: string, bitId: number, cosmeticId: string): Promise<ReturnValue> => {
//   try {
//     const [user, bit] = await Promise.all([
//       UserModel.findOne({ twitterId }).lean(),
//       BitModel.findOne({ bitId }).lean(),
//     ]);

//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} not found`,
//       };
//     }

//     if (!bit) {
//       return {
//         status: Status.ERROR,
//         message: `(equipBitCosmetic) Bit with ID: ${bitId} not found`,
//       };
//     }

//     // if the bit is not owned by the user, return an error.
//     if (bit.ownerData.currentOwnerId !== user._id) {
//       return {
//         status: Status.ERROR,
//         message: `(equipBitCosmetic) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
//       };
//     }

//     const cosmetic = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).find(cosmetic => cosmetic.cosmeticId === cosmeticId);
//     const cosmeticIndex = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).findIndex(cosmetic => cosmetic.cosmeticId === cosmeticId);

//     // if the user doesn't own the cosmetic, return an error.
//     if (!cosmetic) {
//       return {
//         status: Status.ERROR,
//         message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} does not own a cosmetic with ID: ${cosmeticId}`,
//       };
//     }

//     // check if the `equippedAmount` is less than the `amount` of the cosmetic. if not, return an error.
//     if (cosmetic.equippedAmount >= cosmetic.amount) {
//       return {
//         status: Status.ERROR,
//         message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} has already equipped the maximum amount of the cosmetic with ID: ${cosmeticId}`,
//       };
//     }

//     const userUpdateOperations = {
//       $inc: {}
//     }

//     // get the slot of the cosmetic.
//     const slot = cosmetic.cosmeticName.match(/\((.*?)\)/)?.[1] as BitCosmeticSlot;

//     // check if there is already a cosmetic equipped in this slot.
//     const equippedCosmeticData: EquippedCosmeticData = bit.equippedCosmetics[slot.toLowerCase()];

//     if (equippedCosmeticData.cosmeticId !== null) {
//       // decrement the user's `equippedAmount` of the previously equipped cosmetic.
//       const previousCosmeticIndex = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).findIndex(cosmetic => cosmetic.cosmeticId === equippedCosmeticData.cosmeticId);
      
//       userUpdateOperations.$inc[`inventory.bitCosmetics.${previousCosmeticIndex}.equippedAmount`] = -1;
//     }

//     // increment the user's `equippedAmount` of the cosmetic.
//     userUpdateOperations.$inc[`inventory.bitCosmetics.${cosmeticIndex}.equippedAmount`] = 1;

//     // update the bit with the new equipped cosmetic and do the user update operations
//     await Promise.all([
//       BitModel.updateOne({ bitId }, {
//         $set: {
//           [`equippedCosmetics.${slot.toLowerCase()}`]: {
//             cosmeticId,
//             cosmeticName: cosmetic.cosmeticName,
//             equippedAt: Math.floor(Date.now() / 1000),
//           }
//         }
//       }),
//       UserModel.updateOne({ twitterId }, userUpdateOperations)
//     ]);

//     return {
//       status: Status.SUCCESS,
//       message: `(equipBitCosmetic) Successfully equipped the cosmetic with ID ${cosmeticId} to bit ID ${bitId}`,
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(equipBitCosmetic) Error: ${err.message}`,
//     }
//   }
// }

// /**
//  * Unequips one or multiple cosmetic items from a bit.
//  */
// export const unequipBitCosmeticSlots = async (twitterId: string, bitId: number, slots: BitCosmeticSlot[]): Promise<ReturnValue> => {
//   try {
//     const [user, bit] = await Promise.all([
//       UserModel.findOne({ twitterId }).lean(),
//       BitModel.findOne({ bitId }).lean(),
//     ]);

//     if (!user) {
//       return {
//         status: Status.ERROR,
//         message: `(unequipBitCosmeticSlots) User with Twitter ID: ${twitterId} not found`,
//       };
//     }

//     if (!bit) {
//       return {
//         status: Status.ERROR,
//         message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} not found`,
//       };
//     }

//     // if the bit is not owned by the user, return an error.
//     if (bit.ownerData.currentOwnerId !== user._id) {
//       return {
//         status: Status.ERROR,
//         message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
//       };
//     }

//     const bitUpdateOperations = {
//       $set: {}
//     }

//     const userUpdateOperations = {
//       $inc: {}
//     }

//     // check if the bit has any equipped cosmetics.
//     for (const slot of slots) {
//       const equippedCosmetic: EquippedCosmeticData = bit.equippedCosmetics[slot.toLowerCase()];
//       // check if this slot has a cosmetic equipped.
//       if (!equippedCosmetic || equippedCosmetic.cosmeticId === null) {
//         return {
//           status: Status.ERROR,
//           message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} does not have any cosmetic equipped in the ${slot} slot`,
//         }
//       }

//       // otherwise, simply unequip the cosmetic by setting the `cosmeticId` to `null`, the `cosmeticName` to null and the `equippedAt` to 0.
//       bitUpdateOperations.$set[`equippedCosmetics.${slot.toLowerCase()}`] = {
//         cosmeticId: null,
//         cosmeticName: null,
//         equippedAt: 0,
//       }

//       // decrement the user's `equippedAmount` of the cosmetic.
//       const cosmeticIndex = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).findIndex(cosmetic => cosmetic.cosmeticId === equippedCosmetic.cosmeticId);
//       userUpdateOperations.$inc[`inventory.bitCosmetics.${cosmeticIndex}.equippedAmount`] = -1;
//     }

//     // update bit and user.
//     await Promise.all([
//       BitModel.updateOne({ bitId }, bitUpdateOperations),
//       UserModel.updateOne({ twitterId }, userUpdateOperations)
//     ]);

//     return {
//       status: Status.SUCCESS,
//       message: `(unequipBitCosmeticSlots) Successfully unequipped cosmetics from bit with ID: ${bitId}`,
//     }
//   } catch (err: any) {
//     return {
//       status: Status.ERROR,
//       message: `(unequipBitCosmeticSlots) Error: ${err.message}`,
//     }
//   }
// }

/**
 * fetches the latest bit cosmetic id from the database.
 */
export const getLatestBitCosmeticId = async (): Promise<ReturnValue> => {
    try {
        const cosmeticId = await redis.get('counter.bitCosmeticId');

        if (!cosmeticId) {
            // sort the cosmetic ids in descending order and get the first one.
            const latestCosmetic = await UserBitCosmeticModel.findOne().sort({ bitCosmeticId: -1 }).lean();

            // set the counter to the latest cosmetic
            await redis.set('counter.bitCosmeticId', latestCosmetic?.bitCosmeticId ?? 0);
        }

        // increment the next cosmetic id counter
        const nextCosmeticId = await redis.incr('counter.bitCosmeticId');

        return {
            status: Status.SUCCESS,
            message: `(getLatestBitCosmeticId) Successfully fetched the latest bit cosmetic id`,
            data: {
                bitCosmeticId: nextCosmeticId ?? 0
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestBitCosmeticId) Error: ${err.message}`
        }
    }
}