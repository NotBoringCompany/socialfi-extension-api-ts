import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { BIT_PLACEMENT_CAP } from '../utils/constants/island';
import { ReturnValue, Status } from '../utils/retVal';

export const findDuplicateIslandIds = async (): Promise<void> => {
    try {
        // fetch the duplicate islandIds
        const duplicates = await IslandModel.aggregate([
            {
                $group: {
                    _id: '$islandId',
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            },
        ]);

        const islandUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        const bitUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        const userUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        const latestIslandId = await IslandModel.findOne().sort({ islandId: -1 }).exec();

        // we will use this to increment the islandIds
        let latestIslandCounter = latestIslandId?.islandId + 1 ?? 0;

        console.log(`(findDuplicateIslandIds) Found ${duplicates.length} duplicate islandIds: ${JSON.stringify(duplicates, null, 2)}`);

        // console.log(`(findDuplicateIslandIds) Found ${duplicates.length} duplicate islandIds: ${JSON.stringify(duplicates, null, 2)}`);

        // for each duplicate island id, if there is more than 1 occurrence, fetch count - 1 of the duplicates (because we want to keep 1 of them)
        for (const duplicate of duplicates) {
            const islands = await IslandModel.find({ islandId: duplicate._id }).sort({ _id: 1 }).skip(1).exec();

            // check if islands.length matches the `count` from the aggregate
            const duplicateInstance = duplicates.find(d => d._id === duplicate._id);

            // because we skipped 1, we should have count - 1 islands
            if (islands.length !== duplicateInstance?.count - 1) {
                console.error(`(findDuplicateIslandIds) Found ${islands.length} islands with islandId ${duplicate._id}, but expected ${duplicateInstance?.count}`);
                continue;
            }

            // do these things:
            // 1. for each island, update the islandId to a unique one (increment the latestIslandCounter)
            // 2. check the `placedBitIds` of the island. if there are any bits, for each of these bits, update the `placedIslandId` to the new islandId
            // 3. check the owner of the island (island.owner). query the user (owner)'s `user.inventory.islandIds` array, find the old islandId and replace it with the new one
            // NOTE: #3 will be done in `updateUserIslandIds`
            for (const island of islands) {
                // 1. update the islandId
                islandUpdateOperations.push({
                    id: island._id,
                    updateOperations: {
                        $set: {
                            islandId: latestIslandCounter
                        }
                    }
                });

                // 2. check if there are any bits placed in the island
                const placedBitIds = island.placedBitIds;

                // if there are any bits placed in the island, update the `placedIslandId` of each bit
                if (placedBitIds.length > 0) {
                    for (const bitId of placedBitIds) {
                        bitUpdateOperations.push({
                            id: bitId,
                            updateOperations: {
                                $set: {
                                    placedIslandId: latestIslandCounter
                                }
                            }
                        });
                    }
                }

                //3. THIS WILL BE DONE IN `updateUserIslandIds`. DO NOT DO THIS HERE

                // increment the latestIslandCounter
                latestIslandCounter++;
            }
        }

        // console.log(`(findDuplicateIslandIds) islandUpdateOperations: ${JSON.stringify(islandUpdateOperations, null, 2)}`);
        // console.log(`(findDuplicateIslandIds) bitUpdateOperations: ${JSON.stringify(bitUpdateOperations, null, 2)}`);
        // console.log(`(findDuplicateIslandIds) userUpdateOperations: ${JSON.stringify(userUpdateOperations, null, 2)}`);

        // perform the updates
        const userUpdatePromises = userUpdateOperations.length > 0 && userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        const islandUpdatePromises = islandUpdateOperations.length > 0 && islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        const bitUpdatePromises = bitUpdateOperations.length > 0 && bitUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        await Promise.all([
            ...userUpdatePromises,
            ...islandUpdatePromises,
            ...bitUpdatePromises
        ]);

        console.log(`(findDuplicateIslandIds) Successfully updated ${duplicates.length} duplicate islandIds`);
    } catch (err: any) {
        console.error(`(findDuplicateIslandIds) ${err.message}`);
    }
}

/**
 * Updates the user's owned islandIds in `inventory.islandIds` to match the islands they own in `Islands`.
 * 
 * Called after `findDuplicateIslandIds` to ensure that the user's `inventory.islandIds` array is up-to-date.
 */
export const updateUserIslandIds = async (): Promise<void> => {
    try {

        const [users, islands] = await Promise.all([
            UserModel.find().lean().exec(),
            IslandModel.find().lean().exec()
        ]);

        let mismatches = 0;

        const userUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        // for each user, fetch the islands they own in `Islands`.
        // if the user's `inventory.islandIds` array does not match the islands they own in `Islands`, update the `inventory.islandIds` array
        for (const user of users) {
            const ownedIslands = islands.filter(island => island.owner === user._id);

            // some users may not have islands or they don't have full data. in this case, skip the user
            if (ownedIslands.length === 0 || user.inventory?.islandIds === undefined) {
                console.error(`(updateUserIslandIds) User ${user._id} does not own any islands or has undefined islandIds`);
                continue;
            }

            // // check if `user.inventory.islandIds` is an array. some users may have accidentally switched the type to an object, so we need to set it back.
            // if (!Array.isArray(user.inventory.islandIds)) {
            //     console.error(`(updateUserIslandIds) User ${user._id} does not have an array for islandIds`);
            //     mismatches++;
                
            //     // update the user's `inventory.islandIds` array
            //     const ownedIslandIds = new Set(ownedIslands.map(island => island.islandId));

            //     userUpdateOperations.push({
            //         id: user._id,
            //         updateOperations: {
            //             $set: {
            //                 // `ownedIslandIds` is the true source of truth for the islands owned.
            //                 // convert `ownedIslandIds` to an array
            //                 'inventory.islandIds': [...ownedIslandIds]
            //             }
            //         }
            //     });
            //     continue;
            // }

            // check if the contents of `ownedIslandIds` matches `user.inventory.islandIds` (don't care about the order)
            // if it does not, update the `inventory.islandIds` array
            // NOTE: we set this to a Set to ignore any concerns of the order of elements
            const ownedIslandIds = new Set(ownedIslands.map(island => island.islandId));
            const userIslandIds = new Set(user.inventory.islandIds as number[]);

            // check if all elements in `ownedIslandIds` are in `userIslandIds`
            const allMatch = [...ownedIslandIds].every(islandId => userIslandIds.has(islandId));

            if (!allMatch) {
                console.log(`(updateUserIslandIds) User ${user._id} has mismatched islandIds. Updating...`);

                mismatches++;

                // update the user's `inventory.islandIds` array
                userUpdateOperations.push({
                    id: user._id,
                    updateOperations: {
                        $set: {
                            // `ownedIslandIds` is the true source of truth for the islands owned.
                            // convert `ownedIslandIds` to an array
                            'inventory.islandIds': [...ownedIslandIds]
                        }
                    }
                });
            }
        }

        console.log(`(updateUserIslandIds) Found ${mismatches} mismatches`);

        // perform the updates
        const userUpdatePromises = userUpdateOperations.length > 0 && userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        await Promise.all(userUpdatePromises);

        console.log(`(updateUserIslandIds) Successfully updated ${mismatches} users`);
    } catch (err: any) {
        console.error(`(updateUserIslandIds) ${err.message}`);
    }
}

/**
 * Finds all duplicate bit IDs and replace them.
 */
export const findDuplicateBitIds = async (): Promise<void> => {
    try {
        const duplicates = await BitModel.aggregate([
            {
                $group: {
                    _id: '$bitId',
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            },
        ]);

        const islandUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        const bitUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];
        
        const userUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        console.log(`(findDuplicateBitIds) Found ${duplicates.length} duplicate bitIds., ${JSON.stringify(duplicates, null, 2)}`);

        const latestBitId = await BitModel.findOne().sort({ bitId: -1 }).exec();

        // we will use this to increment the bitIds
        let latestBitIdCounter = latestBitId?.bitId + 1 ?? 0;

        // for each duplicate bit id, if there is more than 1 occurrence, fetch count - 1 of the duplicates (because we want to keep 1 of them)
        for (const duplicate of duplicates) {
            const bits = await BitModel.find({ bitId: duplicate._id }).sort({ _id: 1 }).skip(1).exec();

            // check if bits.length matches the `count` from the aggregate
            const duplicateInstance = duplicates.find(d => d._id === duplicate._id);

            // because we skipped 1, we should have count - 1 bits
            if (bits.length !== duplicateInstance?.count - 1) {
                console.error(`(findDuplicateBitIds) Found ${bits.length} bits with bitId ${duplicate._id}, but expected ${duplicateInstance?.count}`);
                continue;
            }

            // do these things:
            // 1. for each bit, update the bitId to a unique one (increment the latestBitId)
            // 2. check the `placedIslandId` of the bit. if there is a bit, fetch the island, and update the `placedBitIds` array to remove the old bitId and add the new one
            // 3. check the owner of the bit (bit.owner). query the user (owner)'s `user.inventory.bitIds` array, find the old bitId and replace it with the new one
            // NOTE: #3 will be done in `updateUserBitIds`
            for (const bit of bits) {
                // 1. update the bitId
                bitUpdateOperations.push({
                    id: bit._id,
                    updateOperations: {
                        $set: {
                            bitId: latestBitIdCounter
                        }
                    }
                });

                // 2. check if the bit is placed in an island
                const placedIslandId = bit.placedIslandId;

                // if there is a bit placed in an island, update the `placedBitIds` array
                if (placedIslandId > 0) {
                    const island = await IslandModel.findOne({ islandId: placedIslandId }).lean().exec();

                    islandUpdateOperations.push({
                        id: island._id,
                        updateOperations: {
                            $set: {
                                placedBitIds: island.placedBitIds.filter((bitId: number) => bitId !== bit.bitId).concat(latestBitIdCounter)
                            }
                        }
                    });
                }

                //3. THIS WILL BE DONE IN `updateUserBitIds`. DO NOT DO THIS HERE

                // increment the latestBitIdCounter
                latestBitIdCounter++;
            }
        }

        // console.log(`(findDuplicateBitIds) bitUpdateOperations: ${JSON.stringify(bitUpdateOperations, null, 2)}`);
        // console.log(`(findDuplicateBitIds) islandUpdateOperations: ${JSON.stringify(islandUpdateOperations, null, 2)}`);

        // perform the updates
        const userUpdatePromises = userUpdateOperations.length > 0 && userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        const islandUpdatePromises = islandUpdateOperations.length > 0 && islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        const bitUpdatePromises = bitUpdateOperations.length > 0 && bitUpdateOperations.map(async (op) => {
            return BitModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        // skip any empty promises
        if (userUpdatePromises.length > 0) {
            await Promise.all(userUpdatePromises);
        }

        if (islandUpdatePromises.length > 0) {
            await Promise.all(islandUpdatePromises);
        }

        if (bitUpdatePromises.length > 0) {
            await Promise.all(bitUpdatePromises);
        }

        console.log(`(findDuplicateBitIds) Successfully updated ${duplicates.length} duplicate bitIds`);
    } catch (err: any) {
        console.error(`(findDuplicateBitIds) ${err.message}`);
    }
}

/**
 * Updates the user's owned bitIds in `inventory.bitIds` to match the bits they own in `Bits`.
 */
export const updateUserBitIds = async (): Promise<void> => {
    try {
        const [users, bits] = await Promise.all([
            UserModel.find().lean().exec(),
            BitModel.find().lean().exec()
        ]);

        let mismatches = 0;

        const userUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        // for each user, fetch the bits they own in `Bits`.
        // if the user's `inventory.bitIds` array does not match the bits they own in `Bits`, update the `inventory.bitIds` array
        for (const user of users) {
            const ownedBits = bits.filter(bit => bit.owner === user._id);

            // check if `user.inventory.bitIds` is an array. some users don't have full data, so we skip if it's not an array
            if (!Array.isArray(user.inventory.bitIds)) {
                console.error(`(updateUserBitIds) User ${user._id} does not have an array for bitIds`);
                continue;
            }

            // check if the contents of `ownedBitIds` matches `user.inventory.bitIds` (don't care about the order)
            // if it does not, update the `inventory.bitIds` array
            // NOTE: we set this to a Set to ignore any concerns of the order of elements
            const ownedBitIds = new Set(ownedBits.map(bit => bit.bitId));
            const userBitIds = new Set(user.inventory.bitIds as number[]);

            // check if all elements in `ownedBitIds` are in `userBitIds`
            const allMatch = [...ownedBitIds].every(bitId => userBitIds.has(bitId));

            if (!allMatch) {
                console.log(`(updateUserBitIds) User ${user._id} has mismatched bitIds. Updating...`);

                mismatches++;

                // update the user's `inventory.bitIds` array
                userUpdateOperations.push({
                    id: user._id,
                    updateOperations: {
                        $set: {
                            // `ownedBitIds` is the true source of truth for the bits owned.
                            // convert `ownedBitIds` to an array
                            'inventory.bitIds': [...ownedBitIds]
                        }
                    }
                });
            }
        }

        console.log(`(updateUserBitIds) Found ${mismatches} mismatches`);

        // perform the updates
        const userUpdatePromises = userUpdateOperations.length > 0 && userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.id }, op.updateOperations);
        })

        await Promise.all(userUpdatePromises);

        console.log(`(updateUserBitIds) Successfully updated ${mismatches} users`);
    } catch (err: any) {
        console.error(`(updateUserBitIds) ${err.message}`);
    }
}

