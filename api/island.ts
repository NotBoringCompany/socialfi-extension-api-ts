import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandStatsModifiers, IslandTrait, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { BARREN_ISLE_COMMON_DROP_CHANCE, BIT_PLACEMENT_CAP, BIT_PLACEMENT_MIN_RARITY_REQUIREMENT, DAILY_BONUS_RESOURCES_GATHERABLE, DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER, ISLAND_EVOLUTION_COST, MAX_ISLAND_LEVEL, RARITY_DEVIATION_REDUCTIONS, RESOURCES_CLAIM_COOLDOWN, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF, TOTAL_ACTIVE_ISLANDS_ALLOWED, X_COOKIE_CLAIM_COOLDOWN, X_COOKIE_TAX, randomizeIslandTraits } from '../utils/constants/island';
import { calcBitCurrentRate, getBits } from './bit';
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, Resource, ResourceLine, ResourceRarity, ResourceRarityNumeric, ResourceType, SimplifiedResource } from '../models/resource';
import { UserSchema } from '../schemas/User';
import { Modifier } from '../models/modifier';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitRarity, BitRarityNumeric, BitStatsModifiers, BitTrait, BitTraitData } from '../models/bit';
import { generateObjectId } from '../utils/crypto';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';
import { RELOCATION_COOLDOWN } from '../utils/constants/bit';
import { User } from '../models/user';
import { getResource, resources } from '../utils/constants/resource';

/**
 * Generates a barren island. This is called when a user signs up or when a user obtains and opens a bottled message.
 */
