import { IslandModel, UserModel } from '../utils/constants/db';
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

            // check if `user.inventory.islandIds` is an array. some users don't have full data, so we skip if it's not an array
            if (!Array.isArray(user.inventory.islandIds)) {
                console.error(`(updateUserIslandIds) User ${user._id} does not have an array for islandIds`);
                continue;
            }

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

export const fixDuplicates = async (): Promise<void> => {
    try {
        await findDuplicateIslandIds();
        await updateUserIslandIds();
    } catch (err: any) {
        console.error(`(fixDuplicates) ${err.message}`);
    }
}