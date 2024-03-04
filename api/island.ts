import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { BIT_PLACEMENT_CAP, BIT_PLACEMENT_MIN_RARITY_REQUIREMENT, DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER, ISLAND_EVOLUTION_COST, MAX_ISLAND_LEVEL, RARITY_DEVIATION_REDUCTIONS, RESOURCES_CLAIM_COOLDOWN, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF, TOTAL_ACTIVE_ISLANDS_ALLOWED, X_COOKIE_CLAIM_COOLDOWN, X_COOKIE_TAX } from '../utils/constants/island';
import { calcBitCurrentRate, getBits } from './bit';
import { Resource, ResourceType } from '../models/resource';
import { UserSchema } from '../schemas/User';
import { Modifier } from '../models/modifier';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitRarity, BitRarityNumeric } from '../models/bit';
import { generateObjectId } from '../utils/crypto';

/**
 * Gets one or multiple islands based on their IDs.
 */
export const getIslands = async (islandIds: number[]): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const islands = await Island.find({ islandId: { $in: islandIds } });

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
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        // firstly, check if the user owns the island
        const user = await User.findOne({ twitterId });
        
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

        // query the island
        const island = await Island.findOne({ islandId });

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
        await User.updateOne({ twitterId }, { $inc: { 'inventory.xCookies': -requiredXCookies } });

        // firstly, check if at this moment, the totalXCookiesSpent is 0.
        // because if it is, it means that earning hasn't started yet, meaning that after evolving the island, `earningStart` will be set to current timestamp, and earning will start.
        const totalXCookiesSpentIsZero = island.islandEarningStats?.totalXCookiesSpent === 0;

        // if totalXCookies spent is 0, evolve the island, increment the totalXCookiesSpent of the island by `requiredXCookies` and also set the `earningStart` to now.
        if (totalXCookiesSpentIsZero) {
            await Island.updateOne(
                { islandId },
                { 
                    $inc: { 
                        'currentLevel': 1,
                        'islandEarningStats.totalXCookiesSpent': requiredXCookies
                    },
                    $set: {
                        'islandEarningStats.earningStart': totalXCookiesSpentIsZero ? Math.floor(Date.now() / 1000) : undefined
                    }
                }
            );
        // otherwise, only evolve the island and increment the totalXCookiesSpent.
        } else {
            await Island.updateOne(
                { islandId },
                { 
                    $inc: { 
                        'currentLevel': 1,
                        'islandEarningStats.totalXCookiesSpent': requiredXCookies
                    }
                }
            );
        }

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
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        // firstly, check if the twitter ID owns the island
        const user = await User.findOne({ twitterId });

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

        // query the island and the bit
        const bit = await Bit.findOne({ bitId });
        const island = await Island.findOne({ islandId });

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
        const activeIslands = await Island.find(
            { islandId: 
                { $in: ownedIslands }, 
                placedBitIds: { $exists: true, $ne: [] } 
            });
        
        if (activeIslands.length >= TOTAL_ACTIVE_ISLANDS_ALLOWED) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User has reached the maximum amount of islands with bits placed.`
            }
        }

        // check if this bit is premium
        if (!bit.premium) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Non-premium bits cannot be placed on islands.`
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

            // add the new modifier to the island's `gatheringRateModifiers`
            await Island.updateOne({ islandId }, { $push: { 'islandStatsModifiers.gatheringRateModifiers': newGatheringRateModifier } });
        } else {
            const currentValue = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex].value;
            const newValue = currentValue - (rarityDeviationReductions.gatheringRateReduction / 100);

            // reduce the value by the reduction amount
            await Island.updateOne({ islandId }, { $set: { [`islandStatsModifiers.gatheringRateModifiers.${gatheringRateModifierIndex}.value`]: newValue } });
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

            // add the new modifier to the island's `resourceCapModifiers`
            await Island.updateOne({ islandId }, { $push: { 'islandStatsModifiers.resourceCapModifiers': newResourceCapModifier } });
        } else {
            const currentValue = island.islandStatsModifiers?.resourceCapModifiers[resourceCapModifierIndex].value;
            const newValue = currentValue - (rarityDeviationReductions.resourceCapReduction / 100);

            // reduce the value by the reduction amount
            await Island.updateOne({ islandId }, { $set: { [`islandStatsModifiers.resourceCapModifiers.${resourceCapModifierIndex}.value`]: newValue } });
        }

        // check if the to-be-put bit is the first one; if yes, start the `gatheringStart` timestamp
        if (island.placedBitIds.length === 0) {
            await Island.updateOne({ islandId }, { $set: { 'islandResourceStats.gatheringStart': Math.floor(Date.now() / 1000) } });
        }

        // place the bit on the island
        await Island.updateOne({ islandId }, { $push: { placedBitIds: bitId } });

        // update the bit to include `placedIslandId`
        await Bit.updateOne({ bitId }, { placedIslandId: islandId });

        // check if the bit has `totalXCookiesSpent` > 0. if yes, increment the island's `totalXCookiesSpent` by this amount.
        if (bit.totalXCookiesSpent > 0) {
            await Island.updateOne({ island }, { $inc: { 'islandEarningStats.totalXCookiesSpent': bit.totalXCookiesSpent } })
        }

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
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

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
        const activeIslands = await Island.find(
            { islandId: 
                { $in: islandIds }, 
                placedBitIds: { $exists: true, $ne: [] } 
            });

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
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        // find islands only where (in `islandResourceStats`):
        // 1. `gatheringStart` is not 0
        // 2. `gatheringEnd` is 0
        // 3. `placedBitIds` has at least a length of 1 (i.e. at least 1 placed bit inside)
        const islands = await Island.find({
            'islandResourceStats.gatheringStart': { $ne: 0 },
            'islandResourceStats.gatheringEnd': 0,
            'placedBitIds.0': { $exists: true }
        });

        if (islands.length === 0 || !islands) {
            console.error(`(updateGatheringProgressAndDropResource) No islands found.`);
            return;
        }

        for (let island of islands) {
            let finalGatheringProgress = 0;
            // check current gathering progress
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;

            // get the bits placed on the island to calculate the current gathering rate
            const { status, message, data } = await getBits(island.placedBitIds);

            // if error, just console log and continue to the next island
            if (status !== Status.SUCCESS) {
                console.error(`(updateGatheringProgressAndDropResource) Error For island ID ${island.islandId} from getBits: ${message}`);
                continue;
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

            // because this function is called every 10 minutes, we will increment the gathering progress by `gatheringRate/6` (since gathering rate is per hour)
            // check if the island's gathering progress + tenMinGatheringRate is >= 100
            // if not, just update the gathering progress
            const tenMinGatheringRate = gatheringRate / 6;
            if (gatheringProgress + tenMinGatheringRate < 100) {
                await Island.updateOne({ islandId: island.islandId }, { $inc: { 'islandResourceStats.gatheringProgress': tenMinGatheringRate } });

                console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has updated its gathering progress to ${gatheringProgress + tenMinGatheringRate}.`);
            } else {
                // if >= 100, drop a resource and reset the gathering progress back to 0 + the remaining overflow of %
                const { status, message } = await dropResource(island.islandId);
                if (status !== Status.SUCCESS) {
                    console.error(`(updateGatheringProgressAndDropResource) Error For island ID ${island.islandId} from dropResource: ${message}`);
                }

                // calculate the remaining overflow of %
                finalGatheringProgress = (gatheringProgress + tenMinGatheringRate) - 100;

                // reset the gathering progress back to 0 + the remaining overflow of %
                await Island.updateOne({ islandId: island.islandId }, { $set: { 'islandResourceStats.gatheringProgress': finalGatheringProgress } });

                console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has dropped a resource and reset its gathering progress to ${finalGatheringProgress}.`);
            }
        }

        console.log(`(updateGatheringProgressAndDropResource) All islands have been updated.`);
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

}