export const generateBarrenIsland = async (
    userId: string,
    obtainMethod: ObtainMethod.SIGN_UP | ObtainMethod.BOTTLED_MESSAGE
): Promise<ReturnValue> => {
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
            obtainMethod,
            currentLevel: 1,
            currentTax: 0,
            placedBitIds: [],
            traits: randomizeIslandTraits(),
            islandResourceStats: {
                baseResourceCap: randomizeBaseResourceCap(IslandType.BARREN),
                resourcesGathered: [],
                dailyBonusResourcesGathered: 0,
                claimableResources: [],
                gatheringStart: 0,
                gatheringEnd: 0,
                lastClaimed: 0,
                gatheringProgress: 0
            },
            islandEarningStats: {
                totalXCookiesSpent: 0,
                totalXCookiesEarnable: 0,
                totalXCookiesEarned: 0,
                claimableXCookies: 0,
                totalCookieCrumbsSpent: 0,
                totalCookieCrumbsEarnable: 0,
                totalCookieCrumbsEarned: 0,
                claimableCookieCrumbs: 0,
                earningStart: 0,
                crumbsEarningStart: 0,
                earningEnd: 0,
                crumbsEarningEnd: 0,
                lastClaimed: 0,
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
 * (User) Manually deletes an island. This is called when a user decides to remove/delete an island of their choice.
 */
export const removeIsland = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
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

        const bitUpdateOperations: Array<{
            bitId: number,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }> = [];

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(deleteIsland) User not found.`
            }
        }

        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(deleteIsland) User does not own the island.`
            }
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(deleteIsland) Island not found.`
            }
        }

        // if the user only has 1 island remaining, return an error.
        if (user.inventory?.islandIds.length === 1) {
            return {
                status: Status.ERROR,
                message: `(deleteIsland) User only has 1 island remaining.`
            }
        }

        // do the following things:
        // 1. remove the island ID from the user's inventory
        // 2. for each bit, set the `placedIslandId` back to 0 and set the `lastRelocationTimestamp` back to 0.
        // 3. delete the island from the database
        userUpdateOperations.$pull['inventory.islandIds'] = islandId;

        // get the bits placed on the island
        const placedBitIds = island.placedBitIds as number[];

        for (const bitId of placedBitIds) {
            bitUpdateOperations.push({
                bitId,
                updateOperations: {
                    $set: {
                        placedIslandId: 0,
                        lastRelocationTimestamp: 0
                    },
                    $pull: {},
                    $inc: {},
                    $push: {}
                }
            });
        }

        const bitUpdatePromises = bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        })

        await Promise.all([
            IslandModel.deleteOne({ islandId }),
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            ...bitUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(deleteIsland) Island with ID ${islandId} successfully deleted.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteIsland) Error: ${err.message}`
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
 * (User) Evolves an island (levelling it up). Allows either xCookies or cookie crumbs.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const evolveIsland = async (twitterId: string, islandId: number, choice: 'xCookies' | 'Cookie Crumbs'): Promise<ReturnValue> => {
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

        // check if island is barren. barren islands CANNOT be evolved.
        if (island.type === IslandType.BARREN) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) Barren islands cannot be evolved.`
            }
        }

        // check if the island is already max level, if it is, return an error.
        if (island.currentLevel >= MAX_ISLAND_LEVEL) {
            return {
                status: Status.ERROR,
                message: `(evolveIsland) Island is already at max level.`
            }
        }

        // if choice to evolve is using xCookies
        if (choice === 'xCookies') {
            // check if the user has enough xCookies
            const userXCookies: number = user.inventory?.xCookies;

            // calculate the cost to evolve the island based on its current level
            const { xCookies: requiredXCookies } = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);

            // if not enough, return an error.
            if (userXCookies < requiredXCookies) {
                return {
                    status: Status.ERROR,
                    message: `(evolveIsland) Not enough xCookies to evolve island.`
                }
            }

            // deduct the xCookies from the user
            userUpdateOperations.$inc['inventory.xCookies'] = -requiredXCookies;

            // firstly, check if at this moment, the totalXCookiesSpent is 0.
            // because if it is, it means that earning hasn't started yet, meaning that after evolving the island, `earningStart` will be set to current timestamp, and earning will start.
            const totalXCookiesEarnableIsZero = island.islandEarningStats?.totalXCookiesEarnable === 0;

            // if totalXCookies spent is 0, evolve the island, increment the totalXCookiesSpent and totalXCookiesEarnable of the island by `requiredXCookies` and also set the `earningStart` to now.
            if (totalXCookiesEarnableIsZero) {
                islandUpdateOperations.$inc['currentLevel'] = 1;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesEarnable'] = requiredXCookies;
                islandUpdateOperations.$set['islandEarningStats.earningStart'] = Math.floor(Date.now() / 1000);

                // otherwise, only evolve the island and increment the totalXCookiesSpent and totalXCookiesEarnable by `requiredXCookies`.
            } else {
                islandUpdateOperations.$inc['currentLevel'] = 1;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesEarnable'] = requiredXCookies;
            }
            // if choice to evolve is using cookie crumbs
        } else {
            const userCookieCrumbs: number = user.inventory?.cookieCrumbs;

            // calculate the cost to evolve the island based on its current level
            const { cookieCrumbs: requiredCookieCrumbs } = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);

            // if not enough, return an error.
            if (userCookieCrumbs < requiredCookieCrumbs) {
                return {
                    status: Status.ERROR,
                    message: `(evolveIsland) Not enough Cookie Crumbs to evolve island.`
                }
            }

            // deduct the cookie crumbs from the user
            userUpdateOperations.$inc['inventory.cookieCrumbs'] = -requiredCookieCrumbs;

            // since users wont get back cookie crumbs spent, no need to do any sort of logic for earnable cookie crumbs.
            // we just simply evolve the island and increment `totalCookieCrumbsSpent`
            islandUpdateOperations.$inc['islandEarningStats.totalCookieCrumbsSpent'] = requiredCookieCrumbs;
            islandUpdateOperations.$inc['currentLevel'] = 1;
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
 * (User) Places a bit on an island.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island and the bit ID.
 */
export const placeBit = async (twitterId: string, islandId: number, bitId: number): Promise<ReturnValue> => {
    try {
        const [user, bit, island] = await Promise.all([
            UserModel.findOne({ twitterId }).lean() as Promise<User>,
            BitModel.findOne({ bitId }).lean() as Promise<Bit>,
            IslandModel.findOne({ islandId }).lean() as Promise<Island>
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

        // check if this bit is already placed on this island. if yes, return an error.
        if (bit.placedIslandId === islandId) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit is already placed on this island.`
            }
        }

        // check if the bit is already placed on an island.
        // if yes, we will relocate them here automatically, assuming their moving cooldown has passed.
        // we do the following checks:
        // 1. if cooldown is 0 or has passed, relocate the bit.
        // when relocating bit, no need to change `placedIslandId` for the bit and `placedBitIds` for this island because it's done at the end. BUT:
        // 2. we need to remove the bit's ID from the previous island's `placedBitIds`.
        // 3. after removing the bit ID, we also need to remove any modifiers that has to do with the current bit's traits from the island's and its bits' modifiers.
        // e.g. if Bit 40 was placed in Island 1, all other bits that has the same or lesser rarity than Bit 40 will get +5% gathering and earning rate.
        // if Bit 40 is relocated to Island 2, we need to remove all the modifiers that has to do with Bit 40's traits from Island 1 and its bits (meaning that Island 1's bits will no longer get the +5% boost from Bit 40).
        // 4. when relocating bit, set the lastRelocationTimestamp to now.
        if (bit.placedIslandId !== 0) {
            // if cooldown has placed, do multiple things and relocate the bit
            if (bit.lastRelocationTimestamp + RELOCATION_COOLDOWN < Math.floor(Date.now() / 1000)) {
                // get the previous island ID from the bit
                const prevIslandId = bit.placedIslandId;

                const prevIsland = await IslandModel.findOne({ islandId: prevIslandId }).lean();

                const prevIslandUpdateOperations = {
                    $pull: {},
                    $inc: {},
                    $set: {},
                    $push: {}
                }

                const prevIslandBitsUpdateOperations: Array<{
                    bitId: number,
                    updateOperations: {
                        $pull: {},
                        $inc: {},
                        $set: {},
                        $push: {}
                    }
                }> = [];

                // remove the bit ID from the previous island's `placedBitIds`
                prevIslandUpdateOperations.$pull['placedBitIds'] = bit.bitId;

                // get the prev island's bits
                const prevIslandBits = await BitModel.find({ bitId: { $in: prevIsland.placedBitIds } }).lean();

                // loop through each bit and see if they have modifiers that include 'Bit ID #{bit id to be removed from this island}' as the origin
                // if they do, remove the modifier from the bit
                for (const prevIslandBit of prevIslandBits) {
                    // loop through each modifier and see if the origin includes the bit ID to be removed
                    const { gatheringRateModifiers, earningRateModifiers, energyRateModifiers }: BitStatsModifiers = prevIslandBit.bitStatsModifiers;

                    for (const modifier of gatheringRateModifiers) {
                        if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                            prevIslandBitsUpdateOperations.push({
                                bitId: prevIslandBit.bitId,
                                updateOperations: {
                                    $pull: {
                                        'bitStatsModifiers.gatheringRateModifiers': modifier
                                    },
                                    $inc: {},
                                    $set: {},
                                    $push: {}
                                }
                            });
                        }
                    }

                    for (const modifier of earningRateModifiers) {
                        if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                            prevIslandBitsUpdateOperations.push({
                                bitId: prevIslandBit.bitId,
                                updateOperations: {
                                    $pull: {
                                        'bitStatsModifiers.earningRateModifiers': modifier
                                    },
                                    $inc: {},
                                    $set: {},
                                    $push: {}
                                }
                            });
                        }
                    }

                    for (const modifier of energyRateModifiers) {
                        if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                            prevIslandBitsUpdateOperations.push({
                                bitId: prevIslandBit.bitId,
                                updateOperations: {
                                    $pull: {
                                        'bitStatsModifiers.energyRateModifiers': modifier
                                    },
                                    $inc: {},
                                    $set: {},
                                    $push: {}
                                }
                            });
                        }
                    }
                }

                // remove any modifiers from the island that contain the bit ID to be removed
                const { resourceCapModifiers, gatheringRateModifiers, earningRateModifiers }: IslandStatsModifiers = prevIsland.islandStatsModifiers;

                for (const modifier of resourceCapModifiers) {
                    if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                        prevIslandUpdateOperations.$pull['islandStatsModifiers.resourceCapModifiers'] = modifier;
                    }
                }

                for (const modifier of gatheringRateModifiers) {
                    if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                        prevIslandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = modifier;
                    }
                }

                for (const modifier of earningRateModifiers) {
                    if (modifier.origin.includes(`Bit ID #${bit.bitId}`)) {
                        prevIslandUpdateOperations.$pull['islandStatsModifiers.earningRateModifiers'] = modifier;
                    }
                }

                // execute the update operations
                const prevBitPromises = prevIslandBitsUpdateOperations.map(async op => {
                    return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
                });

                // remove the modifiers that has to do with the bit to be removed from the prev island and the bits in the prev island
                await Promise.all([
                    IslandModel.updateOne({ islandId: prevIslandId }, prevIslandUpdateOperations),
                    BitModel.updateOne({ bitId }, bitUpdateOperations),
                    ...prevBitPromises,
                ]);


            } else {
                return {
                    status: Status.ERROR,
                    message: `(placeBit) Bit ID #${bit.bitId}'s relocation cooldown has not passed.`
                }
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

        console.log(' bit rarity: ', bitRarity);

        const minRarityRequired = BIT_PLACEMENT_MIN_RARITY_REQUIREMENT(<IslandType>island.type);

        console.log('island type: ', island.type);

        const bitRarityAllowed = checkBitRarityAllowed(bitRarity, minRarityRequired);

        console.log('bit rarity allowed:', bitRarityAllowed);

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

        // check if the to-be-put bit is the first one; if yes, start the `gatheringStart` timestamp
        if (island.placedBitIds.length === 0) {
            islandUpdateOperations.$set['islandResourceStats.gatheringStart'] = Math.floor(Date.now() / 1000);
        }

        // place the bit on the island
        islandUpdateOperations.$push['placedBitIds'] = bitId;

        // update the bit to include `placedIslandId`
        bitUpdateOperations.$set['placedIslandId'] = islandId;

        // set the lastRelocationTimestamp of the relocated bit to now (regardless of whether the bit was relocated or just placed since that will also trigger the cooldown)
        bitUpdateOperations.$set['lastRelocationTimestamp'] = Math.floor(Date.now() / 1000);

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations),
            BitModel.updateOne({ bitId }, bitUpdateOperations)
        ]);

        // update the other bits' modifiers and also if applicable the island's modifiers with the bit's traits
        await updateExtendedTraitEffects(bit, island);

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
 * *User) Unplaces a bit from an island.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island and the bit ID.
 */
