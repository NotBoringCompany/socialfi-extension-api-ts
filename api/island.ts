import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF } from '../utils/constants/island';
import { calcCurrentRate } from './bit';
import { Resource, ResourceType } from '../models/resource';
import { UserSchema } from '../schemas/User';

/**
 * Drops a resource for a user's island. 
 * 
 * Should only be called when gathering progress has reached >= 100% (and then reset back to 0%); scheduler should check this.
 * 
 * Also assumes that resources can still be dropped. Additional scheduler is needed to check if resources left is still > 0 to drop resource.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const dropResource = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        // firstly, check if the user owns the island
        const user = await User.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(dropResource) User not found.`
            }
        }

        // check if the islandId is in the user's islandIds; if not, return unauthorized
        if (!user.inventory?.islandIds.includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(dropResource) User does not own Island ID ${islandId}.`
            }
        }

        const island = await Island.findOne({ islandId });

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(dropResource) Island not found.`
            }
        }

        // randomize the resource from the effective drop chances based on the island's type and level
        const resourceType: ResourceType = randomizeResourceFromChances(<IslandType>island.type, island.currentLevel);

        // firstly check if `claimableResources` is empty.
        const claimableResources: Resource[] = island.islandResourceStats?.claimableResources;

        if (claimableResources.length === 0 || !claimableResources) {
            // if empty, create a new resource and add it to the island's `claimableResources`
            const newResource: Resource = {
                type: resourceType,
                amount: 1
            }

            // add the new resource to the island's `claimableResources`
            await Island.updateOne({ islandId }, { $push: { 'islandResourceStats.claimableResources': newResource } });
        } else {
            // if not empty, check if the resource already exists in `claimableResources`
            const existingResourceIndex = claimableResources.findIndex(r => r.type === resourceType);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                await Island.updateOne({ islandId }, { $inc: { [`islandResourceStats.claimableResources.${existingResourceIndex}.amount`]: 1 } });
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: Resource = {
                    type: resourceType,
                    amount: 1
                }

                // add the new resource to the island's `claimableResources`
                await Island.updateOne({ islandId }, { $push: { 'islandResourceStats.claimableResources': newResource } });
            }
        }

        // then, check if `resourcesGathered` is empty.
        const resourcesGathered: Resource[] = island.islandResourceStats?.resourcesGathered;

        if (resourcesGathered.length === 0 || !resourcesGathered) {
            // if empty, create a new resource and add it to the island's `resourcesGathered`
            const newResource: Resource = {
                type: resourceType,
                amount: 1
            }

            // add the new resource to the island's `resourcesGathered`
            await Island.updateOne({ islandId }, { $push: { 'islandResourceStats.resourcesGathered': newResource } });
        } else {
            // if not empty, check if the resource already exists in `resourcesGathered`
            const existingResourceIndex = resourcesGathered.findIndex(r => r.type === resourceType);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                await Island.updateOne({ islandId }, { $inc: { [`islandResourceStats.resourcesGathered.${existingResourceIndex}.amount`]: 1 } });
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: Resource = {
                    type: resourceType,
                    amount: 1
                }

                // add the new resource to the island's `resourcesGathered`
                await Island.updateOne({ islandId }, { $push: { 'islandResourceStats.resourcesGathered': newResource } });
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(dropResource) Island ID ${islandId} has dropped a resource: ${resourceType}.`,
            data: {
                resourceType
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(dropResource) Error: ${err.message}`
        }
    }
}

/**
 * Randomizes a resource from the effective drop chances based on the island's type and level.
 */
export const randomizeResourceFromChances = (type: IslandType, level: number): ResourceType => {
    // calculate the effective drop chance rates based on the island's type and level
    const effectiveDropChances: ResourceDropChance = calcEffectiveResourceDropChances(type, level);

    // rand between 1 to 100 to determine which resource to drop
    const rand = Math.random() * 100 + 1;

    // calculate the cumulative probability for each resource and see if the rand falls within the range
    let cumulativeProbability = 0;

    for (let [resource, probability] of Object.entries(effectiveDropChances)) {
        cumulativeProbability += probability;

        if (rand <= cumulativeProbability) {
            // capitalize the first letter of the resource to match the ResourceType enum
            resource = resource.charAt(0).toUpperCase() + resource.slice(1);

            return <ResourceType>resource;
        }
    }
}

