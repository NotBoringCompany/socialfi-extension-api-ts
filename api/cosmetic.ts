import { BitCosmetic, BitCosmeticInventory, BitCosmeticRarity, BitCosmeticSlot } from '../models/cosmetic';
import { BitCosmeticModel, BitModel, UserModel } from '../utils/constants/db';
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

/**
 * Equips a cosmetic set to a user's bit.
 * 
 * NOTE: If a set is not complete, it will only equip whatever cosmetics from that set are available for each slot.
 */
export const equipBitCosmeticSet = async (twitterId: string, bitId: number, set: string): Promise<ReturnValue> => {
  try {
    const [user, bit] = await Promise.all([
      UserModel.findOne({ twitterId }).lean(),
      BitModel.findOne({ bitId }).lean(),
    ]);

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmeticSet) User with Twitter ID: ${twitterId} not found`,
      };
    }

    if (!bit) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmeticSet) Bit with ID: ${bitId} not found`,
      };
    }

    // if the bit is not owned by the user, return an error.
    if (bit.owner !== user._id) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmeticSet) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
      };
    }

    const cosmetics = user?.inventory?.bitCosmetics as BitCosmeticInventory[];

    // cosmetics are named something like `Myconid (Head)` or `Angelic A (Arms)`. The set name is the name before the `(`.
    const setCosmetics = cosmetics.filter(cosmetic => cosmetic.cosmeticName.split(' (')[0].toLowerCase() === set.toLowerCase());

    // if the user doesn't have any cosmetics from the set, return an error.
    if (setCosmetics.length === 0) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmeticSet) User with Twitter ID: ${twitterId} does not have any cosmetics from the set: ${set}`,
      };
    }

    // check which slots are available in the set. for example:
    // if the user owns `Myconid (Head)` and `Myconid (Body)`, then the user has the Head and Body parts of the set.
    const availableSlots = setCosmetics.map(cosmetic => cosmetic.cosmeticName.match(/\((.*?)\)/)?.[1] as BitCosmeticSlot);

    const bitUpdateOperations = {
      $set: {}
    }

    const userUpdateOperations = {
      $inc: {}
    }

    // for each available slot, 
    // check if the `equippedAmount` is less than the `amount` of the cosmetic. if yes:
    // 1. update the bit's `equippedCosmetics.<slot>` field.
    // 2. increment the user's `equippedAmount` of the cosmetic.
    availableSlots.forEach(slot => {
      const cosmeticIndex = setCosmetics.findIndex(cosmetic => cosmetic.cosmeticName.match(/\((.*?)\)/)?.[1] === slot);
      const cosmetic = setCosmetics[cosmeticIndex];

      if (cosmetic.equippedAmount < cosmetic.amount) {
        bitUpdateOperations.$set[`equippedCosmetics.${slot.toLowerCase()}`] = {
          cosmeticId: cosmetic.cosmeticId,
          equippedAt: Math.floor(Date.now() / 1000),
        }

        userUpdateOperations.$inc[`inventory.bitCosmetics.${cosmeticIndex}.equippedAmount`] = 1;
      } else {
        // if the cosmetic is already fully equipped, return an error.
        return {
          status: Status.ERROR,
          message: `(equipBitCosmeticSet) Cosmetic with ID ${cosmetic.cosmeticId} is already fully equipped. Please try manually equipping the cosmetics.`,
        }
      }
    });

    // update the bit with the new equipped cosmetics.
    await BitModel.updateOne({ bitId }, bitUpdateOperations);

    return {
      status: Status.SUCCESS,
      message: `(equipBitCosmeticSet) Successfully equipped the ${set} set to bit ID ${bitId}`,
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(equipBitCosmeticSet) Error: ${err.message}`,
    }
  }
}

/**
 * Equips a single cosmetic item to one of the bit's slots.
 */
export const equipBitCosmetic = async (twitterId: string, bitId: number, cosmeticId: string): Promise<ReturnValue> => {
  try {
    const [user, bit] = await Promise.all([
      UserModel.findOne({ twitterId }).lean(),
      BitModel.findOne({ bitId }).lean(),
    ]);

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} not found`,
      };
    }

    if (!bit) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmetic) Bit with ID: ${bitId} not found`,
      };
    }

    // if the bit is not owned by the user, return an error.
    if (bit.owner !== user._id) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmetic) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
      };
    }

    const cosmetic = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).find(cosmetic => cosmetic.cosmeticId === cosmeticId);
    const cosmeticIndex = (user?.inventory?.bitCosmetics as BitCosmeticInventory[]).findIndex(cosmetic => cosmetic.cosmeticId === cosmeticId);

    // if the user doesn't own the cosmetic, return an error.
    if (!cosmetic) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} does not own a cosmetic with ID: ${cosmeticId}`,
      };
    }

    // check if the `equippedAmount` is less than the `amount` of the cosmetic. if not, return an error.
    if (cosmetic.equippedAmount >= cosmetic.amount) {
      return {
        status: Status.ERROR,
        message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} has already equipped the maximum amount of the cosmetic with ID: ${cosmeticId}`,
      };
    }

    // get the slot of the cosmetic.
    const slot = cosmetic.cosmeticName.match(/\((.*?)\)/)?.[1] as BitCosmeticSlot;

    // update the bit with the new equipped cosmetic.
    // also increment the user's `equippedAmount` of the cosmetic.
    await Promise.all([
      BitModel.updateOne({ bitId }, {
        $set: {
          [`equippedCosmetics.${slot.toLowerCase()}`]: {
            cosmeticId,
            equippedAt: Math.floor(Date.now() / 1000),
          }
        }
      }),
      UserModel.updateOne({ twitterId }, {
        $inc: {
          [`inventory.bitCosmetics.${cosmeticIndex}.equippedAmount`]: 1
        }
      })
    ])

    return {
      status: Status.SUCCESS,
      message: `(equipBitCosmetic) Successfully equipped the cosmetic with ID ${cosmeticId} to bit ID ${bitId}`,
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(equipBitCosmetic) Error: ${err.message}`,
    }
  }
}

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