import { ReturnValue, Status } from '../utils/retVal';
import { addIslandToDatabase, getLatestIslandId, randomizeBaseResourceCap } from './island';
import { randomizeTypeFromCapsulator } from '../utils/constants/terraCapsulator';
import { Island, IslandStatsModifiers } from '../models/island';
import { ObtainMethod } from '../models/obtainMethod';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { GET_TOTAL_COOKIE_CRUMBS_EARNABLE, GET_TOTAL_X_COOKIES_EARNABLE, randomizeIslandTraits } from '../utils/constants/island';
import { BitTrait, BitTraitData } from '../models/bit';
import { Modifier } from '../models/modifier';

/**
 * (User) Consumes a Terra Capsulator to obtain an island.
 */
export const consumeTerraCapsulator = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(consumeTerraCapsulator) User not found.`
            }
        }

        // check if the user has at least 1 Terra Capsulator to consume
        if (user.inventory?.totalTerraCapsulators < 1) {
            return {
                status: Status.ERROR,
                message: `(consumeTerraCapsulator) Not enough Terra Capsulators to consume.`
            }
        }

        // consume the Terra Capsulator
        userUpdateOperations.$inc['inventory.totalTerraCapsulators'] = -1;

        // call `summonIsland` to summon an Island
        const { status: summonIslandStatus, message: summonIslandMessage, data: summonIslandData } = await summonIsland(user._id);

        if (summonIslandStatus !== Status.SUCCESS) {
            return {
                status: summonIslandStatus,
                message: `(consumeTerraCapsulator) Error from summonIsland: ${summonIslandMessage}`
            }
        }

        const island = summonIslandData?.island as Island;

        // save the Island to the database
        const { status: addIslandStatus, message: addIslandMessage } = await addIslandToDatabase(island);

        if (addIslandStatus !== Status.SUCCESS) {
            return {
                status: addIslandStatus,
                message: `(consumeTerraCapsulator) Error from addIslandToDatabase: ${addIslandMessage}`
            }
        }

        // add the island ID to the user's inventory
        userUpdateOperations.$push['inventory.islandIds'] = island.islandId;

        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(consumeTerraCapsulator) Terra Capsulator consumed and Island obtained.`,
            data: {
                island
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeTerraCapsulator) Error: ${err.message}`
        }
    }
}

/**
 * Summons an island obtained from a Terra Capsulator.
 */
export const summonIsland = async (
    owner: string,
): Promise<ReturnValue> => {
    try {
        // get the latest island id from the database
        const { status, message, data } = await getLatestIslandId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(summonIsland) Error from getLatestIslandId: ${message}`
            }
        }

        const latestIslandId = data?.latestIslandId as number;

        // get the island type based on the probability of obtaining it
        const islandType = randomizeTypeFromCapsulator();

        // randomize the base resource cap
        const baseResourceCap = randomizeBaseResourceCap(islandType);

        // randomize the 5 island traits
        const traits = randomizeIslandTraits();

        // get total xCookies earnable based on rarity of island
        const totalXCookiesEarnable = GET_TOTAL_X_COOKIES_EARNABLE(islandType);

        // get total cookie crumbs earnable based on rarity
        const totalCookieCrumbsEarnable = GET_TOTAL_COOKIE_CRUMBS_EARNABLE(islandType);

        // get the user's owned bit ids
        const user = await UserModel.findOne({ _id: owner }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(summonIsland) User not found.`
            }
        }

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
                    origin: `Bit ID #${bit.bitId}'s Trait: ${
                        bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 'Influential' :
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
                    origin: `Bit ID #${bit.bitId}'s Trait: ${
                        bitTraits.some(traitData => traitData.trait === BitTrait.INFLUENTIAL) ? 'Influential' :
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

        // summon and return the island. DOESN'T SAVE TO DATABASE YET.
        const island: Island = {
            islandId: latestIslandId + 1,
            type: islandType,
            owner,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.TERRA_CAPSULATOR,
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
                gatheringProgress: 0
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
                earningStart: 0,
                crumbsEarningStart: 0,
                earningEnd: 0,
                crumbsEarningEnd: 0,
                lastClaimed: 0,
                crumbsLastClaimed: 0
            },
            islandStatsModifiers
        }

        console.log(`island stats modifiers for island #${island.islandId}: `, islandStatsModifiers);

        return {
            status: Status.SUCCESS,
            message: `(summonIsland) Island randomized and summoned.`,
            data: {
                island
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(summonIsland) Error: ${err.message}`
        }
    }
}