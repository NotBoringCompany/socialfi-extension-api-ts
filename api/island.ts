import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { BIT_PLACEMENT_CAP, BIT_PLACEMENT_MIN_RARITY_REQUIREMENT, DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER, ISLAND_EVOLUTION_COST, MAX_ISLAND_LEVEL, RARITY_DEVIATION_REDUCTIONS, RESOURCES_CLAIM_COOLDOWN, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF, TOTAL_ACTIVE_ISLANDS_ALLOWED, X_COOKIE_CLAIM_COOLDOWN, X_COOKIE_TAX, randomizeIslandTraits } from '../utils/constants/island';
import { calcBitCurrentRate, getBits } from './bit';
import { Resource, ResourceType } from '../models/resource';
import { UserSchema } from '../schemas/User';
import { Modifier } from '../models/modifier';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitRarity, BitRarityNumeric } from '../models/bit';
import { generateObjectId } from '../utils/crypto';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';

/**
 * Creates a barren island for newly registered users.
 */
export const createBarrenIsland = async (userId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getLatestIslandId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(createBarrenIsland) Error from getLatestIslandId: ${message}`
            }
        }

        const newIsland = new IslandModel({
            _id: generateObjectId(),
            islandId: data.latestIslandId + 1,
            type: IslandType.BARREN,
            owner: userId,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.SIGN_UP,
            currentLevel: 1,
            currentTax: 0,
            placedBitIds: [],
            traits: randomizeIslandTraits(),
            islandResourceStats: {
                baseResourceCap: randomizeBaseResourceCap(IslandType.BARREN),
                resourcesGathered: [],
                claimableResources: [],
                gatheringStart: 0,
                gatheringEnd: 0,
                lastClaimed: 0,
                gatheringProgress: 0
            },
            islandEarningStats: {
                totalXCookiesEarnable: 0,
                totalXCookiesEarned: 0,
                claimableXCookies: 0,
                totalCookieCrumbsEarned: 0,
                claimableCookieCrumbs: 0,
                earningStart: 0,
                crumbsEarningStart: 0,
                earningEnd: 0,
                crumbsEarningEnd: 0,
                lastClaimed: 0,
                crumbsLastClaimed: 0
            },
            islandStatsModifiers: {
                resourceCapModifiers: [],
                gatheringRateModifiers: [],
                earningRateModifiers: []
            }
        });

        await newIsland.save();

        return {
            status: Status.SUCCESS,
            message: `(createBarrenIsland) Barren island created.`,
            data: {
                island: newIsland
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(createBarrenIsland) Error: ${err.message}`
        }
    }
}

/**
 * Gets one or multiple islands based on their IDs.
 */
export const getIslands = async (islandIds: number[]): Promise<ReturnValue> => {
    try {
        const islands = await IslandModel.find({ islandId: { $in: islandIds } });

        return {
            status: Status.SUCCESS,
            message: `(getIsland) Island found.`,
            data: {
                islands
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getIsland) Error: ${err.message}`
        }
    }
}

/**
 * (User) Evolves an island (levelling it up).
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const evolveIsland = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
        const [user, island] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            IslandModel.findOne({ islandId }).lean()
        ]);

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) User not found.`
            }
        }

        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) User does not own the island.`
            }
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) Island not found.`
            }
        }

        // check if the island is already max level, if it is, return an error.
        if (island.currentLevel >= MAX_ISLAND_LEVEL) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) Island is already at max level.`
            }
        }

        // check if the user has enough xCookies
        const userXCookies = user.inventory?.xCookies;

        // calculate the cost to evolve the island based on its current level
        const requiredXCookies = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);

        // if not enough, return an error.
        if (userXCookies < requiredXCookies) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) Not enough cookies to evolve island.`
            }
        }

        // deduct the xCookies from the user
        userUpdateOperations.$inc['inventory.xCookies'] = -requiredXCookies;

        // firstly, check if at this moment, the totalXCookiesSpent is 0.
        // because if it is, it means that earning hasn't started yet, meaning that after evolving the island, `earningStart` will be set to current timestamp, and earning will start.
        const totalXCookiesSpentIsZero = island.islandEarningStats?.totalXCookiesSpent === 0;

        // if totalXCookies spent is 0, evolve the island, increment the totalXCookiesSpent of the island by `requiredXCookies` and also set the `earningStart` to now.
        if (totalXCookiesSpentIsZero) {
            islandUpdateOperations.$inc['currentLevel'] = 1;
            islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;
            islandUpdateOperations.$set['islandEarningStats.earningStart'] = Math.floor(Date.now() / 1000);

            // otherwise, only evolve the island and increment the totalXCookiesSpent.
        } else {
            islandUpdateOperations.$inc['currentLevel'] = 1;
            islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;
        }

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(evolveIsland) Island with ID ${islandId} successfully evolved.`,
            data: {
                islandId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(evolveIsland) Error: ${err.message}`
        }
    }
}