/**
 * Claims all claimable resources from an island and adds them to the user's inventory.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const claimResources = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimResources) User not found.`
            }
        }

        // check if island with `islandId` exists
        const island = await Island.findOne({ islandId });

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
                await User.updateOne({ twitterId }, { $inc: { [`inventory.resources.${existingResourceIndex}.amount`]: resource.amount } });
            } else {
                await User.updateOne({ twitterId }, { $push: { 'inventory.resources': resource } });
            }
        }

        // do a few things:
        // 1. clear the island's `claimableResources`
        // 2. set the island's `lastClaimed` to the current time
        // 3. add the claimed resources into `resourcesGathered`. if the resource already exists, increment its amount; if not, push the new resource into `resourcesGathered`
        await Island.updateOne(
            { islandId }, 
            { 
                $set: { 
                    'islandResourceStats.claimableResources': [], 
                    'islandResourceStats.lastClaimed': currentTime 
                },
                $push: { 
                    'islandResourceStats.resourcesGathered': { 
                        $each: claimableResources.map(resource => ({ 
                            $cond: [
                                { $eq: ["$$type", resource.type] },
                                { $inc: { 'amount': resource.amount } },
                                resource
                            ]
                        }))
                    }
                } 
            }
        );        

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
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) User not found.`
            }
        }

        // check if island with `islandId` exists
        const island = await Island.findOne({ islandId });

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
        const { status, message, data } = await checkCurrentTax(<IslandType>island.type, islandId);

        if (status !== Status.SUCCESS) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) Error from checkCurrentTax: ${message}`
            }
        }

        const tax = data?.tax as number;

        // reduce the xCookies by the tax amount
        const xCookiesAfterTax = tax / 100 * xCookies;


        // add the xCookies to the user's inventory
        await User.updateOne({ twitterId }, { $inc: { 'inventory.xCookies': xCookiesAfterTax } });

        // do a few things:
        // 1. set the island's `claimableXCookies` to 0
        // 2. set the island's `lastClaimed` to the current time
        // 3. set the island's `currentTax` to `tax`
        // 4. increment the island's `totalXCookiesEarned` by the amount of xCookies claimed
        await Island.updateOne(
            { islandId }, 
            { 
                $set: { 
                    'islandEarningStats.claimableXCookies': 0, 
                    'islandEarningStats.lastClaimed': currentTime,
                    'currentTax': tax
                },
                $inc: { 'islandEarningStats.totalXCookiesEarned': xCookies }
            }
        );

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
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const island = await Island.findOne({ islandId });

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(dropResource) Island not found.`
            }
        }

        // check if the `resourcesLeft` is at least 1, if not, return an error.
        if (island.islandResourceStats?.resourcesLeft < 1) {
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

        // finally, decrement the `resourcesLeft` by 1
        await Island.updateOne({ islandId }, { $inc: { 'islandResourceStats.resourcesLeft': -1 } });

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
        const newIsland = new Island({
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
        let modifierMultiplier = 1;

        if (modifiers.length > 0) {
            for (let modifier of modifiers) {
                modifierMultiplier *= modifier.value;
            }
        }

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