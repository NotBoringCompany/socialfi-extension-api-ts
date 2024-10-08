import { ReturnValue, Status } from '../utils/retVal';
import { addIslandToDatabase, getLatestIslandId, randomizeBaseResourceCap } from './island';
import { randomizeTypeFromCapsulator } from '../utils/constants/terraCapsulator';
import { Island, IslandStatsModifiers, IslandType } from '../models/island';
import { ObtainMethod } from '../models/obtainMethod';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { DEFAULT_ISLAND_TYPE, GET_TOTAL_COOKIE_CRUMBS_EARNABLE, GET_TOTAL_X_COOKIES_EARNABLE, ISLAND_TAPPING_REQUIREMENT, randomizeIslandTraits } from '../utils/constants/island';
import { BitTrait, BitTraitData } from '../models/bit';
import { Modifier } from '../models/modifier';
import { Item, TerraCapsulatorType } from '../models/item';
import { PlayerMastery, User } from '../models/user';

/**
 * (User) Consumes a Terra Capsulator to obtain an island.
 */
export const consumeTerraCapsulator = async (type: TerraCapsulatorType, twitterId: string): Promise<ReturnValue> => {
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

        // check if the user has at least 1 of this Terra Capsulator type to consume
        const terraCapsulatorAmount = (user.inventory?.items as Item[]).find(i => i.type === type)?.amount;
        
        if (!terraCapsulatorAmount || terraCapsulatorAmount < 1) {
            return {
                status: Status.ERROR,
                message: `(consumeTerraCapsulator) Not enough Terra Capsulators to consume.`
            }
        }

        // consume the Terra Capsulator
        // decrement the Terra Capsulator count by 1 and increase the `totalAmountConsumed` and `weeklyAmountConsumed` by 1
        const terraCapsulatorIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === type);

        userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.totalAmountConsumed`] = 1;
        userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.weeklyAmountConsumed`] = 1;
        userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.amount`] = -1;

        // call `summonIsland` to summon an Island
        const { status: summonIslandStatus, message: summonIslandMessage, data: summonIslandData } = await summonIsland(type, user._id);

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
    terraCapsulatorType: TerraCapsulatorType | IslandType,
    owner: string,
): Promise<ReturnValue<{ island: Island }>> => {
    try {
        const isIsland = Object.values(IslandType).includes(terraCapsulatorType as IslandType);

        // get the latest island id from the database
        const { status, message, data } = await getLatestIslandId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(summonIsland) Error from getLatestIslandId: ${message}`
            }
        }

        // get the user's owned bit ids
        const user = await UserModel.findOne({ _id: owner }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(summonIsland) User not found.`
            }
        }

        const { tapping } = user.inGameData.mastery as PlayerMastery;

        const latestIslandId = data?.latestIslandId as number;

        const islandType = isIsland ? (terraCapsulatorType as IslandType) : randomizeTypeFromCapsulator(terraCapsulatorType as TerraCapsulatorType);

        // randomize the base resource cap
        const baseResourceCap = randomizeBaseResourceCap(islandType);

        // randomize the 5 island traits
        const traits = randomizeIslandTraits();

        // get total xCookies earnable based on rarity
        const totalXCookiesEarnable = GET_TOTAL_X_COOKIES_EARNABLE(isIsland ? TerraCapsulatorType.TERRA_CAPSULATOR_I : (terraCapsulatorType as TerraCapsulatorType), islandType);

        // get total cookie crumbs earnable based on rarity
        const totalCookieCrumbsEarnable = GET_TOTAL_COOKIE_CRUMBS_EARNABLE(islandType);

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
                gatheringProgress: 0,
                lastUpdatedGatheringProgress: Math.floor(Date.now() / 1000),
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
            islandStatsModifiers,
            islandTappingData: ISLAND_TAPPING_REQUIREMENT(1, tapping.level),
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