/**
 * (User) Places a bit on an island. Once placed, the bit is locked and cannot be removed until further notice.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island and the bit ID.
 */
export const placeBit = async (twitterId: string, islandId: number, bitId: number): Promise<ReturnValue> => {
    try {
        const [user, bit, island] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean(),
            IslandModel.findOne({ islandId }).lean(),
        ]);

        const bitUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User not found.`
            }
        }

        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(placeBit) User does not own the island.`
            }
        }

        // then, check if the user owns the bit to be placed
        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User does not own the bit.`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit not found.`
            }
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Island not found.`
            }
        }

        // check if the user has more than TOTAL_ACTIVE_ISLANDS_ALLOWED active islands. if yes, return an error.
        const ownedIslands = user.inventory?.islandIds as number[];

        // filter out the islands that have bits placed by querying the `Islands` collection to get the total amount of active islands
        const activeIslands = await IslandModel.find(
            {
                islandId:
                    { $in: ownedIslands },
                placedBitIds: { $exists: true, $ne: [] }
            }).lean();

        if (activeIslands.length >= TOTAL_ACTIVE_ISLANDS_ALLOWED) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User has reached the maximum amount of islands with bits placed.`
            }
        }

        // check if this bit is premium and the island is barren. if both are false, return an error.
        if (!bit.premium && island.type !== IslandType.BARREN) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Non-premium bits cannot be placed on non-barren islands.`
            }
        }

        // check if the bit is already placed on an island or a raft
        if (bit.placedIslandId !== 0 && bit.placedRaftId !== 0) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit is already placed on an island.`
            }
        }

        // check if the island has reached its bit cap
        if (island.placedBitIds.length >= BIT_PLACEMENT_CAP) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Island has reached its bit cap.`
            }
        }

        // check if the bit's rarity is allowed for it to be placed on the island
        const bitRarity = <BitRarity>bit.rarity;
        const minRarityRequired = BIT_PLACEMENT_MIN_RARITY_REQUIREMENT(<IslandType>island.type);
        const bitRarityAllowed = checkBitRarityAllowed(bitRarity, minRarityRequired);

        if (!bitRarityAllowed) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit rarity is too low to be placed on the island.`
            }
        }

        // check for any limitations/negative modifiers from rarity deviation (if bit rarity is lower than the island's type)
        const rarityDeviationReductions = RARITY_DEVIATION_REDUCTIONS(<IslandType>island.type, bitRarity);

        // check for previous `gatheringRateModifiers` from the island's `IslandStatsModifiers`
        // by searching for an origin of `Rarity Deviation` on `gatheringRateModifiers`
        // if not found, create; if found, reduce 1 by the reduction amount
        const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === 'Rarity Deviation');

        if (gatheringRateModifierIndex === -1) {
            // create a new modifier
            const newGatheringRateModifier: Modifier = {
                origin: 'Rarity Deviation',
                // since the value is based on a scale of 0 - 1 (multiplier), divide the reduction amount by 100
                value: 1 - (rarityDeviationReductions.gatheringRateReduction / 100)
            }

            // if modifier value is NOT 1, add the new modifier to the island's `gatheringRateModifiers` (1 means no change in gathering rate, so no need to add it to the array)
            if (newGatheringRateModifier.value !== 1) {
                // add the new modifier to the island's `gatheringRateModifiers`
                islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            }
        } else {
            const currentValue = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex].value;
            const newValue = currentValue - (rarityDeviationReductions.gatheringRateReduction / 100);

            // reduce the value by the reduction amount
            islandUpdateOperations.$set[`islandStatsModifiers.gatheringRateModifiers.${gatheringRateModifierIndex}.value`] = newValue;
        }

        // check for previous `resourceCapModifiers` from the island's `IslandStatsModifiers`
        // by searching for an origin of `Rarity Deviation` on `resourceCapModifiers`
        // if not found, create; if found, reduce the value by the reduction amount
        const resourceCapModifierIndex = (island.islandStatsModifiers?.resourceCapModifiers as Modifier[]).findIndex(modifier => modifier.origin === 'Rarity Deviation');

        if (resourceCapModifierIndex === -1) {
            // create a new modifier
            const newResourceCapModifier: Modifier = {
                origin: 'Rarity Deviation',
                // since the value is based on a scale of 0 - 1 (multiplier), divide the reduction amount by 100
                value: 1 - (rarityDeviationReductions.resourceCapReduction / 100)
            }

            // if modifier value is NOT 1, add the new modifier to the island's `resourceCapModifiers` (1 means no change in resource cap, so no need to add it to the array)
            if (newResourceCapModifier.value !== 1) {
                // add the new modifier to the island's `resourceCapModifiers`
                islandUpdateOperations.$push['islandStatsModifiers.resourceCapModifiers'] = newResourceCapModifier;
            }
        } else {
            const currentValue = island.islandStatsModifiers?.resourceCapModifiers[resourceCapModifierIndex].value;
            const newValue = currentValue - (rarityDeviationReductions.resourceCapReduction / 100);

            // reduce the value by the reduction amount
            islandUpdateOperations.$set[`islandStatsModifiers.resourceCapModifiers.${resourceCapModifierIndex}.value`] = newValue;
        }

        // check if the to-be-put bit is the first one; if yes, start the `gatheringStart` timestamp
        if (island.placedBitIds.length === 0) {
            islandUpdateOperations.$set['islandResourceStats.gatheringStart'] = Math.floor(Date.now() / 1000);
        }

        // place the bit on the island
        islandUpdateOperations.$push['placedBitIds'] = bitId;

        // update the bit to include `placedIslandId`
        bitUpdateOperations.$set['placedIslandId'] = islandId;

        // check if the bit has `totalXCookiesSpent` > 0. if yes, increment the island's `totalXCookiesSpent` by this amount.
        if (bit.totalXCookiesSpent > 0) {
            islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = bit.totalXCookiesSpent;
        }

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations),
            BitModel.updateOne({ bitId }, bitUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(placeBit) Bit placed on the island.`,
            data: {
                bitId,
                islandId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(placeBit) Error: ${err.message}`
        }
    }
}

