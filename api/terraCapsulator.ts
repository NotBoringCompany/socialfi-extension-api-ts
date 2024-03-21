import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { UserSchema } from '../schemas/User';
import { addIslandToDatabase, getLatestIslandId, randomizeBaseResourceCap } from './island';
import { RANDOMIZE_TYPE_FROM_CAPSULATOR } from '../utils/constants/terraCapsulator';
import { Island } from '../models/island';
import { ObtainMethod } from '../models/obtainMethod';
import { UserModel } from '../utils/constants/db';

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
        userUpdateOperations.$push['inventory.islands'] = island.islandId;

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
        const islandType = RANDOMIZE_TYPE_FROM_CAPSULATOR();

        // randomize the base resource cap
        const baseResourceCap = randomizeBaseResourceCap(islandType);


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
            islandResourceStats: {
                baseResourceCap,
                resourcesGathered: [],
                claimableResources: [],
                gatheringStart: 0,
                gatheringEnd: 0,
                lastClaimed: 0,
                gatheringProgress: 0
            },
            islandEarningStats: {
                totalXCookiesSpent: 0,
                totalXCookiesEarned: 0,
                claimableXCookies: 0,
                earningStart: 0,
                earningEnd: 0,
                lastClaimed: 0,
            },
            islandStatsModifiers: {
                resourceCapModifiers: [],
                gatheringRateModifiers: [],
                earningRateModifiers: []
            }
        }

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