export const unplaceBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {
    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean()
        ]);

        // since the bit to be unplaced may have traits that impact other bits, we will need to include an array of bitUpdateOperations
        // so we can update the other bits' modifiers based on the bit to be unplaced.
        const bitUpdateOperations: Array<{
            bitId: number,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }> = [];

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
                message: `(unplaceBit) User not found.`
            }
        }

        // check if the user owns the bit to be unplaced
        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) User does not own the bit.`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) Bit not found.`
            }
        }

        // check if the bit is already placed on an island.
        // if not, return an error.
        if (bit.placedIslandId === 0) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) Bit is not placed on any island.`
            }
        }

        const islandId = bit.placedIslandId;

        const island = await IslandModel.findOne({ islandId }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) Island not found.`
            }
        }

        // remove the bit ID from the island's `placedBitIds`
        islandUpdateOperations.$pull['placedBitIds'] = bitId;

        // remove the bit's `placedIslandId`
        bitUpdateOperations.push({
            bitId: bit.bitId,
            updateOperations: {
                $set: {
                    'placedIslandId': 0
                },
                $pull: {},
                $inc: {},
                $push: {}
            }
        })

        // remove any modifiers that has to do with the bit's traits from the island and its bits
        const bitTraits = bit.traits as BitTraitData[];

        // loop through each trait and see if they impact the island's modifiers or other bits' modifiers
        // right now, these traits are:
        // nibbler, teamworker, leader, cute and genius
        for (const trait of bitTraits) {
            const otherBits = await BitModel.find({ bitId: { $in: island.placedBitIds } }).lean();

            // if the trait is genius, remove modifiers from the island's `gatheringRateModifiers` and `earningRateModifiers`
            if (
                trait.trait === BitTrait.GENIUS ||
                trait.trait === BitTrait.SLOW ||
                trait.trait === BitTrait.QUICK
            ) {
                console.log(`unplaceBit ID ${bit.bitId}'s trait is ${trait}`);

                // find the index of the modifier in the island's `gatheringRateModifiers` and `earningRateModifiers`
                const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === `Bit ID #${bit.bitId}'s Trait: ${trait}`);
                const earningRateModifierIndex = (island.islandStatsModifiers?.earningRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === `Bit ID #${bit.bitId}'s Trait: ${trait}`);

                console.log('gathering rate modifier index: ', gatheringRateModifierIndex);
                console.log('earning rate modifier index: ', earningRateModifierIndex);

                // if the modifier is found, remove it from the island's `gatheringRateModifiers` and `earningRateModifiers`
                if (gatheringRateModifierIndex !== -1) {
                    islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex];
                }

                if (earningRateModifierIndex !== -1) {
                    islandUpdateOperations.$pull['islandStatsModifiers.earningRateModifiers'] = island.islandStatsModifiers?.earningRateModifiers[earningRateModifierIndex];
                }
                // // remove the modifier from the island's `gatheringRateModifiers` and `earningRateModifiers`
                // islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = { origin: `Bit ID #${bit.bitId}'s Trait: ${trait}` };
                // islandUpdateOperations.$pull['islandStatsModifiers.earningRateModifiers'] = { origin: `Bit ID #${bit.bitId}'s Trait: ${trait}` };
                // if trait is teamworker, leader, cute or lonewolf, remove modifiers for each bit that was impacted by this bit's trait
            } else if (
                trait.trait === BitTrait.TEAMWORKER ||
                trait.trait === BitTrait.LEADER ||
                trait.trait === BitTrait.CUTE ||
                trait.trait === BitTrait.LONEWOLF
            ) {
                for (const otherBit of otherBits) {
                    // check the index of the modifier in the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const gatheringRateModifierIndex = (otherBit.bitStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === `Bit ID #${bit.bitId}'s Trait: ${trait}`);
                    const earningRateModifierIndex = (otherBit.bitStatsModifiers?.earningRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === `Bit ID #${bit.bitId}'s Trait: ${trait}`);

                    // if the modifier is found, remove it from the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    if (gatheringRateModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: {
                                    'bitStatsModifiers.gatheringRateModifiers': otherBit.bitStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex]
                                },
                                $inc: {},
                                $set: {},
                                $push: {}
                            }
                        });
                    }

                    if (earningRateModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: {
                                    'bitStatsModifiers.earningRateModifiers': otherBit.bitStatsModifiers?.earningRateModifiers[earningRateModifierIndex]
                                },
                                $inc: {},
                                $set: {},
                                $push: {}
                            }
                        });
                    }

                    // // remove the modifier from the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    // bitUpdateOperations.push({
                    //     bitId: otherBit.bitId,
                    //     updateOperations: {
                    //         $pull: {
                    //             'bitStatsModifiers.gatheringRateModifiers': { origin: `Bit ID #${bit.bitId}'s Trait: ${trait}` },
                    //             'bitStatsModifiers.earningRateModifiers': { origin: `Bit ID #${bit.bitId}'s Trait: ${trait}` }
                    //         },
                    //         $inc: {},
                    //         $set: {},
                    //         $push: {}
                    //     }
                    // });
                }
            }
        }

        const bitUpdatePromises = bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        });

        console.log('island update operations: ', islandUpdateOperations);
        console.log('bit update operations: ', bitUpdateOperations);

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations),
            ...bitUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(unplaceBit) Bit unplaced from the island.`,
            data: {
                bitId,
                islandId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(unplaceBit) Error: ${err.message}`
        }
    }
}

/**
 * Update an island's modifiers or all other bits' (within this island) modifiers based on a bit's trait.
 * 
 * Called when a bit is being placed on an island via `placeBit.
 */
export const updateExtendedTraitEffects = async (
    bit: Bit,
    island: Island,
): Promise<void> => {
    // get the other bit IDs from the island (excl. the bit to be placed)
    const otherBitIds = island.placedBitIds.filter(placedBitId => placedBitId !== bit.bitId);

    // get the bit's traits
    const bitTraits = bit.traits;

    // loop through each trait and see if they impact the island's modifiers or other bits' modifiers
    // right now, these traits are:
    // teamworker, leader, cute, genius and lonewolf
    const bitUpdateOperations: Array<{
        bitId: number,
        updateOperations: {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }
    }> = [];

    const islandUpdateOperations = {
        $pull: {},
        $inc: {},
        $set: {},
        $push: {}
    }

    for (const trait of bitTraits) {
        const otherBits = await BitModel.find({ bitId: { $in: otherBitIds } }).lean();

        // if trait is teamworker:
        // increase all other bits that have the same or lesser rarity as the bit being placed by 5% gathering and earning rate
        if (trait.trait === BitTrait.TEAMWORKER) {
            // loop through each other bit and check if they have the same or lesser rarity as the bit being placed
            // if no other bits found, skip this trait
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // check if the other bit's rarity is the same or lesser than the bit being placed
                if (BitRarityNumeric[otherBit.rarity] <= BitRarityNumeric[bit.rarity]) {
                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${bit.bitId}'s Trait: Teamworker`,
                        value: 1.05
                    }

                    const newEarningRateModifier: Modifier = {
                        origin: `Bit ID #${bit.bitId}'s Trait: Teamworker`,
                        value: 1.05
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    bitUpdateOperations.push({
                        bitId: otherBit.bitId,
                        updateOperations: {
                            $push: {
                                'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                                'bitStatsModifiers.earningRateModifiers': newEarningRateModifier
                            },
                            $pull: {},
                            $inc: {},
                            $set: {}
                        }
                    });
                    // if the other bit's rarity is higher than the bit being placed, skip this bit
                } else {
                    continue;
                }
            }
            // if trait is leader:
            // increase all other bits' gathering and earning rate by 10%
        } else if (trait.trait === BitTrait.LEADER) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Leader`,
                    value: 1.1
                }

                const newEarningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Leader`,
                    value: 1.1
                }

                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                            'bitStatsModifiers.earningRateModifiers': newEarningRateModifier
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
            // if bit trait is cute:
            // increase gathering and earning rate of all other bits by 12.5%
        } else if (trait.trait === BitTrait.CUTE) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Cute`,
                    value: 1.125
                }

                const newEarningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Cute`,
                    value: 1.125
                }

                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                            'bitStatsModifiers.earningRateModifiers': newEarningRateModifier
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
            // if bit trait is genius:
            // increase the island's gathering and earning rate by 7.5%
        } else if (trait.trait === BitTrait.GENIUS) {
            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Genius`,
                value: 1.075
            }

            const newEarningRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Genius`,
                value: 1.075
            }

            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            islandUpdateOperations.$push['islandStatsModifiers.earningRateModifiers'] = newEarningRateModifier;
            // if bit trait is lonewolf:
            // reduce the working rate of all other bits by 5%
        } else if (trait.trait === BitTrait.LONEWOLF) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Lonewolf`,
                    value: 0.95
                }

                const newEarningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Lonewolf`,
                    value: 0.95
                }

                // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                            'bitStatsModifiers.earningRateModifiers': newEarningRateModifier
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
        // if bit trait is slow, reduce 1% of the island's gathering and earning rate
        } else if (trait.trait === BitTrait.SLOW) {
            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Slow`,
                value: 0.99
            }

            const newEarningRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Slow`,
                value: 0.99
            }

            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            islandUpdateOperations.$push['islandStatsModifiers.earningRateModifiers'] = newEarningRateModifier;
        // if bit trait is quick, increase 1% of the island's gathering and earning rate
        }  else if (trait.trait === BitTrait.QUICK) {
            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Quick`,
                value: 1.01
            }

            const newEarningRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Quick`,
                value: 1.01
            }

            // add the new modifier to the island's `gatheringRateModifiers` and `earningRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            islandUpdateOperations.$push['islandStatsModifiers.earningRateModifiers'] = newEarningRateModifier;
        // if bit trait is none of the above, skip this trait
        } else {
            continue;
        }
    }

    // execute the update operations
    const bitUpdatePromises = bitUpdateOperations.map(async op => {
        return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
    });

    await Promise.all([
        ...bitUpdatePromises,
        IslandModel.updateOne({ islandId: island.islandId }, islandUpdateOperations)
    ]);

    console.log(`(updateExtendedTraitEffects) Extended trait effects updated for island ID ${island.islandId}.`);
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
 * NOTE: If 0 xCookies is earnable for an island, this function will skip that island.
 */