/** 
 * Checks if the bit's rarity is allowed for it to be placed on the island.
 */
export const checkBitRarityAllowed = (bitRarity: BitRarity, minRarityRequired: BitRarity): boolean => {
    return BitRarityNumeric[bitRarity] >= BitRarityNumeric[minRarityRequired];
}

/**
 * Checks how much tax the user has to pay when claiming xCookies based on the island type and the amount of active islands the user has.
 */
export const checkCurrentTax = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
        // check if user exists
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkCurrentTax) User not found.`
            }
        }

        // get the island ids from the user's inventory
        const islandIds = user.inventory?.islandIds as number[];

        if (islandIds.length === 0 || !islandIds) {
            return {
                status: Status.SUCCESS,
                message: `(checkCurrentTax) User has no islands.`
            }
        }

        // check if the user owns the island
        if (!islandIds.includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(checkCurrentTax) User does not own the island.`
            }
        }

        // filter out the islands that have bits placed by querying the `Islands` collection to get the total amount of active islands
        const activeIslands = await IslandModel.find(
            {
                islandId:
                    { $in: islandIds },
                placedBitIds: { $exists: true, $ne: [] }
            }).lean();

        // get the island from the `islandId` within the `activeIslands` array
        const island = activeIslands.find(island => island.islandId === islandId);

        // calculate the tax based on the amount of active islands
        const tax = X_COOKIE_TAX(<IslandType>island.type, activeIslands.length);

        return {
            status: Status.SUCCESS,
            message: `(checkCurrentTax) Tax calculated.`,
            data: {
                tax
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkCurrentTax) Error: ${err.message}`
        }
    }
}

/**
 * (Called by scheduler, EVERY 10 MINUTES) Loops through all islands and updates the gathering progress for each island.
 * 
 * For islands that have reached >= 100% gathering progress, it should drop a resource and reset the gathering progress back to 0% + the remaining overflow of %.
 */
export const updateGatheringProgressAndDropResource = async (): Promise<void> => {
    try {
        // find islands only where (in `islandResourceStats`):
        // 1. `gatheringStart` is not 0
        // 2. `gatheringEnd` is 0
        // 3. `placedBitIds` has at least a length of 1 (i.e. at least 1 placed bit inside)
        const islands = await IslandModel.find({
            'islandResourceStats.gatheringStart': { $ne: 0 },
            'islandResourceStats.gatheringEnd': 0,
            'placedBitIds.0': { $exists: true }
        }).lean();

        if (islands.length === 0 || !islands) {
            console.error(`(updateGatheringProgressAndDropResource) No islands found.`);
            return;
        }

        // prepare bulk write operations to update all islands' `gatheringProgress`
        const bulkWriteOpsPromises = islands.map(async island => {
            let updateOperations = [];

            let finalGatheringProgress = 0;
            // check current gathering progress
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;

            // get the bits placed on the island to calculate the current gathering rate
            const { status, message, data } = await getBits(island.placedBitIds);

            // if error, just console log and continue to the next island
            if (status !== Status.SUCCESS) {
                console.error(`(updateGatheringProgressAndDropResource) Error For island ID ${island.islandId} from getBits: ${message}`);
                return;
            }

            const bits = data?.bits as Bit[];
            // get the base gathering rates, bit levels, initial gathering growth rates and bit modifiers
            const baseRates = bits.map(bit => bit.farmingStats.baseGatheringRate);
            const bitLevels = bits.map(bit => bit.currentFarmingLevel);
            const initialGrowthRates = bits.map(bit => bit.farmingStats.gatheringRateGrowth);
            const bitModifiers = bits.map(bit => bit.bitStatsModifiers.gatheringRateModifiers);

            // calculate current island gathering rate
            const gatheringRate = calcIslandCurrentRate(
                RateType.GATHERING,
                baseRates,
                bitLevels,
                initialGrowthRates,
                bitModifiers,
                island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
            );

            // to calculate the gathering progress increment every 10 minutes, we need to firstly calculate the time it takes (in hours) to drop 1 resource.
            // the gathering progress increment/hour (in %) will just be 1 / time to drop 1 resource * 100 (or 100/time to drop resource)
            // which means that the gathering progress increment/10 minutes will be the gathering progress increment per hour / 6.
            // example:
            // say an island has a 250 resource cap. if the gathering rate is 0.02% of total resources/hour, this equates to gathering 0.02/100*250 = 0.05 resources per hour.
            // to get 1 resource to drop, it would take 1/0.05 = 20 hours, meaning that each hour, the gathering progress (to drop 1 resource) increments by 1/20*100 = 5%.
            // to get the gathering progress in 10 minutes, divide 5% by 6 to get 0.8333% per 10 minutes.
            const resourcesPerHour = gatheringRate / 100 * island.islandResourceStats?.baseResourceCap;
            const hoursToDropResource = 1 / resourcesPerHour;
            const gatheringProgressIncrementPerHour = 1 / hoursToDropResource * 100;
            // divide by 6 to get the gathering progress increment per 10 minutes
            const gatheringProgressIncrement = gatheringProgressIncrementPerHour / 6;

            console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has a current gathering rate of ${gatheringRate} %/hour and a gathering progress increment of ${gatheringProgressIncrement}%/10 minutes.`)

            if (gatheringProgress + gatheringProgressIncrement < 100) {
                // add to the update operations
                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            $inc: {
                                'islandResourceStats.gatheringProgress': gatheringProgressIncrement
                            }
                        }
                    }
                });
                console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has updated its gathering progress to ${gatheringProgress + gatheringProgressIncrement}.`);
            } else {
                // if >= 100, drop a resource and reset the gathering progress back to 0 + the remaining overflow of %
                const { status, message } = await dropResource(island.islandId);
                if (status !== Status.SUCCESS) {
                    console.error(`(updateGatheringProgressAndDropResource) Error For island ID ${island.islandId} from dropResource: ${message}`);
                }

                // calculate the remaining overflow of %
                finalGatheringProgress = (gatheringProgress + gatheringProgressIncrement) - 100;

                // reset the gathering progress back to 0 + the remaining overflow of %
                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            $set: {
                                'islandResourceStats.gatheringProgress': finalGatheringProgress
                            }
                        }
                    }
                });

                console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has dropped a resource and reset its gathering progress to ${finalGatheringProgress}.`);
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op);

        if (bulkWriteOps.length === 0) {
            console.error(`(updateGatheringProgressAndDropResource) No islands have been updated.`);
            return;
        }

        // execute the bulk write operations
        await IslandModel.bulkWrite(bulkWriteOps);

        console.log(`(updateGatheringProgressAndDropResource) All islands' gathering progresses have been updated.`);
    } catch (err: any) {
        // only console logging; this shouldn't stop the entire process
        console.error(`(updateGatheringProgressAndDropResource) Error: ${err.message}`);
    }
}