/**
 * Adds an island (e.g. when obtained via Terra Capsulator) to the database.
 */
export const addIslandToDatabase = async (island: Island): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const newIsland = new Island(island);

        await newIsland.save();

        return {
            status: Status.SUCCESS,
            message: `(addIslandToDatabase) Island added to database.`,
            data: {
                island: newIsland
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addIslandToDatabase) Error: ${err.message}`
        }
    }

}

/**
 * Fetches the latest island id from the database.
 */
export const getLatestIslandId = async (): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const latestIslandId = await Island.countDocuments();

        return {
            status: Status.SUCCESS,
            message: `(getLatestIslandId) Latest island id fetched.`,
            data: {
                latestIslandId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestIslandId) Error: ${err.message}`
        }
    }
}

/**
 * Randomizes the base resource cap of an Island.
 */
export const randomizeBaseResourceCap = (type: IslandType): number => {
    // get the default resource cap based on the island type
    const defaultResourceCap = DEFAULT_RESOURCE_CAP(type);

    // rand between 0.8 and 1.2 to multiply the default resource cap by
    const resCapRand = Math.random() * 0.4 + 0.8;

    return defaultResourceCap * resCapRand;
}

/**
 * Calculates the effective gathering/earning rate of the island, based on the amount of bits placed on the island.
 * 
 * NOTE: to prevent miscalculations, ensure that:
 * 
 * 1. `baseRates`, `bitLevels`, and `initialGrowthRates` are all of the same length.
 * 
 * 2. the indexes of each array correspond to the same bit; for example, if `baseRates[0]` = 0.025, `bitLevels[0]` = 3 and `initialGrowthRates[0]` = 0.0002,
 * this should mean that Bit #1 has a base gathering/earning rate of 0.025, is at level 3, and has an initial growth rate of 0.0002.
 */
export const calcEffectiveRate = (
    type: RateType,
    baseRates: number[],
    bitLevels: number[],
    initialGrowthRates: number[]
): number => {
    // check if all arrays have the same length, else throw an error.
    if (baseRates.length === bitLevels.length && bitLevels.length === initialGrowthRates.length) {
        let sum = 0;
        // `n` refers to the total number of bits; since all arrays at this point are assumed the same length, we can just pick any of the lengths.
        let n = baseRates.length;

        for (let i = 0; i < n; i++) {
            // get the current rate for each bit
            const currentRate = calcCurrentRate(type, baseRates[i], bitLevels[i], initialGrowthRates[i]);

            // add the current rate to the sum
            sum += currentRate;
        }

        // multiply the sum with the reduction modifier part of the formula
        const reductionModifier = type === RateType.GATHERING ? GATHERING_RATE_REDUCTION_MODIFIER : EARNING_RATE_REDUCTION_MODIFIER;

        return sum * (1 - (reductionModifier * (n - 1)));
    } else {
        throw new Error(`(calcEffectiveRate) Arrays are not of the same length.`);
    }
}

/**
 * Calculates the effective resource drop chances after including the resource drop chance diff based on the island's level.
 */
export const calcEffectiveResourceDropChances = (type: IslandType, level: number): ResourceDropChance => {
    // get the base resource drop chances for the island type
    const dropChances = RESOURCE_DROP_CHANCES(type);

    // get the resource drop chance diff based on the island's level
    const resourceDiff = calcResourceDropChanceDiff(type, level);

    return {
        stone: dropChances.stone + resourceDiff.stone,
        keratin: dropChances.keratin + resourceDiff.keratin,
        silver: dropChances.silver + resourceDiff.silver,
        diamond: dropChances.diamond + resourceDiff.diamond,
        relic: dropChances.relic + resourceDiff.relic
    }
}

/**
 * Gets the base resource modifier/diff based on the island type and multiply the values by the island's level - 1 (since level 1 uses base resource drop chances).
 */
export const calcResourceDropChanceDiff = (type: IslandType, level: number): ResourceDropChanceDiff => {
    const resourceDiff = RESOURCE_DROP_CHANCES_LEVEL_DIFF(type);

    return {
        stone: resourceDiff.stone * (level - 1),
        keratin: resourceDiff.keratin * (level - 1),
        silver: resourceDiff.silver * (level - 1),
        diamond: resourceDiff.diamond * (level - 1),
        relic: resourceDiff.relic * (level - 1)
    }
}