/**
 * Checks, for each island, if the `placedBitIds` array contains duplicate elements.
 */
export const checkDuplicateBitsPlaced = async (): Promise<void> => {
    try {
        const [islands, bits] = await Promise.all([
            IslandModel.find().lean().exec(),
            BitModel.find().lean().exec()
        ]);

        let mismatches = 0;

        const islandUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        // for each island, check the `placedBitIds` array. if there are any duplicates, remove them
        for (const island of islands) {
            const placedBitIds = island.placedBitIds;

            // if there are no bits placed in the island, skip
            if (placedBitIds.length === 0) {
                continue;
            }

            // check if there are any duplicates
            const uniquePlacedBitIds = [...new Set(placedBitIds)];

            if (uniquePlacedBitIds.length !== placedBitIds.length) {
                console.log(`(checkDuplicateBitsPlaced) Island ${island.islandId} has duplicate bitIds. Removing duplicates...`);

                mismatches++;

                islandUpdateOperations.push({
                    id: island._id,
                    updateOperations: {
                        $set: {
                            placedBitIds: uniquePlacedBitIds
                        }
                    }
                });
            }
        }

        console.log(`(checkDuplicateBitsPlaced) Found ${mismatches} mismatches`);

        // perform the updates
        const islandUpdatePromises = islandUpdateOperations.length > 0 && islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ _id: op.id }, op.updateOperations);
        });

        await Promise.all(islandUpdatePromises);

        console.log(`(checkDuplicateBitsPlaced) Successfully updated ${mismatches} islands`);
    } catch (err: any) {
        console.error(`(checkDuplicateBitsPlaced) ${err.message}`);
    }
}