/**
 * Updates all eligible islands' `claimableXCookies` based on their current earning rate.
 * 
 * Run by a scheduler every 10 minutes.
 * 
 * NOTE: If 0 xCookies have been spent for an island, this function will skip that island.
 */
export const updateClaimableXCookies = async (): Promise<void> => {
    try {
        // find islands only where xCookies spent is > 0
        const islands = await IslandModel.find({ 'islandEarningStats.totalXCookiesSpent': { $gt: 0 } }).lean();

        if (islands.length === 0 || !islands) {
            console.error(`(updateClaimableXCookies) No islands found.`);
            return;
        }

        // prepare bulk write operations to update all islands' `claimableXCookies`
        const bulkWriteOpsPromises = islands.map(async island => {
            let updateOperations = [];

            // get the bit ids placed on this island and fetch the bits
            const placedBitIds = island.placedBitIds as number[];

            // if no bits are placed, skip this island
            if (placedBitIds.length === 0) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has no bits placed. Skipping...`);
                return;
            }

            // get the bits placed on the island
            const bits = await BitModel.find({ bitId: { $in: placedBitIds } });

            // get the island's current earning rate
            const currentEarningRate = calcIslandCurrentRate(
                RateType.EARNING, 
                bits.map(bit => bit.farmingStats?.baseEarningRate), 
                bits.map(bit => bit.currentFarmingLevel), 
                bits.map(bit => bit.farmingStats.earningRateGrowth), 
                bits.map(bit => bit.bitStatsModifiers.earningRateModifiers as Modifier[]), 
                island.islandStatsModifiers?.earningRateModifiers as Modifier[]
            );

            // since this is called every 10 minutes, we will divide the `currentEarningRate` by 6 to get the 10-minute earning rate, and multiply it by the cookies spent to get the `claimableXCookies`
            const tenMinEarningRate = currentEarningRate / 6;
            const claimableXCookies = tenMinEarningRate / 100 * island.islandEarningStats?.totalXCookiesSpent;

            console.log(`claimable xCookies for Island ${island.islandId} is ${claimableXCookies}.`);

            // get the current amount of cookies earned already
            const xCookiesEarned = island.islandEarningStats?.totalXCookiesEarned;

            // if the amount of `claimableXCookies` is 0, skip this island (shouldn't happen, but just in case)
            if (claimableXCookies === 0) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has 0 claimable xCookies. Skipping...`);
                return;
            }

            if (xCookiesEarned === island.islandEarningStats?.totalXCookiesSpent) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has already earned all of its xCookies. Skipping...`);
                return;
            }

            // if `xCookiesEarned` + `claimableXCookies` is greater than totalXCookiesSpent, set `claimableXCookies` to totalXCookiesSpent - xCookiesEarned
            // this is to prevent the user from claiming more xCookies than they have spent
            if (claimableXCookies + xCookiesEarned > island.islandEarningStats?.totalXCookiesSpent) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId}'s claimableXCookies exceeds cookies spent.
                 adjusting... totalXCookiesSpent: ${island.islandEarningStats?.totalXCookiesSpent} - xCookiesEarned: ${xCookiesEarned} = ${island.islandEarningStats?.totalXCookiesSpent - xCookiesEarned}.`
                );
                
                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: { 
                            // also increment the `totalXCookiesEarned` by `totalXCookiesSpent - xCookiesEarned`
                            $inc: { 
                                'islandEarningStats.totalXCookiesEarned': island.islandEarningStats?.totalXCookiesSpent - xCookiesEarned,
                                'islandEarningStats.claimableXCookies': island.islandEarningStats?.totalXCookiesSpent - xCookiesEarned 
                            }
                        }
                    }
                });
            } else {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has updated its claimable xCookies to ${island.islandEarningStats?.claimableXCookies + claimableXCookies}.`);

                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: { 
                            // also increment the `totalXCookiesEarned` by `claimableXCookies`
                            $inc: { 
                                'islandEarningStats.totalXCookiesEarned': claimableXCookies,
                                'islandEarningStats.claimableXCookies': claimableXCookies
                            }
                        }
                    }
                });
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op);

        // if there are no bulk write operations, return
        if (bulkWriteOps.length === 0) {
            console.error(`(updateClaimableXCookies) No bulk write operations found.`);
            return;
        }

        // execute the bulk write operations
        await IslandModel.bulkWrite(bulkWriteOps);

        console.log(`(updateClaimableXCookies) All islands' claimableXCookies have been updated.`);
    } catch (err: any) {
        console.error(`(updateClaimableXCookies) Error: ${err.message}`);
    }
}