export const updateClaimableXCookies = async (): Promise<void> => {
    try {
        // find islands only where xCookies earnable is > 0
        const islands = await IslandModel.find({ 'islandEarningStats.totalXCookiesEarnable': { $gt: 0 } }).lean();

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
                return [];
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

            // since this is called every 10 minutes, we will divide the `currentEarningRate` by 6 to get the 10-minute earning rate, and multiply it by the cookies earnable to get the `claimableXCookies`
            const tenMinEarningRate = currentEarningRate / 6;
            const claimableXCookies = tenMinEarningRate / 100 * island.islandEarningStats?.totalXCookiesEarnable;

            console.log(`claimable xCookies for Island ${island.islandId} is ${claimableXCookies}.`);

            // get the current amount of cookies earned already
            const xCookiesEarned = island.islandEarningStats?.totalXCookiesEarned;

            // if the amount of `claimableXCookies` is 0, skip this island (shouldn't happen, but just in case)
            if (claimableXCookies === 0) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has 0 claimable xCookies. Skipping...`);
                return [];
            }

            if (xCookiesEarned >= island.islandEarningStats?.totalXCookiesEarnable) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId} has already earned all of its xCookies. Skipping...`);
                return [];
            }

            // if `xCookiesEarned` + `claimableXCookies` is greater than totalXCookiesEarnable, set `claimableXCookies` to totalXCookiesEarnable - xCookiesEarned
            // this is to prevent the user from claiming more xCookies than they have spent
            if (claimableXCookies + xCookiesEarned > island.islandEarningStats?.totalXCookiesEarnable) {
                console.log(`(updateClaimableXCookies) Island ID ${island.islandId}'s claimableXCookies exceeds cookies spent.
                 adjusting... totalXCookiesEarnable: ${island.islandEarningStats?.totalXCookiesEarnable} - xCookiesEarned: ${xCookiesEarned} = ${island.islandEarningStats?.totalXCookiesEarnable - xCookiesEarned}.`
                );

                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            // also increment the `totalXCookiesEarned` by `totalXCookiesEarnable - xCookiesEarned`
                            $inc: {
                                'islandEarningStats.totalXCookiesEarned': island.islandEarningStats?.totalXCookiesEarnable - xCookiesEarned,
                                'islandEarningStats.claimableXCookies': island.islandEarningStats?.totalXCookiesEarnable - xCookiesEarned
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
 * Updates all eligible islands' `claimableCookieCrumbs` based on their current earning rate.
 * 
 * Run by a scheduler every 10 minutes.
 * 
 * NOTE: If 0 cookie crumbs is earnable for an island, this function will skip that island.
 */
export const updateClaimableCrumbs = async (): Promise<void> => {
    try {
        const islands = await IslandModel.find({ 'islandEarningStats.totalCookieCrumbsEarnable': { $gt: 0 } }).lean();

        if (islands.length === 0 || !islands) {
            console.error(`(updateClaimableCrumbs) No islands found.`);
            return;
        }

        // prepare bulk write operations to update all islands' `claimableCookieCrumbs`
        const bulkWriteOpsPromises = islands.map(async island => {
            let updateOperations = [];

            // get the bit ids placed on this island and fetch the bits
            const placedBitIds = island.placedBitIds as number[];

            // if no bits are placed, skip this island
            if (placedBitIds.length === 0) {
                console.log(`(updateClaimableCrumbs) Island ID ${island.islandId} has no bits placed. Skipping...`);
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

            // since this is called every 10 minutes, we will divide the `currentEarningRate` by 6 to get the 10-minute earning rate, and multiply it by the cookie crumbs earnable to get the `claimableCookieCrumbs`
            const tenMinEarningRate = currentEarningRate / 6;
            const claimableCookieCrumbs = tenMinEarningRate / 100 * island.islandEarningStats?.totalCookieCrumbsEarnable;

            console.log(`claimable Cookie Crumbs for Island ${island.islandId} is ${claimableCookieCrumbs}.`);

            // get the current amount of cookie crumbs earned already
            const cookieCrumbsEarned = island.islandEarningStats?.totalCookieCrumbsEarned;

            // if the amount of `claimableCookieCrumbs` is 0, skip this island (shouldn't happen, but just in case)
            if (claimableCookieCrumbs === 0) {
                console.log(`(updateClaimableCrumbs) Island ID ${island.islandId} has 0 claimable Cookie Crumbs. Skipping...`);
                return [];
            }

            if (cookieCrumbsEarned >= island.islandEarningStats?.totalCookieCrumbsEarnable) {
                console.log(`(updateClaimableCrumbs) Island ID ${island.islandId} has already earned all of its Cookie Crumbs. Skipping...`);
                return [];
            }

            // if `cookieCrumbsEarned` + `claimableCookieCrumbs` is greater than totalCookieCrumbsEarnable, set `claimableCookieCrumbs` to totalCookieCrumbsEarnable - cookieCrumbsEarned
            // this is to prevent the user from claiming more cookie crumbs than they have spent
            if (claimableCookieCrumbs + cookieCrumbsEarned > island.islandEarningStats?.totalCookieCrumbsEarnable) {
                console.log(`(updateClaimableCrumbs) Island ID ${island.islandId}'s claimableCookieCrumbs exceeds cookie crumbs spent.
                 adjusting... totalCookieCrumbsEarnable: ${island.islandEarningStats?.totalCookieCrumbsEarnable} - cookieCrumbsEarned: ${cookieCrumbsEarned} = ${island.islandEarningStats?.totalCookieCrumbsEarnable - cookieCrumbsEarned}.`
                );

                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            // also increment the `totalCookieCrumbsEarned` by `totalCookieCrumbsEarnable - cookieCrumbsEarned`
                            $inc: {
                                'islandEarningStats.totalCookieCrumbsEarned': island.islandEarningStats?.totalCookieCrumbsEarnable - cookieCrumbsEarned,
                                'islandEarningStats.claimableCookieCrumbs': island.islandEarningStats?.totalCookieCrumbsEarnable - cookieCrumbsEarned
                            }
                        }
                    }
                });
            } else {
                console.log(`(updateClaimableCrumbs) Island ID ${island.islandId} has updated its claimable Cookie Crumbs to ${island.islandEarningStats?.claimableCookieCrumbs + claimableCookieCrumbs}.`);

                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            // also increment the `totalCookieCrumbsEarned` by `claimableCookieCrumbs`
                            $inc: {
                                'islandEarningStats.totalCookieCrumbsEarned': claimableCookieCrumbs,
                                'islandEarningStats.claimableCookieCrumbs': claimableCookieCrumbs
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
            console.error(`(updateClaimableCrumbs) No bulk write operations found.`);
            return;
        }

        // execute the bulk write operations
        await IslandModel.bulkWrite(bulkWriteOps);

        console.log(`(updateClaimableCrumbs) All islands' claimableCookieCrumbs have been updated.`);
    } catch (err: any) {
        console.error(`(updateClaimableCrumbs) Error: ${err.message}`);
    }
}

/**
 * Claims all claimable resources from an island and adds them to the user's inventory.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const claimResources = async (
    twitterId: string,
    islandId: number,
    claimType: 'manual' | 'auto',
    // only should be used if `claimType` is 'manual'
    // this essentially allows the user to choose which resources to claim
    chosenResources?: SimplifiedResource[]
): Promise<ReturnValue> => {
    try {
        // the return message (just in case not all resources can be claimed). only for successful claims.
        let returnMessage: string = `(claimResources) Claimed all resources from island ID ${islandId}.`;
        // only for automatic claiming if not all resources can be claimed
        const claimedResources: ExtendedResource[] = [];

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

        // initialize `$each` on the user's inventory resources if it doesn't exist so that we can push multiple resources at once
        if (!userUpdateOperations.$push['inventory.resources']) {
            userUpdateOperations.$push['inventory.resources'] = { $each: [] }
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

        // if the user is currently travelling, disable claiming resources
        if (user.inGameData.travellingTo !== null) {
            return {
                status: Status.ERROR,
                message: `(claimResources) User is currently travelling.`
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
        const claimableResources = island.islandResourceStats?.claimableResources as ExtendedResource[];

        if (claimableResources.length === 0 || !claimableResources) {
            return {
                status: Status.ERROR,
                message: `(claimResources) No claimable resources found.`
            }
        }

        // get the user's current inventory weight
        const currentInventoryWeight: number = user.inventory.weight;

        // if manual, check:
        // 1. if the user has chosen resources to claim
        // 2. if the chosen resources exist in the island's claimable resources and if the amount is above 0 for each resource AND if the amount to claim is less than or equal to the claimable amount for each resource.
        // 3. if all chosen resources don't exceed the player's max inventory weight.
        if (claimType === 'manual') {
            if (!chosenResources || chosenResources.length === 0) {
                return {
                    status: Status.ERROR,
                    message: `(claimResources) No chosen resources found. This is required for manual claiming.`
                }
            }

            // initialize total weight of resources to claim for calculation
            let totalWeightToClaim = 0;

            // `chosenResources` will essentially consist of the resource types and the equivalent amounts of that resource the user wants to claim.
            // we check, for each chosenResource, if the resource exists in the island's claimable resources, if the amount the user wants to claim is above 0 for each resource 
            // and if the amount to claim is less than or equal to the claimable amount for each resource.
            // then, we also check if the total weight of the chosen resources doesn't exceed the player's max inventory weight.
            for (let chosenResource of chosenResources) {
                // get the full data of the chosen resource (so that it can be added to the user's inventory)
                const chosenResourceData = resources.find(r => r.type === chosenResource.type);

                const claimableResourceIndex = claimableResources.findIndex(r => r.type === chosenResource.type);

                if (claimableResourceIndex === -1) {
                    return {
                        status: Status.ERROR,
                        message: `(claimResources) Chosen resource ${chosenResource.type} not found in island's claimable resources.`
                    }
                }

                if (chosenResource.amount <= 0) {
                    return {
                        status: Status.ERROR,
                        message: `(claimResources) Chosen resource ${chosenResource.type} amount is 0.`
                    }
                }

                if (chosenResource.amount > claimableResources[claimableResourceIndex].amount) {
                    return {
                        status: Status.ERROR,
                        message: `(claimResources) Chosen resource ${chosenResource.type} amount exceeds claimable amount.`
                    }
                }

                // get the total weight of this resource
                const resourceWeight: number = resources.find(r => r.type === chosenResource.type)?.weight;
                const totalWeight = resourceWeight * chosenResource.amount;

                // add to the total weight to claim
                totalWeightToClaim += totalWeight;

                // just in case all checks pass later, we will do the following update operations.
                // 1. if the resource already exists in the user's inventory, increment the amount; if not, push a new resource.
                // 2. pull the resource (if amount to claim = max claimable amount of this resource) or decrement the amount (if amount to claim < max claimable amount of this resource) from the island's claimable resources.
                // !!! NOTE: if the checks don't pass, this function will return and the update operations will not be executed anyway. !!!

                // we check if this resource exists on the user's inventory or not. if not, we push a new resource; if yes, we increment the amount.
                const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r.type === chosenResource.type);

                if (existingResourceIndex !== -1) {
                    console.log('existing resource index #0: ', existingResourceIndex);
                    userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = chosenResource.amount;
                } else {
                    userUpdateOperations.$push['inventory.resources'] = { $each: [{ ...chosenResourceData, amount: chosenResource.amount, origin: ExtendedResourceOrigin.NORMAL }] };
                }

                // now, check if the amount to claim for this resource equals the max claimable amount for this resource.
                // if yes, we will pull this resource from the island's claimable resources. otherwise, we will only deduct the amount by the amount to claim.
                if (chosenResource.amount === claimableResources[claimableResourceIndex].amount) {
                    islandUpdateOperations.$pull[`islandResourceStats.claimableResources`] = { type: chosenResource.type };
                } else {
                    islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${claimableResourceIndex}.amount`] = -chosenResource.amount;
                }
            }

            // check if the total weight to claim exceeds the player's max inventory weight
            if (currentInventoryWeight + totalWeightToClaim > user.inventory.maxWeight) {
                return {
                    status: Status.ERROR,
                    message: `(claimResources) Total weight of chosen resources exceeds player's max inventory weight.`
                }
            }

            // if all checks pass, we can proceed to claim the resources
            // since we already have the update operations to add the resources to the user's inventory and to reduce the resource amount/pull the resource from the island's claimable resources,
            // we just have a few more things to do:
            // 1. increment the user's inventory weight by the total weight to claim
            // 2. set the island's `lastClaimed` to the current time
            userUpdateOperations.$inc['inventory.weight'] = totalWeightToClaim
            islandUpdateOperations.$set['islandResourceStats.lastClaimed'] = currentTime;

            returnMessage = `Manually claimed resources for Island ID ${islandId}.`;
            // if auto, we will do the following:
            // 1. firstly, check if all resources can be claimed based on the user's max inventory weight. if yes, skip the next steps.
            // 2. if not, we will sort the resources from highest to lowest rarity.
            // 3. then, for each rarity, sort the resources from highest to lowest weight.
            // 4. then, for each resource, we will claim the max amount of that resource that the user can claim based on their max inventory weight.
        } else {
            // initialize the total weight to claim
            let totalWeightToClaim = 0;

            // loop through each resource and calculate the total weight to claim
            for (const resource of claimableResources) {
                const resourceWeight: number = resources.find(r => r.type === resource.type)?.weight;
                const totalWeight = resourceWeight * resource.amount;

                totalWeightToClaim += totalWeight;
            }

            // if the total weight to claim doesn't exceed the user's max inventory weight, we can claim all resources.
            if (currentInventoryWeight + totalWeightToClaim <= user.inventory.maxWeight) {
                // loop through each resource and add it to the user's inventory
                for (const resource of claimableResources) {
                    // check if this resource exists on the user's inventory or not. if not, we push a new resource; if yes, we increment the amount.
                    const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r.type === resource.type);

                    if (existingResourceIndex !== -1) {
                        console.log('total weight to claim is not exceeding max weight!');
                        console.log('existing resource index #1: ', existingResourceIndex);

                        userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = resource.amount;
                    } else {
                        userUpdateOperations.$push['inventory.resources'] = { $each: [{ ...resource, origin: ExtendedResourceOrigin.NORMAL }] };
                    }
                }

                // add the weight to the user's inventory
                userUpdateOperations.$inc['inventory.weight'] = totalWeightToClaim;

                // remove all claimable resources from the island
                islandUpdateOperations.$set['islandResourceStats.claimableResources'] = [];

                // add the claimed resources to the claimedResources array
                claimedResources.push(...claimableResources);

                // otherwise, we will need to proceed with sorting.
            } else {
                // sort resources from highest to lowest rarity
                const sortedResources = claimableResources.sort((a, b) => ResourceRarityNumeric[b.rarity] - ResourceRarityNumeric[a.rarity]);

                // group resources by rarity
                const groupedResources = sortedResources.reduce((acc, resource) => {
                    if (!acc[resource.rarity]) {
                        acc[resource.rarity] = [];
                    }

                    acc[resource.rarity].push(resource);

                    return acc;
                }, {} as { [key in ResourceRarity]: ExtendedResource[] });

                // get the max allowed weight
                const maxAllowedWeight = user.inventory.maxWeight - currentInventoryWeight;

                // initialize the current weight of resources. this is used to know how many resources we can claim based on the user's max inventory weight.
                let currentWeight: number = 0;

                // only used for scenarios where the user can't claim all resources due to max inventory weight
                // since mongodb doesn't support $pull with $each, we will just push the resources to be pulled into this array and pull them all at once after the loop.
                const islandResourcesPulled = [];

                // loop through each rarity group
                for (const rarityGroup of Object.values(groupedResources)) {
                    // sort the resources from highest to lowest weight
                    const sortedByWeight = rarityGroup.sort((a, b) => resources.find(r => r.type === b.type)?.weight - resources.find(r => r.type === a.type)?.weight);

                    // for each resource, check if we can claim all of it or just a portion of it based on the user's max inventory weight.
                    for (const resource of sortedByWeight) {
                        const resourceWeight: number = resources.find(r => r.type === resource.type)?.weight;
                        const totalWeight = resourceWeight * resource.amount;

                        // if the current weight + the total weight of this resource exceeds the max allowed weight, we will only claim a portion of this resource.
                        if (currentWeight + totalWeight > maxAllowedWeight) {
                            console.log('current weight + total weight of resources exceeds max allowed weight!');

                            // calculate the amount of this resource we can claim based on the max allowed weight
                            const amountToClaim = Math.floor((maxAllowedWeight - currentWeight) / resourceWeight);

                            // if amount to claim is 0, we can't claim this resource anymore. break out of the loop.
                            if (amountToClaim <= 0) {
                                break;
                            }

                            // check if this resource exists on the user's inventory or not. if not, we push a new resource; if yes, we increment the amount.
                            const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r.type === resource.type);

                            if (existingResourceIndex !== -1) {
                                console.log('existing resource index #2: ', existingResourceIndex);

                                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = amountToClaim;
                            } else {
                                userUpdateOperations.$push['inventory.resources'] = { $each: [{ ...resource, amount: amountToClaim, origin: ExtendedResourceOrigin.NORMAL }] }
                            }

                            // increment the current weight by the total weight of this resource
                            currentWeight += resourceWeight * amountToClaim;

                            // deduce the amount from the island's claimable resources
                            const claimableResourceIndex = claimableResources.findIndex(r => r.type === resource.type);
                            islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${claimableResourceIndex}.amount`] = -amountToClaim;

                            // add the claimed resource to the claimedResources array
                            claimedResources.push({
                                ...resource,
                                amount: amountToClaim,
                                origin: ExtendedResourceOrigin.NORMAL
                            });

                            // break out of the loop since we can't claim more resources based on the user's max inventory weight
                            break;
                        } else {
                            console.log('current weight + total weight of resources does not exceed max allowed weight!');

                            // check if this resource exists on the user's inventory or not. if not, we push a new resource; if yes, we increment the amount.
                            const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r.type === resource.type);

                            if (existingResourceIndex !== -1) {
                                console.log('existing resource index #3: ', existingResourceIndex);
                                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = resource.amount;
                            } else {
                                userUpdateOperations.$push['inventory.resources'] = { $each: [{ ...resource, origin: ExtendedResourceOrigin.NORMAL }] }
                            }

                            // increment the current weight by the total weight of this resource
                            currentWeight += totalWeight;

                            console.log('pulling claimable resources with type: ', resource.type);

                            // since this essentially means we can claim all of this resource, we will pull this resource from the island's claimable resources.
                            islandResourcesPulled.push(resource.type);
                            // islandUpdateOperations.$pull[`islandResourceStats.claimableResources`] = { type: resource.type };

                            // add the claimed resource to the claimedResources array
                            claimedResources.push({
                                ...resource,
                                origin: ExtendedResourceOrigin.NORMAL
                            });
                        }
                    }
                }

                // if islandResourcesPulled has any resources, we will pull them all at once.
                if (islandResourcesPulled.length > 0) {
                    islandUpdateOperations.$pull[`islandResourceStats.claimableResources`] = { type: { $in: islandResourcesPulled } };
                }

                // add the weight to the user's inventory
                userUpdateOperations.$inc['inventory.weight'] = currentWeight;

                // set the island's `lastClaimed` to the current time
                islandUpdateOperations.$set['islandResourceStats.lastClaimed'] = currentTime;

                returnMessage = `Unable to claim all resources due to max inventory weight. Automatically claimed partial resources for Island ID ${islandId}.`;
            }
        }

        console.log('user update operations: ', userUpdateOperations);
        console.log('island update operations: ', islandUpdateOperations);

        // execute the update operations
        if (Object.keys(userUpdateOperations.$push).length > 0) {
            await UserModel.updateOne({ twitterId }, {
                $push: userUpdateOperations.$push
            });
        }

        if (Object.keys(userUpdateOperations.$inc).length > 0) {
            await UserModel.updateOne({ twitterId }, {
                $inc: userUpdateOperations.$inc
            });
        }

        if (Object.keys(userUpdateOperations.$pull).length > 0) {
            await UserModel.updateOne({ twitterId }, {
                $pull: userUpdateOperations.$pull
            });
        }

        if (Object.keys(userUpdateOperations.$set).length > 0) {
            await UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set
            });
        }

        if (Object.keys(islandUpdateOperations.$push).length > 0) {
            await IslandModel.updateOne({ islandId }, {
                $push: islandUpdateOperations.$push
            });
        }

        if (Object.keys(islandUpdateOperations.$inc).length > 0) {
            await IslandModel.updateOne({ islandId }, {
                $inc: islandUpdateOperations.$inc
            });
        }

        if (Object.keys(islandUpdateOperations.$pull).length > 0) {
            await IslandModel.updateOne({ islandId }, {
                $pull: islandUpdateOperations.$pull
            })
        }

        if (Object.keys(islandUpdateOperations.$set).length > 0) {
            await IslandModel.updateOne({ islandId }, {
                $set: islandUpdateOperations.$set
            });
        }

        return {
            status: Status.SUCCESS,
            message: returnMessage,
            data: {
                claimedResources: claimType === 'manual' ? chosenResources : claimedResources,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimResources) Error: ${err.message}`
        }
    }
}

/**
 * Resets all islands' `dailyBonusResourcesGathered` back to 0.
 * 
 * Will only run for islands that have `dailyBonusResourceGathered` > 0.
 * 
 * Called by a scheduler every 23:59 UTC.
 */
export const updateDailyBonusResourcesGathered = async (): Promise<void> => {
    try {
        const islands = await IslandModel.find({ 'islandResourceStats.dailyBonusResourcesGathered': { $gt: 0 } }).lean();

        if (islands.length === 0 || !islands) {
            console.error(`(updateDailyBonusResourcesGathered) No islands found.`);
            return;
        }

        // prepare bulk write operations to update all islands' `dailyBonusResourcesGathered`
        const bulkWriteOps = islands.map(island => {
            return {
                updateOne: {
                    filter: { islandId: island.islandId },
                    update: {
                        $set: {
                            'islandResourceStats.dailyBonusResourcesGathered': 0
                        }
                    }
                }
            }
        });

        // execute the bulk write operations
        await IslandModel.bulkWrite(bulkWriteOps);

        console.log(`(updateDailyBonusResourcesGathered) All islands' dailyBonusResourcesGathered have been reset.`);
    } catch (err: any) {
        console.error(`(updateDailyBonusResourcesGathered) Error: ${err.message}`);
    }
}

/**
 * Claims either xCookies or cookie crumbs (or both, but at least one) from an island.
 */
export const claimXCookiesAndCrumbs = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
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
        // `lastClaimed` checks for both xCookies and cookie crumbs
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

        // check if the island has any cookie crumbs to claim
        const cookieCrumbs: number = island.islandEarningStats?.claimableCookieCrumbs;

        // at least one should be claimable, else return an error
        if (xCookies <= 0 && cookieCrumbs <= 0) {
            return {
                status: Status.ERROR,
                message: `(claimXCookies) No xCookies or Cookie Crumbs to claim.`
            }
        }

        // if xCookies can be claimed, do the following logic
        if (xCookies > 0) {
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
            // 2. set the island's `currentTax` to `tax`
            islandUpdateOperations.$set['islandEarningStats.claimableXCookies'] = 0;
            islandUpdateOperations.$set['currentTax'] = tax;
        }

        // if cookie crumbs can be claimed, do the following logic
        if (cookieCrumbs > 0) {
            // add the cookie crumbs to the user's inventory
            userUpdateOperations.$inc['inventory.cookieCrumbs'] = cookieCrumbs;

            // set the island's `claimableCookieCrumbs` to 0
            islandUpdateOperations.$set['islandEarningStats.claimableCookieCrumbs'] = 0;
        }

        // set the island's `lastClaimed` to the current time
        islandUpdateOperations.$set['islandEarningStats.lastClaimed'] = currentTime;

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

        // a list of resources to be added to the island's `claimableResources`.
        const claimableResourcesToAdd: ExtendedResource[] = [];
        // a list of resources to be added to the island's `resourcesGathered`.
        const gatheredResourcesToAdd: ExtendedResource[] = [];

        // check if the `resourcesLeft` is at least 1, if not, return an error.
        const baseResourceCap = island.islandResourceStats?.baseResourceCap as number;
        // check resourcesGathered (which only counts resources gathered with a 'NORMAL' origin. bonus resources are not counted towards the base resource cap.)
        const resourcesGathered: ExtendedResource[] = island.islandResourceStats?.resourcesGathered.filter((r: ExtendedResource) => r.origin === ExtendedResourceOrigin.NORMAL);

        // for barren isles, check only for resources gathered that are seaweed instead of the entire length.
        // this is because for barren isles, there is a small chance to drop common resources that won't be counted towards the base resource cap.
        if (<IslandType>island.type === IslandType.BARREN) {
            const seaweedGathered = resourcesGathered.filter(r => r.type === BarrenResource.SEAWEED);
            if (baseResourceCap - seaweedGathered.length <= 0) {
                return {
                    status: Status.ERROR,
                    message: `(dropResource) No resources left to drop.`
                }
            }
        }

        // for any other isles, check the entire length of resources gathered.
        if (baseResourceCap - resourcesGathered.length <= 0) {
            return {
                status: Status.ERROR,
                message: `(dropResource) No resources left to drop.`
            }
        }

        // randomize the resource from the effective drop chances based on the island's type and level
        const resourceToDrop: Resource = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);

        // firstly check if `claimableResources` is empty.
        const claimableResources: Resource[] = island.islandResourceStats?.claimableResources;

        if (claimableResources.length === 0 || !claimableResources) {
            // if empty, create a new resource and add it to the island's `claimableResources`
            const newResource: ExtendedResource = {
                ...resourceToDrop,
                origin: ExtendedResourceOrigin.NORMAL,
                amount: 1
            }

            // add the new resource to the island's `claimableResources`
            // islandUpdateOperations.$push['islandResourceStats.claimableResources'] = newResource;
            claimableResourcesToAdd.push(newResource);
        } else {
            // if not empty, check if the resource already exists in `claimableResources`
            const existingResourceIndex = claimableResources.findIndex(r => r.type === resourceToDrop.type);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${existingResourceIndex}.amount`] = 1;
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: ExtendedResource = {
                    ...resourceToDrop,
                    origin: ExtendedResourceOrigin.NORMAL,
                    amount: 1
                }

                // add the new resource to the island's `claimableResources`
                // islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: [newResource] };
                claimableResourcesToAdd.push(newResource);
            }
        }

        if (resourcesGathered.length === 0 || !resourcesGathered) {
            // if empty, create a new resource and add it to the island's `resourcesGathered`
            const newResource: ExtendedResource = {
                ...resourceToDrop,
                origin: ExtendedResourceOrigin.NORMAL,
                amount: 1
            }

            // add the new resource to the island's `resourcesGathered`
            // islandUpdateOperations.$push['islandResourceStats.resourcesGathered'] = { $each: [newResource] };
            gatheredResourcesToAdd.push(newResource);
        } else {
            // if not empty, check if the resource already exists in `resourcesGathered`
            const existingResourceIndex = resourcesGathered.findIndex(r => r.type === resourceToDrop.type);

            // if the resource already exists, increment its amount
            if (existingResourceIndex !== -1) {
                islandUpdateOperations.$inc[`islandResourceStats.resourcesGathered.${existingResourceIndex}.amount`] = 1;
            } else {
                // if the resource doesn't exist, push a new resource
                const newResource: ExtendedResource = {
                    ...resourceToDrop,
                    origin: ExtendedResourceOrigin.NORMAL,
                    amount: 1
                }

                // add the new resource to the island's `resourcesGathered`
                // islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: [newResource] };
                gatheredResourcesToAdd.push(newResource);
            }
        }

        // lastly, check if island is barren. if it is, they have an additional small chance to drop a common resource of any line.
        if (<IslandType>island.type === IslandType.BARREN) {
            // roll a dice between 1-100
            const rand = Math.random() * 100 + 1;

            // if dice lands under `BARREN_ISLE_COMMON_DROP_CHANCE`, drop a random common resource alongside the seaweed they're getting.
            if (rand <= BARREN_ISLE_COMMON_DROP_CHANCE) {
                // randomize any common resource from `resources`
                const commonResources = resources.filter(r => r.rarity === ResourceRarity.COMMON);
                const commonResourceToDrop = commonResources[Math.floor(Math.random() * commonResources.length)];

                // check if the common resource already exists in `claimableResources`
                const existingResourceIndex = claimableResources.findIndex(r => r.type === commonResourceToDrop.type);

                // if the resource already exists, increment its amount
                if (existingResourceIndex !== -1) {
                    islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${existingResourceIndex}.amount`] = 1;
                } else {
                    // if the resource doesn't exist, push a new resource
                    const newResource: ExtendedResource = {
                        ...commonResourceToDrop,
                        origin: ExtendedResourceOrigin.NORMAL,
                        amount: 1
                    }

                    // add the new resource to the island's `claimableResources`
                    // islandUpdateOperations.$push['islandResourceStats.claimableResources'].$each.push(newResource);
                    // islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: [newResource] };
                    claimableResourcesToAdd.push(newResource);
                }

                // add to the island's `resourcesGathered` as well
                // check if the common resource already exists in `resourcesGathered`
                const existingGatheredResourceIndex = resourcesGathered.findIndex(r => r.type === commonResourceToDrop.type);

                // if the resource already exists, increment its amount
                if (existingGatheredResourceIndex !== -1) {
                    islandUpdateOperations.$inc[`islandResourceStats.resourcesGathered.${existingGatheredResourceIndex}.amount`] = 1;
                } else {
                    // if the resource doesn't exist, push a new resource
                    const newResource: ExtendedResource = {
                        ...commonResourceToDrop,
                        origin: ExtendedResourceOrigin.NORMAL,
                        amount: 1
                    }

                    // add the new resource to the island's `resourcesGathered`
                    // islandUpdateOperations.$push['islandResourceStats.resourcesGathered'].$each.push(newResource);
                    gatheredResourcesToAdd.push(newResource);
                }


            }
        }

        // only run the next logic if `dailyBonusResourcesGathered` hasn't exceeded the limit yet.
        if (island.islandResourceStats?.dailyBonusResourcesGathered < DAILY_BONUS_RESOURCES_GATHERABLE(<IslandType>island.type)) {
            // finally, if the island has bits that have either the lucky, unlucky, trickster or hapless trait, they have a chance to drop a bonus resource.
            // there is a 5% base chance to drop a bonus resource everytime a resource is dropped.
            // each bit with a lucky trait gives a 2.5% chance to drop a bonus resource (stacks)
            // each bit with an unlucky trait reduces the chance to drop a bonus resource by 2.5% (stacks)
            // each bit with a trickster trait gives a 5% chance to drop a bonus resource (stacks)
            // each bit with a hapless trait reduces the chance to drop a bonus resource by 5% (stacks)
            let bonusResourceChance = 5;

            const placedBitIds = island.placedBitIds as number[];
            const bits = await BitModel.find({ bitId: { $in: placedBitIds } }).lean();

            for (const bit of bits) {
                if (bit.traits.includes(BitTrait.LUCKY)) {
                    bonusResourceChance += 2.5;
                }

                if (bit.traits.includes(BitTrait.UNLUCKY)) {
                    bonusResourceChance -= 2.5;
                }

                if (bit.traits.includes(BitTrait.TRICKSTER)) {
                    bonusResourceChance += 5;
                }

                if (bit.traits.includes(BitTrait.HAPLESS)) {
                    bonusResourceChance -= 5;
                }
            }

            // only if bonus resource chance is above 0 will we proceed to check if we can drop a bonus resource.
            if (bonusResourceChance > 0) {
                // roll a dice between 1-100
                const rand = Math.random() * 100 + 1;

                if (rand <= bonusResourceChance) {
                    // randomize a resource based on the island's resource drop chances
                    const bonusResource = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);

                    // at this point, the island update operations' `$push` should already have `$each` initialized and with at least 1 resource.
                    // if the resource inside this array is the same as the bonus resource, increment its amount.
                    // if not, push a new resource.
                    const existingResourceIndex = islandUpdateOperations.$push['islandResourceStats.claimableResources'].$each.findIndex((r: ExtendedResource) => r.type === bonusResource.type);

                    if (existingResourceIndex !== -1) {
                        islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${existingResourceIndex}.amount`] = 1;
                    } else {
                        const newResource: ExtendedResource = {
                            ...bonusResource,
                            origin: ExtendedResourceOrigin.BONUS,
                            amount: 1
                        }

                        // islandUpdateOperations.$push['islandResourceStats.claimableResources'].$each.push(newResource);
                        // islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: [newResource] };
                        claimableResourcesToAdd.push(newResource);
                    }

                    // increment the island's `islandResourceStats.dailyBonusResourcesGathered` by 1.
                    islandUpdateOperations.$inc['islandResourceStats.dailyBonusResourcesGathered'] = 1;

                    // add to the island's `resourcesGathered` as well
                    // check if the bonus resource already exists in `resourcesGathered`
                    const existingGatheredResourceIndex = resourcesGathered.findIndex(r => r.type === bonusResource.type);

                    // if the resource already exists, increment its amount
                    if (existingGatheredResourceIndex !== -1) {
                        islandUpdateOperations.$inc[`islandResourceStats.resourcesGathered.${existingGatheredResourceIndex}.amount`] = 1;
                    } else {
                        // if the resource doesn't exist, push a new resource
                        const newResource: ExtendedResource = {
                            ...bonusResource,
                            origin: ExtendedResourceOrigin.BONUS,
                            amount: 1
                        }

                        // islandUpdateOperations.$push['islandResourceStats.resourcesGathered'].$each.push(newResource);
                        gatheredResourcesToAdd.push(newResource);
                    }
                }
            }
        }

        console.log('(dropResource) Claimable resources to add: ', claimableResourcesToAdd);
        console.log('(dropResource) Gathered resources to add: ', gatheredResourcesToAdd);

        // add the resources to the island's `claimableResources` and `resourcesGathered`
        islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: claimableResourcesToAdd }
        islandUpdateOperations.$push['islandResourceStats.resourcesGathered'] = { $each: gatheredResourcesToAdd }

        console.log(`(dropResource) Island ID ${island.islandId}'s updateOperations: `, islandUpdateOperations);

        // execute the update operations
        if (Object.keys(islandUpdateOperations.$set).length > 0) {
            console.log('$set is not empty for island ID ', island.islandId);
            await IslandModel.updateOne({ islandId }, {
                $set: islandUpdateOperations.$set
            });
        }

        if (Object.keys(islandUpdateOperations.$push).length > 0) {
            console.log('$push is not empty for island ID ', island.islandId);
            await IslandModel.updateOne({ islandId }, {
                $push: islandUpdateOperations.$push
            });
        }

        if (Object.keys(islandUpdateOperations.$pull).length > 0) {
            console.log('$pull is not empty for island ID ', island.islandId);
            await IslandModel.updateOne({ islandId }, {
                $pull: islandUpdateOperations.$pull
            });
        }

        if (Object.keys(islandUpdateOperations.$inc).length > 0) {
            console.log('$inc is not empty for island ID ', island.islandId);
            await IslandModel.updateOne({ islandId }, {
                $inc: islandUpdateOperations.$inc
            })
        }

        return {
            status: Status.SUCCESS,
            message: `(dropResource) Island ID ${islandId} has dropped a resource: ${resourceToDrop}.`,
            data: {
                resource: resourceToDrop
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
export const randomizeResourceFromChances = (
    type: IslandType,
    // get the island's traits for common - legendary resourceas
    traits: IslandTrait[],
    level: number
): Resource => {
    // calculate the effective drop chance rates based on the island's type and level
    const effectiveDropChances: ResourceDropChance = calcEffectiveResourceDropChances(type, level);

    // rand between 1 to 100 to determine which resource to drop
    const rand = Math.random() * 100 + 1;

    // calculate the cumulative probability for each resource and see if the rand falls within the range
    let cumulativeProbability = 0;

    for (let [resourceRarity, probability] of Object.entries(effectiveDropChances)) {
        cumulativeProbability += probability;

        if (rand <= cumulativeProbability) {
            // capitalize the first letter of the resource rarity to match the ResourceRarity enum
            resourceRarity = resourceRarity.charAt(0).toUpperCase() + resourceRarity.slice(1);

            // get the trait for the resource rarity. if rarity is common, then take traits[0], if uncommon, then traits[1], and so on.
            const trait = traits[ResourceRarityNumeric[resourceRarity]];

            // if island type is barren, return seaweed
            // if trait is mineral rich, find the ore resource with the specified rarity.
            // if trait is aquifer, find the liquid resource with the specified rarity.
            // if trait is fertile, find the fruit resource with the specified rarity
            const resource = resources.find(r => {
                if (type === IslandType.BARREN) {
                    return r.line === ResourceLine.BARREN;
                }

                if (trait === IslandTrait.MINERAL_RICH) {
                    return r.line === ResourceLine.ORE && r.rarity === <ResourceRarity>resourceRarity;
                }

                if (trait === IslandTrait.AQUIFER) {
                    return r.line === ResourceLine.LIQUID && r.rarity === <ResourceRarity>resourceRarity;
                }

                if (trait === IslandTrait.FERTILE) {
                    return r.line === ResourceLine.FRUIT && r.rarity === <ResourceRarity>resourceRarity;
                }
            });

            return resource;
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
        // sort by islandId in descending order and get the first document
        const latestIsland = await IslandModel.findOne().sort({ islandId: -1 }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getLatestIslandId) Latest island id fetched.`,
            data: {
                latestIslandId: latestIsland.islandId
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
        common: dropChances.common + resourceDiff.common,
        uncommon: dropChances.uncommon + resourceDiff.uncommon,
        rare: dropChances.rare + resourceDiff.rare,
        epic: dropChances.epic + resourceDiff.epic,
        legendary: dropChances.legendary + resourceDiff.legendary
    }
}

/**
 * Gets the base resource modifier/diff based on the island type and multiply the values by the island's level - 1 (since level 1 uses base resource drop chances).
 */
export const calcResourceDropChanceDiff = (type: IslandType, level: number): ResourceDropChanceDiff => {
    const resourceDiff = RESOURCE_DROP_CHANCES_LEVEL_DIFF(type);

    return {
        common: resourceDiff.common * (level - 1),
        uncommon: resourceDiff.uncommon * (level - 1),
        rare: resourceDiff.rare * (level - 1),
        epic: resourceDiff.epic * (level - 1),
        legendary: resourceDiff.legendary * (level - 1)
    }
}