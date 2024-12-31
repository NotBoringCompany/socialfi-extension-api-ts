import { ClientSession } from 'mongoose';
import { TEST_CONNECTION, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';
import { CombinedResources, ResourceType } from '../models/resource';
import { FoodType } from '../models/food';
import { AssetType } from '../models/asset';
import { resources } from '../utils/constants/resource';

/**
 * Add items to the user's inventory.
 */
export const addToInventory = async (
    userId: string,
    asset: AssetType | string,
    amount: number,
    _session?: ClientSession
): Promise<ReturnValue> => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        // determine the asset type dynamically (food, resource, or item)
        const isFood = Object.values(FoodType).includes(asset as FoodType);
        const isResource = Object.values(CombinedResources).includes(asset as ResourceType);

        const assetType = isFood ? 'food' : isResource ? 'resource' : 'item';

        const resource = isResource && resources.find((resource) => resource.type === asset);

        if (isResource) {
            if (!resource) throw new Error('Asset not found');

            // increase user's weight if the asset is resource
            const user = await UserModel.findOneAndUpdate(
                { _id: userId },
                {
                    $inc: {
                        ['inventory.weight']: resource.weight * amount,
                    },
                },
                { session, new: true }
            );

            // if after the operation the weight exceed the maximum weight, then abort the operation
            if (user.inventory.weight > user.inventory.maxWeight) {
                throw new Error(`Inventory full`);
            }
        }

        // dynamically get the inventory key: items, foods, resources
        const inventoryKey = `inventory.${assetType}s`;

        // match criteria for the asset
        const matchCriteria = {
            _id: userId,
            [`${inventoryKey}.type`]: asset,
        };

        // attempt to increment the asset amount if it exists
        const updateResult = await UserModel.updateOne(
            matchCriteria,
            { $inc: { [`${inventoryKey}.$.amount`]: amount } },
            { session }
        ).exec();

        if (updateResult.modifiedCount === 0) {
            // asset does not exist, push a new one into the inventory
            const newAsset = {
                type: asset,
                amount,
                mintableAmount: 0,
                ...(assetType === 'item' && { totalAmountConsumed: 0, weeklyAmountConsumed: 0 }),
                ...(isResource && resource),
            };

            await UserModel.updateOne({ _id: userId }, { $push: { [inventoryKey]: newAsset } }, { session }).exec();
        }

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(addItem) Item added to the inventory successfully`,
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(addItem) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
};

/**
 * Batch add items to the user's inventory.
 */
export const batchAddToInventory = async (
    userId: string,
    assets: { asset: AssetType | string; amount: number }[],
    _session?: ClientSession
): Promise<ReturnValue> => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        let totalAddedWeight = 0;

        for (const { asset, amount } of assets) {
            // skip if the amount less than zero
            if (amount <= 0) continue;

            // determine the asset type dynamically (food, resource, or item)
            const isFood = Object.values(FoodType).includes(asset as FoodType);
            const isResource = Object.values(CombinedResources).includes(asset as ResourceType);

            const assetType = isFood ? 'food' : isResource ? 'resource' : 'item';

            const resource = isResource && resources.find((resource) => resource.type === asset);

            if (isResource) {
                if (!resource) throw new Error(`Asset not found: ${asset}`);

                // accumulate the total added weight
                totalAddedWeight += resource.weight * amount;
            }

            // dynamically get the inventory key: items, foods, resources
            const inventoryKey = `inventory.${assetType}s`;

            // match criteria for the asset
            const matchCriteria = {
                _id: userId,
                [`${inventoryKey}.type`]: asset,
            };

            // attempt to increment the asset amount if it exists
            const updateResult = await UserModel.updateOne(
                matchCriteria,
                { $inc: { [`${inventoryKey}.$.amount`]: amount } },
                { session }
            ).exec();

            if (updateResult.modifiedCount === 0) {
                // asset does not exist, push a new one into the inventory
                const newAsset = {
                    type: asset,
                    amount,
                    mintableAmount: 0,
                    ...(assetType === 'item' && { totalAmountConsumed: 0, weeklyAmountConsumed: 0 }),
                    ...(isResource && resource),
                };

                await UserModel.updateOne({ _id: userId }, { $push: { [inventoryKey]: newAsset } }, { session }).exec();
            }
        }

        if (totalAddedWeight > 0) {
            // increase user's weight
            const user = await UserModel.findOneAndUpdate(
                { _id: userId },
                { $inc: { ['inventory.weight']: totalAddedWeight } },
                { session, new: true }
            );

            // if after the operation the weight exceeds the maximum weight, then abort the operation
            if (user.inventory.weight > user.inventory.maxWeight) {
                throw new Error(`Inventory full`);
            }
        }

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `Items added to the inventory successfully`,
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(batchAdd) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
};

/**
 * Batch deduct items from the user's inventory.
 */
export const batchDeductFromInventory = async (
    userId: string,
    assets: { asset: AssetType | string; amount: number }[],
    _session?: ClientSession
): Promise<ReturnValue> => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();    

    try {
        let totalDeductedWeight = 0;

        for (const { asset, amount } of assets) {
            // determine the asset type dynamically (food, resource, or item)
            const isFood = Object.values(FoodType).includes(asset as FoodType);
            const isResource = Object.values(CombinedResources).includes(asset as ResourceType);

            const assetType = isFood ? 'food' : isResource ? 'resource' : 'item';

            const resource = isResource && resources.find((resource) => resource.type === asset);

            if (isResource) {
                if (!resource) throw new Error(`Asset not found: ${asset}`);

                // accumulate the total deducted weight
                totalDeductedWeight += resource.weight * amount;
            }

            // dynamically get the inventory key: items, foods, resources
            const inventoryKey = `inventory.${assetType}s`;

            // match criteria for the asset
            const matchCriteria = {
                _id: userId,
                [`${inventoryKey}`]: { 
                    $elemMatch: {
                        type: asset,
                        amount: { $gte: amount } // ensure sufficient amount exists
                    }
                }
            };

            // attempt to decrement the asset amount
            const updateResult = await UserModel.updateOne(
                matchCriteria,
                { $inc: { [`${inventoryKey}.$.amount`]: -amount } },
                { session }
            ).exec();

            if (updateResult.modifiedCount === 0) {
                // asset does not exist or insufficient amount
                throw new Error(`Insufficient amount or asset not found: ${asset}`);
            }
        }

        if (totalDeductedWeight > 0) {
            // decrease user's weight
            await UserModel.updateOne(
                { _id: userId },
                { $inc: { ['inventory.weight']: -totalDeductedWeight } },
                { session }
            );
        }

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(batchDeduct) Items deducted from the inventory successfully`,
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(batchDeduct) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
};

