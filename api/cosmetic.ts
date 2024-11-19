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

/**
 * Equips a single cosmetic item to one of the bit's slots.
 */
export const equipBitCosmetic = async (twitterId: string, bitId: number, bitCosmeticId: number): Promise<ReturnValue> => {
    try {
        const [user, bit, cosmetic] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean(),
            UserBitCosmeticModel.findOne({ bitCosmeticId }).lean()
        ]);

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} not found`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) Bit with ID: ${bitId} not found`
            }
        }

        if (!cosmetic) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) Cosmetic with ID: ${bitCosmeticId} not found`
            }
        }

        // if the bit is not owned by the user, return an error.
        if (bit.ownerData.currentOwnerId !== user._id) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
            };
        }

        // if the user doesn't own the cosmetic, return an error.
        if (cosmetic.ownerData.currentOwnerId !== user._id) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) User with Twitter ID: ${twitterId} does not own a cosmetic with ID: ${bitCosmeticId}`,
            };
        }

        // if the cosmetic is already used on another bit, return an error.
        if (cosmetic.equippedBitId !== 0 && cosmetic.equippedBitId !== bitId) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) Cosmetic with ID: ${bitCosmeticId} is already equipped on another bit`,
            };
        }

        // if the cosmetic is already equipped on the bit, return an error.
        if (cosmetic.equippedBitId === bitId) {
            return {
                status: Status.ERROR,
                message: `(equipBitCosmetic) Cosmetic with ID: ${bitCosmeticId} is already equipped on this bit.`,
            };
        }

        const cosmeticUpdateOperations = {
            $set: {}
        }

        const bitUpdateOperations: Array<{
            bitId: number,
            updateOperations: {
                $set: {}
            }
        }> = [];

        // get the slot of the cosmetic.
        const slot = cosmetic.slot as BitCosmeticSlot;

        // check if there is already a cosmetic equipped in this slot.
        const equippedCosmeticData: EquippedCosmeticData = bit.equippedCosmetics[slot.toLowerCase()];

        if (equippedCosmeticData.cosmeticId !== null) {
            // update the `equippedBitId` of the previously equipped cosmetic to 0.
            bitUpdateOperations.push({
                bitId: equippedCosmeticData.cosmeticId,
                updateOperations: {
                    $set: {
                        equippedBitId: 0
                    }
                }
            })
        }

        // update the `equippedBitId` of the cosmetic to the bit ID.
        cosmeticUpdateOperations.$set['equippedBitId'] = bitId;

        // update the bit with the new equipped cosmetic.
        bitUpdateOperations.push({
            bitId,
            updateOperations: {
                $set: {
                    [`equippedCosmetics.${slot.toLowerCase()}`]: {
                        cosmeticId: bitCosmeticId,
                        cosmeticName: cosmetic.name,
                        equippedAt: Math.floor(Date.now() / 1000),
                    }
                }
            }
        });

        const bitUpdatePromises = bitUpdateOperations.map(async ({ bitId, updateOperations }) => {
            return BitModel.updateOne({ bitId, ownerData: { currentOwnerId: user._id } }, updateOperations);
        });

        // update the cosmetic and the bit.
        await Promise.all([
            UserBitCosmeticModel.updateOne({ bitCosmeticId }, cosmeticUpdateOperations),
            ...bitUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(equipBitCosmetic) Successfully equipped the cosmetic with ID ${bitCosmeticId} to bit ID ${bitId}`,
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(equipBitCosmetic) Error: ${err.message}`,
        }
    }
}

/**
 * Unequips one or multiple cosmetic items from a bit.
 */
export const unequipBitCosmeticSlots = async (twitterId: string, bitId: number, slots: BitCosmeticSlot[]): Promise<ReturnValue> => {
    if (!slots || slots.length === 0) {
        return {
            status: Status.ERROR,
            message: `(unequipBitCosmeticSlots) No slots provided to unequip cosmetics from`,
        }
    }

    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean(),
        ]);

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(unequipBitCosmeticSlots) User with Twitter ID: ${twitterId} not found`,
            };
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} not found`,
            };
        }

        // if the bit is not owned by the user, return an error.
        if (bit.ownerData.currentOwnerId !== user._id) {
          return {
            status: Status.ERROR,
            message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} is not owned by user with Twitter ID: ${twitterId}`,
          };
        }

        const bitUpdateOperations = {
          $set: {}
        }

        const cosmeticUpdateOperations: Array<{
            cosmeticId: number,
            updateOperations: {
                $set: {}
            }
        }> = [];

        for (const slot of slots) {
            const equippedCosmetic: EquippedCosmeticData = bit.equippedCosmetics[slot.toLowerCase()];

            // check if this slot has a cosmetic equipped.
            if (!equippedCosmetic || equippedCosmetic.cosmeticId === null) {
                return {
                    status: Status.ERROR,
                    message: `(unequipBitCosmeticSlots) Bit with ID: ${bitId} does not have any cosmetic equipped in the ${slot} slot`,
                }
            }

            // otherwise, simply unequip the cosmetic by setting the `cosmeticId` to `null`, the `cosmeticName` to null and the `equippedAt` to 0.
            bitUpdateOperations.$set[`equippedCosmetics.${slot.toLowerCase()}`] = {
                cosmeticId: null,
                cosmeticName: null,
                equippedAt: 0,
            }

            // change the `equippedBitId` of the cosmetic to 0.
            cosmeticUpdateOperations.push({
                cosmeticId: equippedCosmetic.cosmeticId,
                updateOperations: {
                    $set: {
                        equippedBitId: 0
                    }
                }
            });
        }

        const cosmeticUpdatePromises = cosmeticUpdateOperations.map(async ({ cosmeticId, updateOperations }) => {
            return UserBitCosmeticModel.updateOne({ bitCosmeticId: cosmeticId }, updateOperations);
        });

        // update the bit and the cosmetics.
        await Promise.all([
            BitModel.updateOne({ bitId, ownerData: { currentOwnerId: user._id } }, bitUpdateOperations),
            ...cosmeticUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(unequipBitCosmeticSlots) Successfully unequipped cosmetics from bit with ID: ${bitId}`,
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(unequipBitCosmeticSlots) Error: ${err.message}`,
        }
    }
}

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