/**
 * Checks if the bits placed within an island have the correct `placedIslandId`.
 */
export const checkBitPlacedCorrectly = async (): Promise<void> => {
    try {
        const [bits, islands] = await Promise.all([
            BitModel.find().lean().exec(),
            IslandModel.find().lean().exec()
        ]);

        let mismatches = 0;

        const islandUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $push: {},
            }
        }> = [];

        const bitUpdateOperations: Array<{
            id: string;
            updateOperations: {
                $set: {},
            }
        }> = [];

        // for each bit, check the `placedIslandId`. check if the island with the given island ID has the bit in its `placedBitIds` array
        for (const bit of bits) {
            if (bit.placedIslandId === 0) {
                continue;
            }

            const island = islands.find(island => island.islandId === bit.placedIslandId);

            if (!island) {
                console.error(`(checkBitPlacedCorrectly) Bit ${bit.bitId} has an invalid placedIslandId ${bit.placedIslandId}`);
                continue;
            }

            if (!island.placedBitIds.includes(bit.bitId)) {
                console.error(`(checkBitPlacedCorrectly) Bit ${bit.bitId} is not in the placedBitIds array of island ${island.islandId}`);
                mismatches++;

                // we need to check the following:
                // 1. if the island's `placedBitIds`.length is >= BIT_PLACEMENT_CAP, convert the `placedIslandId` of the bit back to 0.
                // this is because we cannot add more bits to the island.
                // 2. if the island's `placedBitIds`.length is < BIT_PLACEMENT_CAP, add the bit to the `placedBitIds` array of the island.
                if (island.placedBitIds.length >= BIT_PLACEMENT_CAP) {
                    // 1. convert the `placedIslandId` of the bit back to 0
                    bitUpdateOperations.push({
                        id: bit._id,
                        updateOperations: {
                            $set: {
                                placedIslandId: 0
                            }
                        }
                    });
                } else {
                    // 2. add the bit to the `placedBitIds` array of the island
                    islandUpdateOperations.push({
                        id: island._id,
                        updateOperations: {
                            $push: {
                                placedBitIds: bit.bitId
                            }
                        }
                    });
                }
            }
        }

        console.log(`(checkBitPlacedCorrectly) Found ${mismatches} mismatches`);

        // perform the updates
        const islandUpdatePromises = islandUpdateOperations.length > 0 && islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ _id: op.id }, op.updateOperations);
        });

        const bitUpdatePromises = bitUpdateOperations.length > 0 && bitUpdateOperations.map(async (op) => {
            return BitModel.updateOne({ _id: op.id }, op.updateOperations);
        });

        if (islandUpdatePromises.length > 0) {
            await Promise.all(islandUpdatePromises);
        }

        if (bitUpdatePromises.length > 0) {
            await Promise.all(bitUpdatePromises);
        }

        console.log(`(checkBitPlacedCorrectly) Successfully updated ${mismatches} bits`);
    } catch (err: any) {
        console.error(`(checkBitPlacedCorrectly) ${err.message}`);
    }
}

/**
 * NOTE: CALL THIS TO FIX ALL DUPLICATES FOR ISLANDS AND BITS.
 */
export const fixDuplicates = async (): Promise<void> => {
    try {
        await findDuplicateIslandIds();
        await updateUserIslandIds();
        await findDuplicateBitIds();
        await updateUserBitIds();
        await checkDuplicateBitsPlaced();
        await checkBitPlacedCorrectly();
    } catch (err: any) {
        console.error(`(fixDuplicates) ${err.message}`);
    }
}