/**
 * Claims all claimable resources from an island and adds them to the user's inventory.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const claimResources = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
        const [user, island] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            IslandModel.findOne({ islandId }).lean()
        ]);

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimResources) User not found.`
            }
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(claimResources) Island not found.`
            }
        }

        // check if the user owns the island
        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(claimResources) User does not own the island.`
            }
        }

        // check if the `RESOURCES_CLAIM_COOLDOWN` has passed from the last claimed time
        const currentTime = Math.floor(Date.now() / 1000);
        const lastClaimedTime = island.islandResourceStats?.lastClaimed as number;

        if (currentTime - lastClaimedTime < RESOURCES_CLAIM_COOLDOWN) {
            return {
                status: Status.ERROR,
                message: `(claimResources) Cooldown not yet passed.`
            }
        }

        // check all claimable resources 
        const claimableResources = island.islandResourceStats?.claimableResources as Resource[];

        if (claimableResources.length === 0 || !claimableResources) {
            return {
                status: Status.ERROR,
                message: `(claimResources) No claimable resources found.`
            }
        }

        // add all claimable resources to the user's inventory
        // loop through each resource and check if the resource already exists in the user's inventory
        // if it does, increment the amount; if not, push a new resource
        for (let resource of claimableResources) {
            const existingResourceIndex = (user.inventory?.resources as Resource[]).findIndex(r => r.type === resource.type);

            if (existingResourceIndex !== -1) {
                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = resource.amount;
            } else {
                userUpdateOperations.$push['inventory.resources'] = resource;
            }
        }

        // do a few things:
        // 1. clear the island's `claimableResources`
        // 2. set the island's `lastClaimed` to the current time
        islandUpdateOperations.$set['islandResourceStats.claimableResources'] = [];
        islandUpdateOperations.$set['islandResourceStats.lastClaimed'] = currentTime;

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(claimResources) Claimed all resources from island ID ${islandId}.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimResources) Error: ${err.message}`
        }
    }
}

/**
 * Claims all claimable xCookies from an island and adds them to the user's inventory.
 */
