import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandStatsModifiers, IslandTappingData, IslandTrait, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { BARREN_ISLE_COMMON_DROP_CHANCE, BASE_CARESS_PER_TAPPING, BASE_ENERGY_PER_TAPPING, BIT_PLACEMENT_CAP, BIT_PLACEMENT_MIN_RARITY_REQUIREMENT, DAILY_BONUS_RESOURCES_GATHERABLE, DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER, ISLAND_EVOLUTION_COST, ISLAND_RARITY_DEVIATION_MODIFIERS, ISLAND_TAPPING_MILESTONE_BONUS_REWARD, ISLAND_TAPPING_MILESTONE_LIMIT, ISLAND_TAPPING_REQUIREMENT, MAX_ISLAND_LEVEL, RARITY_DEVIATION_REDUCTIONS, RESOURCES_CLAIM_COOLDOWN, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF, TOTAL_ACTIVE_ISLANDS_ALLOWED, X_COOKIE_CLAIM_COOLDOWN, X_COOKIE_TAX, randomizeIslandTraits } from '../utils/constants/island';
import { calcBitCurrentRate, getBits } from './bit';
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, Resource, ResourceLine, ResourceRarity, ResourceRarityNumeric, ResourceType, SimplifiedResource } from '../models/resource';
import { UserSchema } from '../schemas/User';
import { Modifier } from '../models/modifier';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitRarity, BitRarityNumeric, BitStatsModifiers, BitTrait, BitTraitData, BitType } from '../models/bit';
import { generateObjectId } from '../utils/crypto';
import { BitModel, ConsumedSynthesizingItemModel, IslandModel, LeaderboardModel, SquadLeaderboardModel, SquadModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';
import { RELOCATION_COOLDOWN } from '../utils/constants/bit';
import { ExtendedXCookieData, PlayerEnergy, PlayerMastery, User, XCookieSource } from '../models/user';
import { getResource, resources } from '../utils/constants/resource';
import { Item } from '../models/item';
import { BoosterItem } from '../models/booster';
import { TAPPING_MASTERY_LEVEL } from '../utils/constants/mastery';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { TappingMastery } from '../models/mastery';
import { updateReferredUsersData } from './user';
import { redis } from '../utils/constants/redis';
import { SYNTHESIZING_ITEM_DATA, SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE } from '../utils/constants/asset';

/**
 * Gifts an Xterio user an Xterio island.
 */
export const giftXterioIsland = async (
    twitterId: string
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(giftXterioIsland) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const { status, message, data } = await getLatestIslandId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(giftXterioIsland) Error from getLatestIslandId: ${message}`
            }
        }

        // get the latest island id
        const latestIslandId = data?.latestIslandId as number;

        const islandType = IslandType.XTERIO_ISLES;

        const baseResourceCap = randomizeBaseResourceCap(islandType);
        const traits = randomizeIslandTraits();
        const totalXCookiesEarnable = 0;
        const totalCookieCrumbsEarnable = 0;

        const userBitIds = user.inventory?.bitIds as number[];

        const islandStatsModifiers: IslandStatsModifiers = {
            resourceCapModifiers: [],
            gatheringRateModifiers: [],
            earningRateModifiers: []
        }

        // loop through each bit and see if they have these traits:
        // influential, antagonistic, famous or mannerless
        // if influential, add 1% to earning and gathering rate modifiers
        // if antagonistic, reduce 1% to earning and gathering rate modifiers
        // if famous, add 0.5% to earning and gathering rate modifiers
        // if mannerless, reduce 0.5% to earning and gathering rate modifiers
        const bits = await BitModel.find({ bitId: { $in: userBitIds } }).lean();

        bits.forEach(bit => {
            const bitTraits = bit.traits as BitTraitData[];

            // check if the `trait` within each bitTraits instance contain the following traits
            if (
                bitTraits.some(traitData => {
                    return traitData.trait === BitTrait.INFLUENTIAL ||
                        traitData.trait === BitTrait.FAMOUS ||
                        traitData.trait === BitTrait.MANNERLESS ||
                        traitData.trait === BitTrait.ANTAGONISTIC
                })
            ) {
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: ${bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 'Influential' :
                        bitTraits.some(traitData => traitData.trait === BitTrait.FAMOUS) ? 'Famous' :
                            bitTraits.some(traitData => traitData.trait === BitTrait.MANNERLESS) ? 'Mannerless' :
                                'Antagonistic'
                        }`,
                    value: bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 1.01 :
                        bitTraits.some(traitData => traitData.trait === BitTrait.FAMOUS) ? 1.005 :
                            bitTraits.some(traitData => traitData.trait === BitTrait.MANNERLESS) ? 0.995 :
                                0.99
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: ${bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 'Influential' :
                        bitTraits.some(traitData => traitData.trait === BitTrait.FAMOUS) ? 'Famous' :
                            bitTraits.some(traitData => traitData.trait === BitTrait.MANNERLESS) ? 'Mannerless' :
                                'Antagonistic'
                        }`,
                    value: bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 1.01 :
                        bitTraits.some(traitData => traitData.trait === BitTrait.FAMOUS) ? 1.005 :
                            bitTraits.some(traitData => traitData.trait === BitTrait.MANNERLESS) ? 0.995 :
                                0.99
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }
        });

        // add the island to the user's inventory
        userUpdateOperations.$push['inventory.islandIds'] = latestIslandId + 1;

        const island = new IslandModel({
            islandId: latestIslandId + 1,
            type: islandType,
            owner: user._id,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.XTERIO,
            currentLevel: 1,
            currentTax: 0,
            placedBitIds: [],
            traits,
            islandResourceStats: {
                baseResourceCap,
                resourcesGathered: [],
                dailyBonusResourcesGathered: 0,
                claimableResources: [],
                gatheringStart: 0,
                gatheringEnd: 0,
                lastClaimed: 0,
                gatheringProgress: 0,
                lastUpdatedGatheringProgress: Math.floor(Date.now() / 1000)
            },
            islandEarningStats: {
                totalXCookiesSpent: 0,
                totalXCookiesEarnable,
                totalXCookiesEarned: 0,
                claimableXCookies: 0,
                totalCookieCrumbsSpent: 0,
                totalCookieCrumbsEarnable,
                totalCookieCrumbsEarned: 0,
                claimableCookieCrumbs: 0,
                earningStart: Math.floor(Date.now() / 1000),
                crumbsEarningStart: Math.floor(Date.now() / 1000),
                earningEnd: 0,
                crumbsEarningEnd: 0,
                lastClaimed: 0,
            },
            islandStatsModifiers
        });

        // save the island to the database
        await island.save();

        // update the user's inventory
        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(giftXterioIsland) Xterio island gifted to user.`,
            data: {
                island
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(giftXterioIsland) Error: ${err.message}`
        }
    }
}

/**
 * Generates a barren island. This is called when a user signs up or when a user obtains and opens a bottled message.
 */
export const generateBarrenIsland = async (
    userId: string,
    obtainMethod: ObtainMethod.SIGN_UP | ObtainMethod.BOTTLED_MESSAGE,
    // leave empty if no modifiers are to be applied.
    // however, when signing up, users will at times get bits that will impact the barren island's stats modifiers
    islandStatsModifiers: IslandStatsModifiers,
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
                gatheringProgress: 0,
                lastUpdatedGatheringProgress: Math.floor(Date.now() / 1000)
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
            islandStatsModifiers: islandStatsModifiers
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
            message: `(deleteIsland) Island with ID ${islandId} successfully deleted.`,
            data: {
                islandId: islandId,
                islandType: island.type,
                islandTraits: island.traits
            }
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

        // Track consumed Currency
        let currentCurrency: number = 0;
        let totalPaid: number = 0;
        let paymentChoice: 'xCookies' | 'cookieCrumbs';

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
            const userXCookies: number = user.inventory?.xCookieData.currentXCookies;
            currentCurrency = userXCookies;

            // calculate the cost to evolve the island based on its current level
            const { xCookies: requiredXCookies } = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);
            totalPaid = requiredXCookies;
            paymentChoice = 'xCookies';

            // if not enough, return an error.
            if (userXCookies < requiredXCookies) {
                return {
                    status: Status.ERROR,
                    message: `(evolveIsland) Not enough xCookies to evolve island.`
                }
            }

            // deduct the xCookies from the user and increment the `totalXCookiesSpent` and `weeklyXCookiesSpent` of the island by `requiredXCookies`
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = requiredXCookies;

            // firstly, check if at this moment, the totalXCookiesSpent is 0.
            // because if it is, it means that earning hasn't started yet, meaning that after evolving the island, `earningStart` will be set to current timestamp, and earning will start.
            const totalXCookiesEarnableIsZero = island.islandEarningStats?.totalXCookiesEarnable === 0;

            // if totalXCookies spent is 0, evolve the island, increment the totalXCookiesSpent and totalXCookiesEarnable of the island by `requiredXCookies` and also set the `earningStart` to now.
            if (totalXCookiesEarnableIsZero) {
                islandUpdateOperations.$inc['currentLevel'] = 1;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;

                ////// !!!! temporarily disable earning xCookies from evolving and the earning start for season 0 !!!! //////
                // islandUpdateOperations.$inc['islandEarningStats.totalXCookiesEarnable'] = requiredXCookies;
                // islandUpdateOperations.$set['islandEarningStats.earningStart'] = Math.floor(Date.now() / 1000);

                // otherwise, only evolve the island and increment the totalXCookiesSpent and totalXCookiesEarnable by `requiredXCookies`.
            } else {
                islandUpdateOperations.$inc['currentLevel'] = 1;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = requiredXCookies;
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesEarnable'] = requiredXCookies;
            }
            // if choice to evolve is using cookie crumbs
        } else {
            const userCookieCrumbs: number = user.inventory?.cookieCrumbs;
            currentCurrency = userCookieCrumbs;

            // calculate the cost to evolve the island based on its current level
            const { cookieCrumbs: requiredCookieCrumbs } = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);
            totalPaid = requiredCookieCrumbs;
            paymentChoice = 'cookieCrumbs';

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
                island,
                currentLevel: island.currentLevel,
                nextLevel: island.currentLevel + 1,
                totalPaid,
                paymentChoice,
                userCurrency: {
                    currentValue: currentCurrency,
                    updatedValue: Math.max(currentCurrency - totalPaid, 0),
                }
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
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean(),
            IslandModel.findOne({ islandId }).lean()
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

        const minRarityRequired = BIT_PLACEMENT_MIN_RARITY_REQUIREMENT(<IslandType>island.type);

        const bitRarityAllowed = checkBitRarityAllowed(bitRarity, minRarityRequired);

        if (!bitRarityAllowed) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit rarity is too low to be placed on the island.`
            }
        }

        // check for any limitations/negative modifiers from rarity deviation (if bit rarity is lower than the island's type)
        // NOTE: if the bit is an xterio bit, there won't be any rarity deviation reductions.
        const rarityDeviationReductions =
            bit.bitType === BitType.XTERIO ? {
                gatheringRateReduction: 0,
                earningRateReduction: 0
            } : RARITY_DEVIATION_REDUCTIONS(<IslandType>island.type, bitRarity);

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

        // check if the to-be-put bit is the first one; if yes, start the `gatheringStart` timestamp (assuming it hasn't started yet)
        if (island.placedBitIds.length === 0 && island.islandResourceStats.gatheringStart === 0) {
            islandUpdateOperations.$set['islandResourceStats.gatheringStart'] = Math.floor(Date.now() / 1000);
        }

        // place the bit on the island
        islandUpdateOperations.$push['placedBitIds'] = bitId;

        // update the bit to include `placedIslandId`
        bitUpdateOperations.$set['placedIslandId'] = islandId;

        // set the lastRelocationTimestamp of the relocated bit to now (regardless of whether the bit was relocated or just placed since that will also trigger the cooldown)
        bitUpdateOperations.$set['lastRelocationTimestamp'] = Math.floor(Date.now() / 1000);

        // now, check if this island has any synthesizing items applied with `placedBitsEnergyDepletionRateModifier.active` set to true and `allowLaterPlacedBitsToObtainEffect` set to true.
        // if yes, we need to update the bit's energy rate modifiers to include the synthesizing items' effects.
        const bitStatsModifiersFromConsumedSynthesizingItems = await placedBitModifiersFromConsumedSynthesizingItems(
            user._id,
            bitId,
            island as Island
        );

        // add the bit's energy rate modifiers to the bit's stats modifiers
        // first, check if `energyRateModifiers` exists in the bit's stats modifiers in the update operations.
        // if yes, append the new modifiers to the existing array. if not, create a new array with the new modifiers.
        if (bitUpdateOperations.$set['bitStatsModifiers.energyRateModifiers']) {
            bitUpdateOperations.$push['bitStatsModifiers.energyRateModifiers'] = { $each: bitStatsModifiersFromConsumedSynthesizingItems.energyRateModifiers };
        } else {
            bitUpdateOperations.$set['bitStatsModifiers.energyRateModifiers'] = bitStatsModifiersFromConsumedSynthesizingItems.energyRateModifiers;
        }        

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations),
            BitModel.updateOne({ bitId }, bitUpdateOperations)
        ]);

        // update the other bits' modifiers and also if applicable the island's modifiers with the bit's traits
        // also updates the to-be-placed bit's modifiers if other bits have traits that impact it
        await updateExtendedTraitEffects(bit as Bit, island as Island);

        return {
            status: Status.SUCCESS,
            message: `(placeBit) Bit placed on the island.`,
            data: {
                bit,
                island
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
 * Updates a placed bit's modifiers based on one or multiple consumed synthesizing items that have an effect on them even when placed after
 * the synthesizing items were consumed.
 */
export const placedBitModifiersFromConsumedSynthesizingItems = async (userId: string, bitId: number, island: Island): Promise<BitStatsModifiers> => {
    try {
        // loop through the ConsumedSynthesizingItems where `effectUntil` is greater than the current timestamp
        const consumedSynthesizingItems = await ConsumedSynthesizingItemModel.find({ usedBy: userId, affectedAsset: 'island', islandOrBitId: island.islandId, effectUntil: { $gt: Math.floor(Date.now() / 1000) } }).lean();

        // if there are no consumed synthesizing items, return an empty object
        if (consumedSynthesizingItems.length === 0) {
            return {
                gatheringRateModifiers: [],
                earningRateModifiers: [],
                energyRateModifiers: [],
                foodConsumptionEfficiencyModifiers: []
            }
        }

        const bitStatsModifiers: BitStatsModifiers = {
            gatheringRateModifiers: [],
            earningRateModifiers: [],
            energyRateModifiers: [],
            foodConsumptionEfficiencyModifiers: []
        }

        // for each consumed item, fetch the synthesizing item data and check if they have the `allowLaterPlacedBitsToObtainEffect` set to true.
        // if yes, based on what the item does, update the bit's modifiers.
        for (const consumedItem of consumedSynthesizingItems) {
            const itemData = SYNTHESIZING_ITEM_DATA.find(item => item.name === consumedItem.item);

            if (!itemData) {
                continue;
            }

            // if the synthesizing item has `placedBitsEnergyDepletionRateModifier.active` set to true and `allowLaterPlacedBitsToObtainEffect` set to true,
            // we need to update the bit's energy rate modifiers to include the synthesizing item's effects.
            if (itemData.effectValues.placedBitsEnergyDepletionRateModifier.active && itemData.effectValues.placedBitsEnergyDepletionRateModifier.allowLaterPlacedBitsToObtainEffect) {
                // get the placed bits of the island
                const placedBits = island.placedBitIds;

                // fetch the bull queue data for this item (if there are multiple, fetch the first one)
                const bullQueueData = await SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.getJobs(['waiting', 'active', 'delayed']);

                // find any bull queues that have the `origin` starting with `Synthesizing Item: ${itemData.name}. Rand ID: ${consumedItem._id}` and `bitId` is in the `placedBits`
                const relevantBullQueueData = bullQueueData.filter(queue => (queue.data.origin as string).startsWith(`Synthesizing Item: ${itemData.name}. Rand ID: ${consumedItem._id}`) && placedBits.includes(queue.data.bitId));

                console.log(`relevantBullQueueData: `, relevantBullQueueData[0]);

                // get the first data (because we just care about the endTimestamp)
                const relevantBullQueueDataFirst = relevantBullQueueData[0];

                // create the modifier
                const energyRateModifier: Modifier = {
                    origin: `Synthesizing Item: ${itemData.name}. Rand ID: ${consumedItem._id}`,
                    value: itemData.effectValues.placedBitsEnergyDepletionRateModifier.value
                }

                // if data isn't found, then there is an issue or the queue simply doesn't exist. just return.
                if (!relevantBullQueueDataFirst) {
                    console.error(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) relevantBullQueueDataFirst not found.`);
                    continue;
                }

                // push the modifier to the bit's energy rate modifiers
                bitStatsModifiers.energyRateModifiers.push(energyRateModifier);

                // add the bit to the queue
                await SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.add(
                    'removeBitEnergyDepletionRateModifier',
                    {
                        bitId,
                        owner: userId,
                        origin: `Synthesizing Item: ${itemData.name}. Rand ID: ${consumedItem._id}`,
                        // for the end timestamp, we will match it with the `relevantBullQueueDataFirst`'s endTimestamp
                        // because we don't want it to last longer than the other bits.
                        endTimestamp: relevantBullQueueDataFirst.data.endTimestamp
                    }
                );
            }
        }

        return bitStatsModifiers;
    } catch (err: any) {
        console.error(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) Error: ${err.message}`);
        
        return {
            gatheringRateModifiers: [],
            earningRateModifiers: [],
            energyRateModifiers: [],
            foodConsumptionEfficiencyModifiers: []
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
                const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin.includes(`Bit ID #${bit.bitId}`));
                const earningRateModifierIndex = (island.islandStatsModifiers?.earningRateModifiers as Modifier[]).findIndex(modifier => modifier.origin.includes(`Bit ID #${bit.bitId}`));

                console.log('gathering rate modifier index: ', gatheringRateModifierIndex);
                console.log('earning rate modifier index: ', earningRateModifierIndex);

                // if the modifier is found, remove it from the island's `gatheringRateModifiers` and `earningRateModifiers`
                if (gatheringRateModifierIndex !== -1) {
                    islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex];
                }

                if (earningRateModifierIndex !== -1) {
                    islandUpdateOperations.$pull['islandStatsModifiers.earningRateModifiers'] = island.islandStatsModifiers?.earningRateModifiers[earningRateModifierIndex];
                }
                // if trait is teamworker, leader, cute or lonewolf, remove modifiers for each bit that was impacted by this bit's trait
            } else if (
                trait.trait === BitTrait.TEAMWORKER ||
                trait.trait === BitTrait.LEADER ||
                trait.trait === BitTrait.CUTE ||
                trait.trait === BitTrait.LONEWOLF
            ) {
                for (const otherBit of otherBits) {
                    // check the index of the modifier in the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const gatheringRateModifierIndex = (otherBit.bitStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin.includes(`Bit ID #${bit.bitId}`));
                    const earningRateModifierIndex = (otherBit.bitStatsModifiers?.earningRateModifiers as Modifier[]).findIndex(modifier => modifier.origin.includes(`Bit ID #${bit.bitId}`));

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
                }
            }
        }

        const bitUpdatePromises = bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        });

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
                bit,
                island
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
        } else if (trait.trait === BitTrait.QUICK) {
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

    // now, we also need to see if the other bits have traits that impact the to-be-placed bit's modifiers
    // these traits include: teamworker, leader, cute and lonewolf
    const otherBits = await BitModel.find({ bitId: { $in: otherBitIds } }).lean();

    if (otherBits.length > 0) {
        // loop through each bit and check if they have the aforementioned traits.
        for (const otherBit of otherBits) {
            const traits = otherBit.traits as BitTraitData[];

            for (const trait of traits) {
                // if this `otherBit`'s trait contains 'teamworker', check if the to-be-placed's bit rarity is the same or lesser rarity than the `otherBit`'s rarity.
                // if yes, add 5% gathering and earning rate to the to-be-placed bit
                if (trait.trait === BitTrait.TEAMWORKER) {
                    if (BitRarityNumeric[bit.rarity] <= BitRarityNumeric[otherBit.rarity]) {
                        // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                        const newGatheringRateModifier: Modifier = {
                            origin: `Bit ID #${otherBit.bitId}'s Trait: Teamworker`,
                            value: 1.05
                        }

                        const newEarningRateModifier: Modifier = {
                            origin: `Bit ID #${otherBit.bitId}'s Trait: Teamworker`,
                            value: 1.05
                        }

                        // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                        bitUpdateOperations.push({
                            bitId: bit.bitId,
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
                }

                // if the other bit's trait is leader, add 10% gathering and earning rate to the to-be-placed bit
                if (trait.trait === BitTrait.LEADER) {
                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Leader`,
                        value: 1.1
                    }

                    const newEarningRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Leader`,
                        value: 1.1
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
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

                // if the other bit's trait is cute, add 12.5% gathering and earning rate to the to-be-placed bit
                if (trait.trait === BitTrait.CUTE) {
                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Cute`,
                        value: 1.125
                    }

                    const newEarningRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Cute`,
                        value: 1.125
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
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

                // if the other bit's trait is lonewolf, reduce 5% gathering and earning rate to the to-be-placed bit
                if (trait.trait === BitTrait.LONEWOLF) {
                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Lonewolf`,
                        value: 0.95
                    }

                    const newEarningRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Lonewolf`,
                        value: 0.95
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers` and `earningRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
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
            }
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
 * (Called by scheduler, EVERY 15 MINUTES) Loops through all islands and updates the gathering progress for each island.
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
            'islandResourceStats.gatheringEnd': 0,
            // remove this because we still need to update `lastUpdatedGatheringProgress` even if gathering has not started.
            // 'islandResourceStats.gatheringStart': { $ne: 0 },
            // remove this because we still need to update `lastUpdatedGatheringProgress` even if there are no bits placed on the island
            // 'placedBitIds.0': { $exists: true }
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
                <IslandType>island.type,
                baseRates,
                bitLevels,
                initialGrowthRates,
                bitModifiers,
                island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
            );

            // get the last updated gathering progress timestamp
            const lastUpdatedGatheringProgress = island.islandResourceStats?.lastUpdatedGatheringProgress as number;

            // to calculate the gathering progress increment every 3 minutes, we need to firstly calculate the time it takes (in hours) to drop 1 resource.
            // the gathering progress increment/hour (in %) will just be 1 / time to drop 1 resource * 100 (or 100/time to drop resource)
            // which means that the gathering progress increment/10 minutes will be the gathering progress increment per hour / 6.
            // example:
            // say an island has a 250 resource cap. if the gathering rate is 0.02% of total resources/hour, this equates to gathering 0.02/100*250 = 0.05 resources per hour.
            // to get 1 resource to drop, it would take 1/0.05 = 20 hours, meaning that each hour, the gathering progress (to drop 1 resource) increments by 1/20*100 = 5%.
            // to get the gathering progress in 3 minutes, divide 5% by 20 to get 0.25% per 3 minutes.

            // however, note that this is assuming `updateGatheringProgressAndDropResourceAlt` is not called. if it is, then the updated value will not add
            // 3 minutes worth of `gatheringProgressIncrement` but rather x minutes based on the current timestamp - `lastUpdatedGatheringProgress`.
            const resourcesPerHour = gatheringRate / 100 * island.islandResourceStats?.baseResourceCap;
            const hoursToDropResource = 1 / resourcesPerHour;
            const gatheringProgressIncrementPerHour = 1 / hoursToDropResource * 100;

            // check time passed since last update
            const currentTime = Math.floor(Date.now() / 1000);
            const timePassed = currentTime - lastUpdatedGatheringProgress;

            // calculate the gathering progress increment
            const gatheringProgressIncrement = gatheringProgressIncrementPerHour / 3600 * timePassed;

            console.log(`(updateGatheringProgressAndDropResource) Island ID ${island.islandId} has a current gathering rate of ${gatheringRate} %/hour and a gathering progress increment of ${gatheringProgressIncrement}%/${timePassed} seconds.`)

            if (gatheringProgress + gatheringProgressIncrement < 100) {
                // add to the update operations
                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            $inc: {
                                'islandResourceStats.gatheringProgress': gatheringProgressIncrement
                            },
                            $set: {
                                // set the `lastUpdatedGatheringProgress` to the current time
                                'islandResourceStats.lastUpdatedGatheringProgress': Math.floor(Date.now() / 1000)
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
                finalGatheringProgress = (gatheringProgress + gatheringProgressIncrement) % 100;

                // reset the gathering progress back to 0 + the remaining overflow of %
                updateOperations.push({
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            $set: {
                                'islandResourceStats.gatheringProgress': finalGatheringProgress,
                                // set the `lastUpdatedGatheringProgress` to the current time
                                'islandResourceStats.lastUpdatedGatheringProgress': Math.floor(Date.now() / 1000)
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
 * An alternative to `updateGatheringProgressAndDropResource` that gets called from the frontend when the progress bar reaches 100% when users are active.
 * 
 * Also only updates one island at a time.
 * 
 * This will drop a resource the moment the gathering progress reaches 100% instead of every 10th minute.
 * 
 * However, there will be checks to ensure that the gathering progress increment was in fact not manually modified by the user, else the function reverts.
 */
export const updateGatheringProgressAndDropResourceAlt = async (
    twitterId: string,
    islandId: number
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(updateGatheringProgressAndDropResourceAlt) User not found.`
            }
        }

        // check if user owns the island
        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(updateGatheringProgressAndDropResourceAlt) User does not own the island.`
            }
        }

        // get the island info
        const island = await IslandModel.findOne({ islandId }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(updateGatheringProgressAndDropResourceAlt) Island not found.`
            }
        }

        // check if the island has bits placed
        if (!island.placedBitIds || island.placedBitIds.length === 0) {
            return {
                status: Status.ERROR,
                message: `(updateGatheringProgressAndDropResourceAlt) Island has no bits placed.`
            }
        }

        const gatheringProgress = island.islandResourceStats?.gatheringProgress as number;

        // get the bits placed on the island to calculate the current gathering rate
        const { status, message, data } = await getBits(island.placedBitIds);

        // if error, just console log and return
        if (status !== Status.SUCCESS) {
            return {
                status: Status.ERROR,
                message: `(updateGatheringProgressAndDropResourceAlt) Error: ${message}`
            }
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
            <IslandType>island.type,
            baseRates,
            bitLevels,
            initialGrowthRates,
            bitModifiers,
            island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
        );

        // get the last updated gathering progress
        const lastUpdatedGatheringProgress = island.islandResourceStats?.lastUpdatedGatheringProgress as number;

        // get the gathering progress increment every hour. this is to check if the user has manually modified the gathering progress.
        const resourcesPerHour = gatheringRate / 100 * island.islandResourceStats?.baseResourceCap;
        const hoursToDropResource = 1 / resourcesPerHour;
        const gatheringProgressIncrementPerHour = 1 / hoursToDropResource * 100;

        // check the time that has passed since the last gathering progress update
        const currentTime = Math.floor(Date.now() / 1000);
        const timePassed = currentTime - lastUpdatedGatheringProgress;

        // calculate the gathering progress increment based on the time passed
        // for example, if the gathering progress increment per hour is 5%, and the time passed since the last update is 1800 seconds (30 minutes)
        // the gathering progress increment will be 2.5%.
        const gatheringProgressIncrement = gatheringProgressIncrementPerHour / 3600 * timePassed;

        // check if the gathering progress + the increment is >= 100. if yes, calculate the new gathering progress and drop a resource.
        if (gatheringProgress + gatheringProgressIncrement >= 100) {
            // calculate the remaining overflow of %
            const finalGatheringProgress = (gatheringProgress + gatheringProgressIncrement) - 100;

            // drop the resource
            const { status, message } = await dropResource(islandId);

            if (status !== Status.SUCCESS) {
                return {
                    status: Status.ERROR,
                    message: `(updateGatheringProgressAndDropResourceAlt) Error from dropResource: ${message}`
                }
            }

            // reset the gathering progress back to 0 + the remaining overflow of %
            await IslandModel.updateOne(
                { islandId },
                {
                    $set: {
                        'islandResourceStats.gatheringProgress': finalGatheringProgress,
                        // set the `lastUpdatedGatheringProgress` to the current time
                        'islandResourceStats.lastUpdatedGatheringProgress': Math.floor(Date.now() / 1000)
                    }
                }
            );

            return {
                status: Status.SUCCESS,
                message: `(updateGatheringProgressAndDropResourceAlt) Resource dropped and gathering progress reset.`,
                data: {
                    islandId,
                    finalGatheringProgress
                }
            }
        } else {
            return {
                status: Status.ERROR,
                message: `(updateGatheringProgressAndDropResourceAlt) Gathering progress not yet at 100%.`
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateGatheringProgressAndDropResourceAlt) Error: ${err.message}`
        }
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
                <IslandType>island.type,
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
 * Applies a Gathering Progress booster to boost an island's gathering progress and potentially drop resources.
 */
export const applyGatheringProgressBooster = async (
    twitterId: string,
    islandId: number,
    boosters: BoosterItem[]
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

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
                message: `(applyGatheringProgressBooster) User not found.`
            }
        }

        // check if the user owns the island
        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(applyGatheringProgressBooster) User does not own the island.`
            }
        }

        // get the island
        const island = await IslandModel.findOne({ islandId }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) Island not found.`
            }
        }

        // check if the gathering of the island has started. if not, return an error
        if (island.islandResourceStats?.gatheringStart === 0) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) Gathering rate has not started for Island ID ${islandId}.`
            }
        }

        // check if the gathering of the island has ended. if yes, return an error
        if (island.islandResourceStats?.gatheringEnd !== 0) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) Gathering rate has ended for Island ID ${islandId}.`
            }
        }

        // check if each booster is the same (e.g. if the user wants to Gathering Progress Booster 25%, all boosters must be the same)
        const firstBooster = boosters[0];
        const allSameBooster = boosters.every(booster => booster === firstBooster);

        if (!allSameBooster) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) All boosters must be the same.`
            }
        }

        // require boosters to only be Gathering Progress Boosters
        const allGatheringProgressBoosters = boosters.every(booster => booster.includes('Gathering Progress Booster'));

        if (!allGatheringProgressBoosters) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) All boosters must be Gathering Progress Boosters.`
            }
        }

        // if booster is 10%, 25%, 50%, 100%, 200% or 300%, allow up to 10 of the same booster to be applied.
        // if booster is 500%, 1000%, 2000% or 3000%, only allow 1 of the same booster to be applied.
        const allowedAmount = [10, 25, 50, 100, 200, 300].includes(parseFloat(firstBooster.split(' ')[3])) ? 10 : 1;

        if (boosters.length > allowedAmount) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) Only ${allowedAmount} of the same booster can be applied.`
            }
        }

        // check if the user owns the booster (by checking the first booster, because at this point, all boosters are already assumbed to be the same)
        const boosterIndex = (user.inventory.items as Item[]).findIndex(item => item.type === firstBooster);

        if (boosterIndex === -1) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) User does not own the booster.`
            }
        }

        // check if the user has enough boosters
        if ((user.inventory.items as Item[])[boosterIndex].amount < boosters.length) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) User does not have enough boosters.`
            }
        }

        // for boosters that are greater than 100%, that means that 1 or more resources will be dropped.
        // in this case, we need to check if the resources the island can gather left is greater than the resources the booster will drop.
        // if not, we throw an error.
        // get only resources that have an origin of `ExtendedResourceOrigin.NORMAL`
        const normalResourcesGathered = (island.islandResourceStats?.resourcesGathered as ExtendedResource[]).filter(resource => resource.origin === ExtendedResourceOrigin.NORMAL);
        // add the amount of resources per `normalResourcesGathered` instance
        const normalResourcesGatheredAmount = normalResourcesGathered.reduce((acc, resource) => acc + resource.amount, 0);
        const resourcesLeft = island.islandResourceStats?.baseResourceCap - normalResourcesGatheredAmount;

        console.log(`resources left for island ${island.islandId}: `, resourcesLeft);

        // boosters will be something like 'Gathering Progress Booster 200%', so we need to get the base percentage (of the first booster, because all boosters are the same)
        const baseBoosterPercentage = parseFloat(firstBooster.split(' ')[3]);

        // get the total booster percentage (e.g. if there are 3 200% boosters, the total booster percentage will be 600%)
        const boosterPercentage = baseBoosterPercentage * boosters.length;

        // if the booster is less than 100, get the current `gatheringProgress` of the island.
        if (boosterPercentage < 100) {
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;

            // if the gathering progress + booster percentage is greater than 100:
            // 1. drop a resource
            // 2. reset the gathering progress to the remaining overflow of %
            if (gatheringProgress + boosterPercentage > 100) {
                // check if a single resource can be dropped
                if (resourcesLeft === 0) {
                    console.log(`(applyGatheringProgressBooster) Island ID ${islandId} has no resources left to drop. Cannot apply booster.`);

                    return {
                        status: Status.ERROR,
                        message: `(applyGatheringProgressBooster) Island ID ${islandId} has no resources left to drop. Cannot apply booster.`
                    }
                }

                // calculate the remaining overflow of %
                const finalGatheringProgress = (gatheringProgress + boosterPercentage) - 100;

                // reset the gathering progress back to 0 + the remaining overflow of %
                islandUpdateOperations.$set['islandResourceStats.gatheringProgress'] = finalGatheringProgress;

                // deduct the boosters from the user's inventory, update `totalAmountConsumed` and `weeklyAmountConsumed`.
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = -boosters.length;
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.totalAmountConsumed`] = boosters.length;
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.weeklyAmountConsumed`] = boosters.length;

                // execute the update operations
                await Promise.all([
                    UserModel.updateOne({ twitterId }, userUpdateOperations),
                    IslandModel.updateOne({ islandId }, islandUpdateOperations)
                ]);

                // drop a resource
                const { status, message } = await dropResource(islandId);

                if (status !== Status.SUCCESS) {
                    console.log(`(applyGatheringProgressBooster) Error from dropResource: ${message}`);

                    return {
                        status: Status.ERROR,
                        message: `(applyGatheringProgressBooster) Error: ${message}`
                    }
                }

                return {
                    status: Status.SUCCESS,
                    message: `(applyGatheringProgressBooster) Gathering Progress Booster applied successfully for Island ID ${islandId}.`,
                    data: {
                        island: island,
                        gatheringProgressData: {
                            prevGatheringProgress: gatheringProgress,
                            finalGatheringProgress,
                            resourcesDropped: 1
                        },
                        boosters: {
                            type: firstBooster,
                            amount: boosters.length
                        }
                    }
                }
                // if not, just increment the gathering progress by the booster percentage and deduct the booster from the user's inventory.
            } else {
                islandUpdateOperations.$inc['islandResourceStats.gatheringProgress'] = boosterPercentage;

                // deduct the boosters from the user's inventory, update `totalAmountConsumed` and `weeklyAmountConsumed`.
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = -boosters.length;
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.totalAmountConsumed`] = boosters.length;
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.weeklyAmountConsumed`] = boosters.length;

                // execute the update operations
                await Promise.all([
                    UserModel.updateOne({ twitterId }, userUpdateOperations),
                    IslandModel.updateOne({ islandId }, islandUpdateOperations)
                ]);

                return {
                    status: Status.SUCCESS,
                    message: `(applyGatheringProgressBooster) Gathering Progress Booster applied successfully for Island ID ${islandId}.`,
                    data: {
                        island,
                        gatheringProgressData: {
                            prevGatheringProgress: gatheringProgress,
                            finalGatheringProgress: gatheringProgress + boosterPercentage,
                            resourcesDropped: 0,
                        },
                        boosters: {
                            type: firstBooster,
                            amount: boosters.length
                        }
                    }
                }
            }
            // if the booster is greater than 100,
            // 1. check the final non-modulo gathering progress. e.g. if the current gathering progress is 70 and a 500% booster is applied, the non-modulo progress will be 570%.
            // 2. this means that Math.floor(570/100) = 5 resources will be dropped, and the final gathering progress will be 70.
        } else {
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;
            const finalNonModuloGatheringProgress = gatheringProgress + boosterPercentage;
            const resourcesToDrop = Math.floor(finalNonModuloGatheringProgress / 100);

            console.log(`gathering progress of island ${island.islandId}: `, gatheringProgress);
            console.log(`final non-modulo gathering progress of island ${island.islandId}: `, finalNonModuloGatheringProgress);
            console.log(`resources to drop: `, resourcesToDrop);

            // check if the resources to drop is greater than the resources left
            if (resourcesToDrop > resourcesLeft) {
                console.log(`(applyGatheringProgressBooster) Island ID ${islandId} does not have enough resources left to drop. Cannot apply booster.`);

                return {
                    status: Status.ERROR,
                    message: `(applyGatheringProgressBooster) Island ID ${islandId} does not have enough resources left to drop. Cannot apply booster.`
                }
            }

            // update the island's final gathering progress after moduloing it by 100
            islandUpdateOperations.$set['islandResourceStats.gatheringProgress'] = finalNonModuloGatheringProgress % 100;

            // deduct the boosters from the user's inventory, update `totalAmountConsumed` and `weeklyAmountConsumed`.
            userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = -boosters.length;
            userUpdateOperations.$inc[`inventory.items.${boosterIndex}.totalAmountConsumed`] = boosters.length;
            userUpdateOperations.$inc[`inventory.items.${boosterIndex}.weeklyAmountConsumed`] = boosters.length;

            // update the island's `lastUpdatedGatheringProgress` to the current time
            islandUpdateOperations.$set['islandResourceStats.lastUpdatedGatheringProgress'] = Math.floor(Date.now() / 1000);

            // execute the update operations
            await Promise.all([
                UserModel.updateOne({ twitterId }, userUpdateOperations),
                IslandModel.updateOne({ islandId }, islandUpdateOperations),
            ]);

            // we cannot use Promise.all to drop all resources at once as it will cause race issues with existing resource types.
            // we will need to loop through the resources to drop and drop them one by one
            for (let i = 0; i < resourcesToDrop; i++) {
                // drop a resource
                const { status, message, data } = await dropResource(islandId);

                console.log(`dropped a resource for Island ${islandId} x${i + 1}. resource: ${data.resource}`);

                if (status !== Status.SUCCESS) {
                    console.log(`(applyGatheringProgressBooster) Error from dropResource in loop: ${message}`);
                }
            }

            return {
                status: Status.SUCCESS,
                message: `(applyGatheringProgressBooster) Gathering Progress Booster applied successfully for Island ID ${islandId}.`,
                data: {
                    island,
                    gatheringProgressData: {
                        prevGatheringProgress: gatheringProgress,
                        finalGatheringProgress: finalNonModuloGatheringProgress % 100,
                        resourcesDropped: resourcesToDrop
                    },
                    boosters: {
                        type: firstBooster,
                        amount: boosters.length
                    }
                }
            }
        }
    } catch (err: any) {
        console.log(`(applyGatheringProgressBooster) Error: ${err.message}`);

        return {
            status: Status.ERROR,
            message: `(applyGatheringProgressBooster) Error: ${err.message}`
        }
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
                <IslandType>island.type,
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
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

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

            // check for versioning system. initialize the version field if undefined.
            // used to prevent race conditioning between `claimResources` and `dropResource`.
            if (typeof island.islandResourceStats?.version === 'undefined') {
                island.islandResourceStats.version = 0;
                await IslandModel.updateOne(
                    { islandId },
                    { $set: { 'islandResourceStats.version': 0 } }
                );
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
                        userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = chosenResource.amount;
                    } else {
                        userUpdateOperations.$push['inventory.resources'].$each.push({ ...chosenResourceData, amount: chosenResource.amount, origin: ExtendedResourceOrigin.NORMAL });
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
                            userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = resource.amount;
                        } else {
                            console.log(`(claimResources) New user found. Adding resource to inventory... Resource: ${JSON.stringify(resource, null, 2)}`);
                            /// CHECK THIS!!!!!
                            userUpdateOperations.$push['inventory.resources'].$each.push({ ...resource, origin: ExtendedResourceOrigin.NORMAL });
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
                                    userUpdateOperations.$push['inventory.resources'].$each.push({ ...resource, amount: amountToClaim, origin: ExtendedResourceOrigin.NORMAL });
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
                                    userUpdateOperations.$push['inventory.resources'].$each.push({ ...resource, origin: ExtendedResourceOrigin.NORMAL });
                                }
    
                                // increment the current weight by the total weight of this resource
                                currentWeight += totalWeight;
    
                                // since this essentially means we can claim all of this resource, we will pull this resource from the island's claimable resources.
                                islandResourcesPulled.push(resource.type);
    
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
    
                    returnMessage = `Unable to claim all resources due to max inventory weight. Automatically claimed partial resources for Island ID ${islandId}.`;
                }
            }
    
            // set the island's `lastClaimed` to the current time
            islandUpdateOperations.$set['islandResourceStats.lastClaimed'] = currentTime;
    
            console.log(`Island ${island.islandId} userUpdateOperations: `, userUpdateOperations);
            console.log(`Island ${island.islandId} islandUpdateOperations: `, islandUpdateOperations);

            // do set and inc first to prevent conflicting issues
            await UserModel.updateOne({ twitterId }, { 
                $set: Object.keys(userUpdateOperations.$set).length > 0 ? userUpdateOperations.$set : {},
                $inc: Object.keys(userUpdateOperations.$inc).length > 0 ? userUpdateOperations.$inc : {}
            });

            await UserModel.updateOne({ twitterId }, {
                $push: Object.keys(userUpdateOperations.$push).length > 0 ? userUpdateOperations.$push : {},
                $pull: Object.keys(userUpdateOperations.$pull).length > 0 ? userUpdateOperations.$pull : {}
            });

            // retry when island operations aren't successful
            while (attempt < maxRetries && !success) {
                // first check if we have any set/inc operations to perform
                if (Object.keys(islandUpdateOperations.$set).length > 0 || Object.keys(islandUpdateOperations.$inc).length > 0) {
                    const islandResultOne = await IslandModel.updateOne(
                        { islandId, 'islandResourceStats.version': island.islandResourceStats.version },
                        {
                            $set: Object.keys(islandUpdateOperations.$set).length > 0 ? islandUpdateOperations.$set : {},
                            $inc: Object.keys(islandUpdateOperations.$inc).length > 0 ? islandUpdateOperations.$inc : {}
                        }
                    );

                    if (islandResultOne.modifiedCount === 1) {
                        success = true;
                    }
                }

                // do push and pull operations
                if (Object.keys(islandUpdateOperations.$push).length > 0 || Object.keys(islandUpdateOperations.$pull).length > 0) {
                    const islandResultTwo = await IslandModel.updateOne(
                        { islandId, 'islandResourceStats.version': island.islandResourceStats.version },
                        {
                            $push: Object.keys(islandUpdateOperations.$push).length > 0 ? islandUpdateOperations.$push : {},
                            $pull: Object.keys(islandUpdateOperations.$pull).length > 0 ? islandUpdateOperations.$pull : {}
                        }
                    );

                    if (islandResultTwo.modifiedCount === 1) {
                        success = true;
                    }
                }

                if (success) {
                    // increment the version number as the last step
                    await IslandModel.updateOne({ islandId }, { $inc: { 'islandResourceStats.version': 1 } });

                    console.log(`(claimResources) Successfully claimed resources for Island ID ${islandId} after ${attempt} attempts.`);

                    return {
                        status: Status.SUCCESS,
                        message: returnMessage,
                        data: {
                            claimType: claimType,
                            claimedResources: claimType === 'manual' ? chosenResources : claimedResources,
                        }
                    };
                }
                attempt++;
            }
        } catch (err: any) {
            return {
                status: Status.ERROR,
                message: `(claimResources) Error: ${err.message}`
            }
        }

    return {
        status: Status.ERROR,
        message: `(claimResources) Unable to claim resources after ${maxRetries} attempts.`
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
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = xCookiesAfterTax;

            // check if the user's `xCookieData.extendedXCookieData` contains a source called ISLAND_CLAIMING. if not, push a new source.
            const islandClaimingIndex = (user.inventory.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.ISLAND_CLAIMING);

            if (islandClaimingIndex === -1) {
                userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                    xCookies: xCookiesAfterTax,
                    source: XCookieSource.ISLAND_CLAIMING,
                };
            } else {
                userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${islandClaimingIndex}.xCookies`] = xCookiesAfterTax;
            }

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
            message: `(claimXCookies) Claimed ${xCookies} xCookies from island ID ${islandId}.`,
            data: {
                islandId: islandId,
                xCookies: xCookies,
                crumbs: cookieCrumbs,
            }
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
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
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

            // initialize version field if undefined.
            // this is to prevent race conditioning between `claimResources` and `dropResource`.
            if (typeof island.islandResourceStats?.version === 'undefined') {
                island.islandResourceStats.version = 0;
                await IslandModel.updateOne(
                    { islandId },
                    { $set: { 'islandResourceStats.version': 0 } }
                );
            }

            // a list of resources to be added to the island's `claimableResources`.
            const claimableResourcesToAdd: ExtendedResource[] = [];
            // a list of resources to be added to the island's `resourcesGathered`.
            const gatheredResourcesToAdd: ExtendedResource[] = [];

            // check if the `resourcesLeft` is at least 1, if not, return an error.
            const baseResourceCap = island.islandResourceStats?.baseResourceCap as number;
            // check resourcesGathered (which only counts resources gathered with a 'NORMAL' origin. bonus resources are not counted towards the base resource cap.)
            const resourcesGathered: ExtendedResource[] = island.islandResourceStats?.resourcesGathered.filter((r: ExtendedResource) => r.origin === ExtendedResourceOrigin.NORMAL);
            // get the amount per `resourcesGathered` instance
            const resourcesGatheredAmount = resourcesGathered.reduce((acc, r) => acc + r.amount, 0);

            // for barren isles, check only for resources gathered that are seaweed instead of the entire length.
            // this is because for barren isles, there is a small chance to drop common resources that won't be counted towards the base resource cap.
            if (<IslandType>island.type === IslandType.BARREN) {
                const seaweedGathered = resourcesGathered.filter(r => r.type === BarrenResource.SEAWEED);
                if (baseResourceCap - seaweedGathered.length <= 0) {
                    console.log(`(dropResource) No resources left to drop for Island ${islandId}.`);

                    // if the island's `gatheringEnd` is still equal to 0 at this point, update it to the current time.
                    if (island.islandResourceStats?.gatheringEnd === 0) {
                        await IslandModel.updateOne({ islandId }, {
                            $set: {
                                'islandResourceStats.gatheringEnd': Math.floor(Date.now() / 1000)
                            }
                        });

                        return {
                            status: Status.ERROR,
                            message: `(dropResource) No resources left to drop. Updated gatheringEnd to current time.`
                        }
                    }

                    return {
                        status: Status.ERROR,
                        message: `(dropResource) No resources left to drop.`
                    }
                }
            }

            // for any other isles, check the entire length of resources gathered.
            if (baseResourceCap - resourcesGatheredAmount <= 0) {
                console.log(`(dropResource) No resources left to drop for Island ${islandId}.`);

                // if the island's `gatheringEnd` is still equal to 0 at this point, update it to the current time.
                if (island.islandResourceStats?.gatheringEnd === 0) {
                    await IslandModel.updateOne({ islandId }, {
                        $set: {
                            'islandResourceStats.gatheringEnd': Math.floor(Date.now() / 1000)
                        }
                    });

                    return {
                        status: Status.ERROR,
                        message: `(dropResource) No resources left to drop. Updated gatheringEnd to current time.`
                    }
                }

                return {
                    status: Status.ERROR,
                    message: `(dropResource) No resources left to drop.`
                }
            }

            // initialize $each on the $push operators for claimableResources and resourcesGathered
            if (!islandUpdateOperations.$push['islandResourceStats.claimableResources']) {
                islandUpdateOperations.$push['islandResourceStats.claimableResources'] = { $each: [] }
            }

            if (!islandUpdateOperations.$push['islandResourceStats.resourcesGathered']) {
                islandUpdateOperations.$push['islandResourceStats.resourcesGathered'] = { $each: [] }
            }

            // randomize the resource from the effective drop chances based on the island's type and level
            let resourceToDrop: Resource | undefined | null = null;

            // keep fetching a resource until it's not undefined (just in case it returns undefined at times)
            while (!resourceToDrop) {
                resourceToDrop = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);
            }

            // firstly check if `claimableResources` is empty.
            const claimableResources: ExtendedResource[] = island.islandResourceStats?.claimableResources;

            if (!claimableResources || claimableResources.length === 0) {
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
                    claimableResourcesToAdd.push(newResource);
                }
            }

            if (!resourcesGathered || resourcesGathered.length === 0) {
                // if empty, create a new resource and add it to the island's `resourcesGathered`
                const newResource: ExtendedResource = {
                    ...resourceToDrop,
                    origin: ExtendedResourceOrigin.NORMAL,
                    amount: 1
                }

                // add the new resource to the island's `resourcesGathered`
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

                    console.log(`(dropResource) works #4`);

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
                        gatheredResourcesToAdd.push(newResource);
                    }


                }
            }

            // only run the next logic if `dailyBonusResourcesGathered` hasn't exceeded the limit yet.
            if ((island.islandResourceStats?.dailyBonusResourcesGathered as number) < DAILY_BONUS_RESOURCES_GATHERABLE(<IslandType>island.type)) {
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
                    if ((bit.traits as BitTraitData[]).some(trait => trait.trait === BitTrait.LUCKY)) {
                        bonusResourceChance += 2.5;
                    }

                    if ((bit.traits as BitTraitData[]).some(trait => trait.trait === BitTrait.UNLUCKY)) {
                        bonusResourceChance -= 2.5;
                    }

                    if ((bit.traits as BitTraitData[]).some(trait => trait.trait === BitTrait.TRICKSTER)) {
                        bonusResourceChance += 5;
                    }

                    if ((bit.traits as BitTraitData[]).some(trait => trait.trait === BitTrait.HAPLESS)) {
                        bonusResourceChance -= 5;
                    }
                }

                console.log(`Island ${island.islandId} bonusResourceChance: ${bonusResourceChance}%`);

                // only if bonus resource chance is above 0 will we proceed to check if we can drop a bonus resource.
                if (bonusResourceChance > 0) {
                    // roll a dice between 1-100
                    const rand = Math.random() * 100 + 1;

                    if (rand <= bonusResourceChance) {
                        console.log(`(dropResource) rand is below bonusResourceChance. dropping bonus resource!`);
                        // randomize a resource based on the island's resource drop chances
                        let bonusResource: Resource | undefined | null = null;

                        // keep fetching a resource until it's not undefined (just in case it returns undefined at times)
                        while (!bonusResource) {
                            bonusResource = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);
                        }

                        console.log(`(dropResource) Island ${island.islandId} has dropped a bonus resource: ${bonusResource}`);

                        // if the resource inside the `claimableResources` is the same as the bonus resource, increment its amount.
                        // if not, push a new resource.
                        // check if the resource exists in the island's `claimableResources` OR the new `claimableResourcesToAdd`.
                        // `claimableResources` means that the resource is already in the island's claimable resources.
                        // `claimableResourcesToAdd` means that the resource isn't in the island's claimable resources, but the user has obtained it from the resource to drop.
                        const existingClaimableResourceToAddIndex = claimableResourcesToAdd.findIndex(r => r.type === bonusResource.type);
                        const existingClaimableResourceIndex = claimableResources.findIndex(r => r.type === bonusResource.type);

                        // if the resource exists in `claimableResources`, increment its amount via the $inc operator.
                        // if not, check if the resource exists in `claimableResourcesToAdd`. if it does, increment its amount directly in the array.
                        // if not, push a new resource to `claimableResourcesToAdd`.
                        if (existingClaimableResourceIndex !== -1) {
                            islandUpdateOperations.$inc[`islandResourceStats.claimableResources.${existingClaimableResourceIndex}.amount`] = 1;
                        } else if (existingClaimableResourceToAddIndex !== -1) {
                            claimableResourcesToAdd[existingClaimableResourceToAddIndex].amount += 1;
                        } else {
                            const newResource: ExtendedResource = {
                                ...bonusResource,
                                origin: ExtendedResourceOrigin.BONUS,
                                amount: 1
                            }

                            claimableResourcesToAdd.push(newResource);
                        }

                        // increment the island's `islandResourceStats.dailyBonusResourcesGathered` by 1.
                        islandUpdateOperations.$inc['islandResourceStats.dailyBonusResourcesGathered'] = 1;

                        // check if the bonus resource already exists in `resourcesGathered` or `gatheredResourcesToAdd`.
                        const existingGatheredResourceIndex = resourcesGathered.findIndex(r => r.type === bonusResource.type);
                        const existingGatheredResourceToAddIndex = gatheredResourcesToAdd.findIndex(r => r.type === bonusResource.type);

                        // if the bonus resource exists in `resourcesGathered`, increment its amount via the $inc operator.
                        // if not, check if the bonus resource exists in `gatheredResourcesToAdd`. if it does, increment its amount directly in the array.
                        // if not, push a new resource to `gatheredResourcesToAdd`.
                        if (existingGatheredResourceIndex !== -1) {
                            islandUpdateOperations.$inc[`islandResourceStats.resourcesGathered.${existingGatheredResourceIndex}.amount`] = 1;
                        } else if (existingGatheredResourceToAddIndex !== -1) {
                            gatheredResourcesToAdd[existingGatheredResourceToAddIndex].amount += 1;
                        } else {
                            const newResource: ExtendedResource = {
                                ...bonusResource,
                                origin: ExtendedResourceOrigin.BONUS,
                                amount: 1
                            }

                            gatheredResourcesToAdd.push(newResource);
                        }
                    }
                }
            }

            // add the resources to the island's `claimableResources` and `resourcesGathered`
            islandUpdateOperations.$push['islandResourceStats.claimableResources'].$each.push(...claimableResourcesToAdd);
            islandUpdateOperations.$push['islandResourceStats.resourcesGathered'].$each.push(...gatheredResourcesToAdd);

            // set and inc combined first to prevent conflicting issues
            const resultOne = await IslandModel.updateOne(
                { islandId, 'islandResourceStats.version': island.islandResourceStats.version },
                {
                    $set: Object.keys(islandUpdateOperations.$set).length > 0 ? islandUpdateOperations.$set : {},
                    $inc: Object.keys(islandUpdateOperations.$inc).length > 0 ? islandUpdateOperations.$inc : {}
                }
            );

            // do push and pull
            const resultTwo = await IslandModel.updateOne(
                { islandId, 'islandResourceStats.version': island.islandResourceStats.version },
                {
                    $pull: Object.keys(islandUpdateOperations.$pull).length > 0 ? islandUpdateOperations.$pull : {},
                    $push: Object.keys(islandUpdateOperations.$push).length > 0 ? islandUpdateOperations.$push : {}
                }
            )

            if (resultOne.modifiedCount === 1 || resultTwo.modifiedCount === 1) {
                success = true;

                // increment the version field in the island document, indicating an update
                await IslandModel.updateOne({ islandId }, { $inc: { 'islandResourceStats.version': 1 } });

                return {
                    status: Status.SUCCESS,
                    message: `(dropResource) Island ID ${islandId} has dropped a resource: ${resourceToDrop}.`,
                    data: {
                        resource: resourceToDrop
                    }
                }
            } else {
                attempt++;
            }
        } catch (err: any) {
            console.error(`(dropResource) Error: ${err.message}`);
            return {
                status: Status.ERROR,
                message: `(dropResource) Error: ${err.message}`
            };
        }
    }

    return {
        status: Status.ERROR,
        message: `(dropResource) Failed to drop resource after ${maxRetries} attempts.`
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

            console.log(`(randomizeResourceFromChances) resource is undefined: `, resource === undefined);
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
        const islandId = await redis.get('counter.islandId');

        // check if the islandId was already set in Redis
        if (!islandId) {
            // sort the island ids in descending order and get the first one
            const latestIsland = await IslandModel.findOne().sort({ islandId: -1 }).lean();

            // set the counter to the latest island
            await redis.set('counter.islandId', latestIsland?.islandId ?? 0);
        }

        // increment the island id counter
        const nextIslandId = await redis.incr('counter.islandId');

        return {
            status: Status.SUCCESS,
            message: `(getLatestIslandId) Latest island id fetched.`,
            data: {
                latestIslandId: nextIslandId ?? 0,
            },
        };
    } catch (err: any) {        
        return {
            status: Status.ERROR,
            message: `(getLatestIslandId) Error: ${err.message}`,
        };
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
 * Calculates the current gathering/earning rate of the island, based on various factors like number of bits, the bits' stats and island type among others.
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
    islandType: IslandType,
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
        // get the island rarity deviation multiplier
        const islandRarityDeviationMultiplier = ISLAND_RARITY_DEVIATION_MODIFIERS(islandType);

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

        return (sum * (1 - (reductionModifier * (n - 1)))) * modifierMultiplier * islandRarityDeviationMultiplier;
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

/**
 * Gets the island's tapping data. If the island has no tapping data in the database, 
 * it'll add a new islandTappingData instance starting from the 1st milestone
 */
export const getIslandTappingData = async (islandId: number): Promise<ReturnValue> => {
    try {
        const islandUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const island = await IslandModel.findOne({ islandId: islandId }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Island with ID ${islandId} not found.`
            };
        }

        const owner = await UserModel.findOne({ _id: island.owner }).lean();

        if (!owner) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Owner of the island with ID ${islandId} not found.`
            };
        }

        const { tapping } = owner.inGameData.mastery as PlayerMastery;

        // Check if islandTappingData is defined.
        // 1. If undefined, create new islandTappingData starting from the first tier & return the data
        // 2. else, return the data
        if (!island.islandTappingData) {
            const newTappingData: IslandTappingData = ISLAND_TAPPING_REQUIREMENT(1, tapping.level);

            // saves the newTappingData to this island
            islandUpdateOperations.$set['islandTappingData'] = newTappingData;

            await IslandModel.updateOne({ islandId }, islandUpdateOperations);

            return {
                status: Status.SUCCESS,
                message: `(getIslandTappingData) Returning tapping data for Island with ID ${islandId}.`,
                data: {
                    tappingData: newTappingData,
                }
            }
        } else {
            const tappingData: IslandTappingData = island.islandTappingData;

            return {
                status: Status.SUCCESS,
                message: `(getIslandTappingData) Returning tapping data for Island with ID ${islandId}.`,
                data: {
                    tappingData
                }
            }
        }

    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getIslandTappingData) Error: ${err.message}`
        }
    }
}

/**
 * Applies tapping action to an island and updates relevant user and island data.
 */
export const applyIslandTapping = async (twitterId: string, islandId: number, caressMeter: number, bonus: 'First' | 'Second'): Promise<ReturnValue> => {
    try {
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

        const leaderboardUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadLeaderboardUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const user = await UserModel.findOne({ twitterId }).lean();
        const island = await IslandModel.findOne({ islandId: islandId }).lean();
        const leaderboard = await LeaderboardModel.findOne().sort({ startTimestamp: -1 });
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Island with ID ${islandId} not found.`
            };
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) User not found.`
            };
        }

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Leaderboard not found.`
            }
        }

        if (!latestSquadLeaderboard) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Squad leaderboard not found.`
            }
        }

        // Destructure currentEnergy
        const { currentEnergy } = user.inGameData.energy as PlayerEnergy;
        // Destructure islandTappingData
        const { caressEnergyMeter, currentCaressEnergyMeter, currentMilestone, milestoneReward } = island.islandTappingData as IslandTappingData;
        const islandTappingLimit = ISLAND_TAPPING_MILESTONE_LIMIT(island.type as IslandType);
        const boosterPercentage = milestoneReward.boosterReward;
        let resourcesDropped: number = 0;

        // if caressMeter passed from FE isn't equal than current caressEnergyMeter return error.
        if (caressMeter < caressEnergyMeter) {
            console.log(
                `(applyIslandTapping) cannot apply island id ${islandId} tapping. caressMeter isn't valid.`
            );

            return {
                status: Status.ERROR,
                message: `(applyIslandTapping) cannot apply island id ${islandId} tapping. caressMeter isn't valid.`,
            };
        }

        // Calculate actual Energy Required from Math.ceil((Island caressEnergyMeter - Island currentCaressEnergyMeter) / BASE_CARESS_PER_TAPPING) * BASE_ENERGY_PER_TAPPING
        const energyRequired = Math.ceil((caressEnergyMeter - currentCaressEnergyMeter) / BASE_CARESS_PER_TAPPING) * BASE_ENERGY_PER_TAPPING;

        // Check user currentEnergy is >= energyRequired
        if (currentEnergy >= energyRequired) {
            const newCurrentEnergy = Math.max(currentEnergy - energyRequired, 0);
            // Save newCurrentEnergy to userUpdateOperations
            userUpdateOperations.$set['inGameData.energy.currentEnergy'] = newCurrentEnergy;
            console.log(`(applyIslandTapping) deduct ${user.twitterUsername} energy to ${newCurrentEnergy} energy`);
        } else {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) User doens't have enough energy to continue this action.`
            };
        }

        // Apply current milestone reward as gathering booster to the island.
        // get only resources that have an origin of `ExtendedResourceOrigin.NORMAL`
        const normalResourcesGathered = (island.islandResourceStats?.resourcesGathered as ExtendedResource[]).filter(resource => resource.origin === ExtendedResourceOrigin.NORMAL);
        // add the amount of resources per `normalResourcesGathered` instance
        const normalResourcesGatheredAmount = normalResourcesGathered.reduce((acc, resource) => acc + resource.amount, 0);
        const resourcesLeft = island.islandResourceStats?.baseResourceCap - normalResourcesGatheredAmount;

        console.log(`(applyIslandTapping), resources left for island ${island.islandId}: `, resourcesLeft);

        // if the booster is less than 100, get the current `gatheringProgress` of the island.
        if (boosterPercentage < 100) {
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;

            // if the gathering progress + booster percentage is greater than 100:
            // 1. drop a resource
            // 2. reset the gathering progress to the remaining overflow of %
            if (gatheringProgress + boosterPercentage > 100) {
                // check if a single resource can be dropped
                if (resourcesLeft === 0) {
                    console.log(`(applyIslandTapping) Island ID ${islandId} has no resources left to drop. Cannot apply booster.`);

                    return {
                        status: Status.ERROR,
                        message: `(applyIslandTapping) Island ID ${islandId} has no resources left to drop. Cannot apply booster.`
                    }
                }

                // calculate the remaining overflow of %
                const finalGatheringProgress = (gatheringProgress + boosterPercentage) - 100;

                // reset the gathering progress back to 0 + the remaining overflow of %
                islandUpdateOperations.$set['islandResourceStats.gatheringProgress'] = finalGatheringProgress;

                // drop a resource
                const { status, message } = await dropResource(islandId);

                if (status !== Status.SUCCESS) {
                    console.log(`(applyIslandTapping) Error from dropResource: ${message}`);

                    return {
                        status: Status.ERROR,
                        message: `(applyIslandTapping) Error: ${message}`
                    }
                }

                // Initialize Resource Dropped
                resourcesDropped = 1;
                // if not, just increment the gathering progress by the booster percentage and deduct the booster from the user's inventory.
            } else {
                islandUpdateOperations.$inc['islandResourceStats.gatheringProgress'] = boosterPercentage;
            }
            // if the booster is greater than 100,
            // 1. check the final non-modulo gathering progress. e.g. if the current gathering progress is 70 and a 500% booster is applied, the non-modulo progress will be 570%.
            // 2. this means that Math.floor(570/100) = 5 resources will be dropped, and the final gathering progress will be 70.
        } else {
            const gatheringProgress = island.islandResourceStats?.gatheringProgress;
            const finalNonModuloGatheringProgress = gatheringProgress + boosterPercentage;
            const resourcesToDrop = Math.floor(finalNonModuloGatheringProgress / 100);

            console.log(`(applyIslandTapping), gathering progress of island ${island.islandId}: `, gatheringProgress);
            console.log(`(applyIslandTapping), final non-modulo gathering progress of island ${island.islandId}: `, finalNonModuloGatheringProgress);
            console.log(`(applyIslandTapping), resources to drop: `, resourcesToDrop);

            // check if the resources to drop is greater than the resources left
            if (resourcesToDrop > resourcesLeft) {
                console.log(`(applyIslandTapping) Island ID ${islandId} does not have enough resources left to drop. Cannot apply booster.`);

                return {
                    status: Status.ERROR,
                    message: `(applyIslandTapping) Island ID ${islandId} does not have enough resources left to drop. Cannot apply booster.`
                }
            }

            // update the island's final gathering progress after moduloing it by 100
            islandUpdateOperations.$set['islandResourceStats.gatheringProgress'] = finalNonModuloGatheringProgress % 100;
            // update the island's `lastUpdatedGatheringProgress` to the current time
            islandUpdateOperations.$set['islandResourceStats.lastUpdatedGatheringProgress'] = Math.floor(Date.now() / 1000);

            // we cannot use Promise.all to drop all resources at once as it will cause race issues with existing resource types.
            // we will need to loop through the resources to drop and drop them one by one
            for (let i = 0; i < resourcesToDrop; i++) {
                // drop a resource
                const { status, message, data } = await dropResource(islandId);

                console.log(`dropped a resource for Island ${islandId} x${i + 1}. resource: ${data.resource}`);

                if (status !== Status.SUCCESS) {
                    console.log(`(applyIslandTapping) Error from dropResource in loop: ${message}`);
                }
            }

            // Initialize Resources Dropped
            resourcesDropped = resourcesToDrop;
        }

        // Apply Bonus milestone reward
        let bonusExp = 0;

        if (bonus === 'First') {
            bonusExp = milestoneReward.bonusReward.firstOptionReward;
        } else {
            const secondOptionReward = milestoneReward.bonusReward.secondOptionReward;

            if (secondOptionReward.additionalExp) {
                bonusExp = secondOptionReward.additionalExp;
            } else if (secondOptionReward.berryDrop) {
                const cookieIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.ISLAND_TAPPING);

                const berryDropAmount = secondOptionReward.berryDrop;

                console.log('Cookies Index: ', cookieIndex);
                // Update operations
                if (cookieIndex !== -1) {
                    // Increment existing cookie data
                    userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${cookieIndex}.xCookies`] = berryDropAmount;
                } else {
                    // Push new cookie data to the array
                    userUpdateOperations.$push[`inventory.xCookieData.extendedXCookieData`] = {
                        source: XCookieSource.ISLAND_TAPPING,
                        xCookies: berryDropAmount
                    };
                }

                // Always increment currentXCookies
                userUpdateOperations.$inc[`inventory.xCookieData.currentXCookies`] = berryDropAmount;
            } else if (secondOptionReward.pointDrop) {
                const userIndex = (leaderboard.userData as LeaderboardUserData[]).findIndex(userData => userData.userId === user._id);

                let additionalPoints = 0;

                const currentLevel = user.inGameData.level;

                // if not found, create a new entry
                if (userIndex === -1) {
                    // check if the user is eligible to level up to the next level
                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(secondOptionReward.pointDrop);

                    if (newLevel > currentLevel) {
                        // set the user's `inGameData.level` to the new level
                        userUpdateOperations.$set['inGameData.level'] = newLevel;

                        // add the additional points based on the rewards obtainable
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    leaderboardUpdateOperations.$push['userData'] = {
                        userId: user._id,
                        username: user.twitterUsername,
                        twitterProfilePicture: user.twitterProfilePicture,
                        pointsData: [
                            {
                                points: secondOptionReward.pointDrop,
                                source: LeaderboardPointsSource.ISLAND_TAPPING
                            },
                            {
                                points: additionalPoints,
                                source: LeaderboardPointsSource.LEVELLING_UP
                            }
                        ]
                    }
                    // if the user is found, increment the points
                } else {
                    // get the user's total leaderboard points
                    // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
                    // 1. LeaderboardPointsSource.LEVELLING_UP
                    const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                        if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                            return acc + pointsData.points;
                        }

                        return acc;
                    }, 0);

                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + secondOptionReward.pointDrop);

                    if (newLevel > currentLevel) {
                        userUpdateOperations.$set['inGameData.level'] = newLevel;
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    // get the source index for ISLAND_TAPPING
                    const sourceIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.ISLAND_TAPPING);
                    console.log('Points Index: ', sourceIndex);
                    if (sourceIndex !== -1) {
                        leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${sourceIndex}.points`] = secondOptionReward.pointDrop;
                    } else {
                        leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                            points: secondOptionReward.pointDrop,
                            source: LeaderboardPointsSource.ISLAND_TAPPING
                        }
                    }

                    if (additionalPoints > 0) {
                        const levellingUpIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

                        if (levellingUpIndex !== -1) {
                            leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levellingUpIndex}.points`] = additionalPoints;
                        } else {
                            leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                                points: additionalPoints,
                                source: LeaderboardPointsSource.LEVELLING_UP
                            }
                        }
                    }
                }

                // if the user also has a squad, add the points to the squad's total points
                if (user.inGameData.squadId !== null) {
                    // get the squad
                    const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

                    if (!squad) {
                        return {
                            status: Status.ERROR,
                            message: `(getIslandTappingData) Squad not found.`
                        }
                    }

                    // add only the reward.amount (i.e. points) to the squad's total points
                    squadUpdateOperations.$inc['totalSquadPoints'] = secondOptionReward.pointDrop;

                    // check if the squad exists in the squad leaderboard's `pointsData`. if not, we create a new instance.
                    const squadIndex = latestSquadLeaderboard.pointsData.findIndex(data => data.squadId === squad._id);

                    if (squadIndex === -1) {
                        squadLeaderboardUpdateOperations.$push['pointsData'] = {
                            squadId: squad._id,
                            squadName: squad.name,
                            memberPoints: [
                                {
                                    userId: user._id,
                                    username: user.twitterUsername,
                                    points: secondOptionReward.pointDrop
                                }
                            ]
                        }
                    } else {
                        // otherwise, we increment the points for the user in the squad
                        const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(member => member.userId === user._id);

                        if (userIndex !== -1) {
                            squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = secondOptionReward.pointDrop;
                        } else {
                            squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                                userId: user._id,
                                username: user.twitterUsername,
                                points: secondOptionReward.pointDrop
                            }
                        }
                    }
                }
            } else {
                return {
                    status: Status.ERROR,
                    message: `(getIslandTappingData) second option milestone reward is undefined.`
                };
            }
        }

        // Add user tapping exp mastery
        const { tapping } = user.inGameData.mastery as PlayerMastery;
        const newTotalExp = tapping.totalExp + milestoneReward.masteryExpReward + bonusExp;
        userUpdateOperations.$set['inGameData.mastery.tapping.totalExp'] = newTotalExp;

        // Compare currentTappingLevel with newTappingLevel
        const currentTappingLevel = tapping.level;
        const newTappingLevel = TAPPING_MASTERY_LEVEL(newTotalExp);
        if (newTappingLevel > currentTappingLevel) {
            userUpdateOperations.$set['inGameData.mastery.tapping.level'] = newTappingLevel;
        }

        let returnMessage = '';

        // Increase the tier Milestone to the next tier/rank. If milestone reaching the max tier, return error.
        if (currentMilestone <= islandTappingLimit) {
            const nextTappingData: IslandTappingData = ISLAND_TAPPING_REQUIREMENT(currentMilestone + 1, tapping.level);

            // saves the nextTappingData to this island database
            islandUpdateOperations.$set['islandTappingData'] = nextTappingData;

            returnMessage = `(getIslandTappingData) Applying tapping data for Island with ID ${islandId}. Increasing to tier ${nextTappingData.currentMilestone}`;
        } else {
            returnMessage = `(getIslandTappingData) Tapping milestone already reached the latest tier.`;
        }

        // divide into $set, $inc and then $push $pull
        await Promise.all([
            UserModel.updateOne({ _id: user._id }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            }),

            IslandModel.updateOne({ islandId: island.islandId }, {
                $set: islandUpdateOperations.$set,
                $inc: islandUpdateOperations.$inc,
            }),

            LeaderboardModel.updateOne({ _id: leaderboard._id }, {
                $set: leaderboardUpdateOperations.$set,
                $inc: leaderboardUpdateOperations.$inc,
            }),

            SquadModel.updateOne({ _id: user.inGameData.squadId }, {
                $set: squadUpdateOperations.$set,
                $inc: squadUpdateOperations.$inc,
            }),

            SquadLeaderboardModel.updateOne({ week: latestSquadLeaderboard.week }, {
                $set: squadLeaderboardUpdateOperations.$set,
                $inc: squadLeaderboardUpdateOperations.$inc
            })
        ]);

        await Promise.all([
            UserModel.updateOne({ _id: user._id }, {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull,
            }),

            IslandModel.updateOne({ islandId: island.islandId }, {
                $push: islandUpdateOperations.$push,
                $pull: islandUpdateOperations.$pull,
            }),

            LeaderboardModel.updateOne({ _id: leaderboard._id }, {
                $push: leaderboardUpdateOperations.$push,
                $pull: leaderboardUpdateOperations.$pull,
            }),

            SquadModel.updateOne({ _id: user.inGameData.squadId }, {
                $push: squadUpdateOperations.$push,
                $pull: squadUpdateOperations.$pull,
            }),

            SquadLeaderboardModel.updateOne({ week: latestSquadLeaderboard.week }, {
                $push: squadLeaderboardUpdateOperations.$push,
                $pull: squadLeaderboardUpdateOperations.$pull,
            })
        ]);

        // check if the user update operations included a level up
        const setUserLevel = userUpdateOperations.$set['inGameData.level'];

        // if the user just reached level 3 or 4, give 5 xCookies to the referrer
        if (setUserLevel && (setUserLevel === 3 || setUserLevel === 4)) {
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // add the rewards to the referrer's `referralData.claimableReferralRewards.xCookies`.
                const referrer = await UserModel.findOne({ _id: referrerId }).lean();

                // only continue if the referrer exists
                if (referrer) {
                    await UserModel.updateOne({ _id: referrerId }, {
                        $inc: {
                            'referralData.claimableReferralRewards.xCookies': 5
                        }
                    })
                }
            }
        }

        // if it included a level, check if it's set to 5.
        // if it is, check if the user has a referrer.
        // the referrer will then have this user's `hasReachedLevel4` set to true.
        // NOTE: naming is `hasReachedLevel4`, but users are required to be level 5 anyway. this is temporary.
        if (setUserLevel && setUserLevel === 5) {
            // check if the user has a referrer
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // update the referrer's referred users data where applicable
                const { status, message } = await updateReferredUsersData(referrerId, user._id);

                if (status === Status.ERROR) {
                    return {
                        status,
                        message: `(claimDailyRewards) Err from updateReferredUsersData: ${message}`,
                    };
                }
            }
        }

        return {
            status: Status.SUCCESS,
            message: returnMessage,
            data: {
                islandId: island.islandId,
                islandType: island.type,
                energyConsumed: Math.ceil(caressEnergyMeter / BASE_CARESS_PER_TAPPING) * BASE_ENERGY_PER_TAPPING,
                currentMilestone: currentMilestone,
                currentReward: milestoneReward,
                chosenBonus: bonus === 'First' ?
                    milestoneReward.bonusReward.firstOptionReward :
                    milestoneReward.bonusReward.secondOptionReward,
                resourcesDropped: resourcesDropped,
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getIslandTappingData) Error: ${err.message}`
        }
    }
};