export const claimXCookies = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
        const [user, island] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            IslandModel.findOne({ islandId }).lean()
        ]);

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) User not found.`
            }
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) Island not found.`
            }
        }

        // check if the user owns the island
        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(claimXCookies) User does not own the island.`
            }
        }

        // check if the `X_COOKIE_CLAIM_COOLDOWN` has passed from the last claimed time
        const currentTime = Math.floor(Date.now() / 1000);
        const lastClaimedTime = island.islandEarningStats?.lastClaimed as number;

        if (currentTime - lastClaimedTime < X_COOKIE_CLAIM_COOLDOWN) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) Cooldown not yet passed.`
            }
        }

        // check if the island has any xCookies to claim
        const xCookies: number = island.islandEarningStats?.claimableXCookies;

        if (xCookies === 0 || !xCookies) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) No xCookies to claim.`
            }
        }

        // check how much tax the user has to pay
        const { status, message, data } = await checkCurrentTax(twitterId, islandId);

        if (status !== Status.SUCCESS) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) Error from checkCurrentTax: ${message}`
            }
        }

        const tax = data?.tax as number;

        // reduce the xCookies by the tax amount
        const xCookiesAfterTax = xCookies - (tax / 100 * xCookies);

        console.log(`claiming tax for island ID ${islandId}: ${tax}%`);

        // add the xCookies to the user's inventory
        userUpdateOperations.$inc['inventory.xCookies'] = xCookiesAfterTax;

        // do a few things:
        // 1. set the island's `claimableXCookies` to 0
        // 2. set the island's `lastClaimed` to the current time
        // 3. set the island's `currentTax` to `tax`
        islandUpdateOperations.$set['islandEarningStats.claimableXCookies'] = 0;
        islandUpdateOperations.$set['islandEarningStats.lastClaimed'] = currentTime;
        islandUpdateOperations.$set['currentTax'] = tax;

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(claimXCookies) Claimed ${xCookies} xCookies from island ID ${islandId}.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimXCookies) Error: ${err.message}`
        }
    }
}

/**
 * Drops a resource for a user's island. 
 * 
 * Should only be called when gathering progress has reached >= 100% (and then reset back to 0%). Scheduler/parent function will check this.
 */
export const dropResource = async (islandId: number): Promise<ReturnValue> => {
    try {
        const island = await IslandModel.findOne({ islandId }).lean();

        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(dropResource) Island not found.`
            }
        }

        // check if the `resourcesLeft` is at least 1, if not, return an error.
        const baseResourceCap = island.islandResourceStats?.baseResourceCap as number;
        const resourcesGathered: Resource[] = island.islandResourceStats?.resourcesGathered;
        if (baseResourceCap - resourcesGathered.length <= 0) {
            return {
                status: Status.ERROR,
                message: `(dropResource) No resources left to drop.`
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
            islandUpdateOperations.$push['islandResourceStats.claimableResources'] = newResource;
        } else {
            // if not empty, check if the resource already exists in `claimableResources`
            const existingResourceIndex = claimableResources.findIndex(r => r.type === resourceType);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${existingResourceIndex}.amount`] = 1;
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: Resource = {
                    type: resourceType,
                    amount: 1
                }

                // add the new resource to the island's `claimableResources`
                islandUpdateOperations.$push['islandResourceStats.claimableResources'] = newResource;
            }
        }

        if (resourcesGathered.length === 0 || !resourcesGathered) {
            // if empty, create a new resource and add it to the island's `resourcesGathered`
            const newResource: Resource = {
                type: resourceType,
                amount: 1
            }

            // add the new resource to the island's `resourcesGathered`
            islandUpdateOperations.$push['islandResourceStats.resourcesGathered'] = newResource;
        } else {
            // if not empty, check if the resource already exists in `resourcesGathered`
            const existingResourceIndex = resourcesGathered.findIndex(r => r.type === resourceType);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                islandUpdateOperations.$inc[`islandResourceStats.resourcesGathered.${existingResourceIndex}.amount`] = 1;
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: Resource = {
                    type: resourceType,
                    amount: 1
                }

                // add the new resource to the island's `resourcesGathered`
                islandUpdateOperations.$push['islandResourceStats.resourcesGathered'] = newResource;
            }
        }

        // execute the update operations
        await IslandModel.updateOne({ islandId }, islandUpdateOperations);

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
    try {
        const newIsland = new IslandModel({
            _id: generateObjectId(),
            ...island
        });

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
    try {
        const latestIslandId = await IslandModel.countDocuments();

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

    return Math.floor(defaultResourceCap * resCapRand);
}

/**
 * Calculates the current gathering/earning rate of the island, based on the amount of bits placed on the island.
 * 
 * NOTE: to prevent miscalculations, ensure that:
 * 
 * 1. `baseRates` (referring to the base gathering/earning rates of the bits), `bitLevels`, and `initialGrowthRates` are all of the same length.
 * 
 * 2. the indexes of each array correspond to the same bit; for example, if `baseRates[0]` = 0.025, `bitLevels[0]` = 3 and `initialGrowthRates[0]` = 0.0002,
 * this should mean that Bit #1 has a base gathering/earning rate of 0.025, is at level 3, and has an initial growth rate of 0.0002.
 */
export const calcIslandCurrentRate = (
    type: RateType,
    baseRates: number[],
    bitLevels: number[],
    initialGrowthRates: number[],
    // gathering OR earning rate modifiers from `BitStatsModifiers` for each bit (each bit will have Modifier[], so multiple bits will be an array of Modifier[], thus Modifier[][])
    bitModifiers: Modifier[][],
    // gathering OR earning rate modifiers from `IslandStatsModifiers`
    modifiers: Modifier[]
): number => {
    // check if all arrays have the same length, else throw an error.
    if (baseRates.length === bitLevels.length && bitLevels.length === initialGrowthRates.length) {
        let sum = 0;
        // `n` refers to the total number of bits; since all arrays at this point are assumed the same length, we can just pick any of the lengths.
        let n = baseRates.length;

        for (let i = 0; i < n; i++) {
            // get the current rate for each bit
            const currentRate = calcBitCurrentRate(type, baseRates[i], bitLevels[i], initialGrowthRates[i], bitModifiers[i]);

            // add the current rate to the sum
            sum += currentRate;
        }

        // multiply the sum with the reduction modifier part of the formula
        const reductionModifier = type === RateType.GATHERING ? GATHERING_RATE_REDUCTION_MODIFIER : EARNING_RATE_REDUCTION_MODIFIER;

        // finally, check for IslandStatsModifiers for the island; if not empty, multiply each modifier's amount to the modifierMultiplier
        const modifierMultiplier = modifiers.reduce((acc, modifier) => acc * modifier.value, 1);

        return (sum * (1 - (reductionModifier * (n - 1)))) * modifierMultiplier;
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