export const rerollBonusMilestoneReward = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
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

        const user = await UserModel.findOne({ twitterId }).lean();
        const island = await IslandModel.findOne({ islandId: islandId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(rerollBonusMilestoneReward) User not found.`
            };
        }

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(rerollBonusMilestoneReward) Island with ID ${islandId} not found.`
            };
        }

        // Destructure necessary data
        const { tapping } = user.inGameData.mastery as PlayerMastery;
        const { currentMilestone } = island.islandTappingData as IslandTappingData;

        // Check if user reroll count is > 0
        if (tapping.rerollCount <= 0) {
            return {
                status: Status.ERROR,
                message: `(rerollBonusMilestoneReward) The user's reroll count has been used up.`
            };
        }

        const newMilestoneBonusReward = ISLAND_TAPPING_MILESTONE_BONUS_REWARD(currentMilestone, tapping.level);
        const newRerollCount = Math.max(tapping.rerollCount - 1, 0);

        // Set the newMilestoneBonusReward & newRerollCount
        userUpdateOperations.$set['inGameData.mastery.tapping.rerollCount'] = newRerollCount;
        islandUpdateOperations.$set['islandTappingData.milestoneReward.bonusReward'] = newMilestoneBonusReward;

        // update database for UserModel & IslandModel data
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            IslandModel.updateOne({ islandId }, islandUpdateOperations),
        ]);

        return {
            status: Status.SUCCESS,
            message: `(rerollBonusMilestoneReward) Successfully updated bonus milestone reward.`,
            data: {
                islandId: island.islandId,
                IslandType: island.type,
                currentMilestone: currentMilestone,
                tappingLevel: tapping.level,
                newMilestoneBonusReward: newMilestoneBonusReward,
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getIslandTappingData) Error: ${err.message}`
        }
    }
}

/**
 * Resets the `currentMilestone` field of all islands with a milestone greater than 1
 * to the value associated with milestoneTier 1.
 * Also resets the `rerollCount` field for all users with tapping mastery data.
 * Called by a scheduler every day at 23:59 UTC.
 */
export const resetDailyIslandTappingMilestone = async (): Promise<void> => {
    try {
        // Find all available islands with currentMilestone greater than 1.
        const islands = await IslandModel.find({ 'islandTappingData.currentMilestone': { $gt: 1 } }).lean();

        if (islands.length === 0) {
            console.error(`(resetDailyIslandTappingMilestone) No islands found.`);
            return;
        }

        // Retrieve the owner and owner's tapping level for each island
        const bulkWriteOps = await Promise.all(islands.map(async (island) => {
            // Find the user who owns the island
            const owner = await UserModel.findOne({ _id: island.owner }).lean();

            if (!owner) {
                console.error(`(resetDailyIslandTappingMilestone) Owner not found for island ${island.islandId}`);
                return null; // Skip this operation if the owner is not found
            }

            const { tapping } = owner.inGameData.mastery as PlayerMastery; // Assuming owner's tapping level is stored in 'tappingLevel'

            return {
                updateOne: {
                    filter: { islandId: island.islandId },
                    update: {
                        $set: {
                            'islandTappingData': ISLAND_TAPPING_REQUIREMENT(1, tapping.level) // Use the owner's tapping level
                        }
                    }
                }
            };
        }));

        // Remove null entries from the bulkWriteOps array
        const validBulkWriteOps = bulkWriteOps.filter(op => op !== null);

        if (validBulkWriteOps.length > 0) {
            await IslandModel.bulkWrite(validBulkWriteOps);
        } else {
            console.error(`(resetDailyIslandTappingMilestone) No valid operations to execute.`);
        }
    } catch (err: any) {
        console.error(`(resetDailyIslandTappingMilestone) Error: ${err.message}`);
    }
};