import { Bit } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { IslandModel, UserModel } from '../utils/constants/db';
import { Modifier } from '../models/modifier';

/**
 * (User) Consumes a Bit Orb to obtain a Bit.
 */
export const consumeBitOrb = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const islandUpdateOperations: Array<{
            islandId: number,
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
                message: `(consumeBitOrb) User not found.`
            }
        }

        // check if the user has at least 1 Bit Orb to consume
        if (user.inventory?.totalBitOrbs < 1) {
            return {
                status: Status.ERROR,
                message: `(consumeBitOrb) Not enough Bit Orbs to consume.`
            }
        }

        // consume the Bit Orb
        userUpdateOperations.$inc['inventory.totalBitOrbs'] = -1;

        // call `summonBit` to summon a Bit
        const { status: summonBitStatus, message: summonBitMessage, data: summonBitData } = await summonBit(user._id);

        if (summonBitStatus !== Status.SUCCESS) {
            return {
                status: summonBitStatus,
                message: `(consumeBitOrb) Error from summonBit: ${summonBitMessage}`
            }
        }

        const bit = summonBitData?.bit as Bit;

        // save the Bit to the database
        const { status: addBitStatus, message: addBitMessage } = await addBitToDatabase(bit);

        if (addBitStatus !== Status.SUCCESS) {
            return {
                status: addBitStatus,
                message: `(consumeBitOrb) Error from addBitToDatabase: ${addBitMessage}`
            }
        }

        // get the user's list of owned islands
        const islands = user.inventory?.islandIds as number[];

        // check if the bit has the infuential or antagonistic trait
        const hasInfluentialTrait = bit.traits.some(trait => trait === 'Influential');
        const hasAntagonisticTrait = bit.traits.some(trait => trait === 'Antagonistic');

        // if bit has influential trait, add 1% working rate to all islands owned by the user
        if (hasInfluentialTrait) {
            // for each island, add 1% working rate (gathering + earning rate) to the island's modifiers
            // which will be the island's `islandStatsModifiers` field
            for (const islandId of islands) {
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Influential`,
                    value: 1.01
                }

                const earningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Influential`,
                    value: 1.01
                }

                // add the new modifier to the island's `islandStatsModifiers` field
                islandUpdateOperations.push({
                    islandId,
                    updateOperations: {
                        $push: {
                            'islandStatsModifiers.gatheringRateModifiers': gatheringRateModifier,
                            'islandStatsModifiers.earningRateModifiers': earningRateModifier
                        },
                        $set: {},
                        $pull: {},
                        $inc: {}
                    }
                });
            }
        }

        // if the bit has the antagonistic trait, reduce 1% working rate to all islands owned by the user
        if (hasAntagonisticTrait) {
            // for each island, reduce 1% working rate (gathering + earning rate) to the island's modifiers
            // which will be the island's `islandStatsModifiers` field
            for (const islandId of islands) {
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99
                }

                const earningRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99
                }

                // add the new modifier to the island's `islandStatsModifiers` field
                islandUpdateOperations.push({
                    islandId,
                    updateOperations: {
                        $push: {
                            'islandStatsModifiers.gatheringRateModifiers': gatheringRateModifier,
                            'islandStatsModifiers.earningRateModifiers': earningRateModifier
                        },
                        $set: {},
                        $pull: {},
                        $inc: {}
                    }
                });
            }
        }

        // add the bit ID to the user's inventory
        userUpdateOperations.$push['inventory.bitIds'] = bit.bitId;

        // create an array of promises for updating the islands
        const islandUpdatePromises = islandUpdateOperations.map(async op => {
            return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
        });

        // execute the update operations
        await Promise.all([
            await UserModel.updateOne({ twitterId }, userUpdateOperations),
            ...islandUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(consumeBitOrb) Bit Orb consumed and Bit obtained.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeBitOrb) Error: ${err.message}`
        }
    }
}

/**
 * Summons a Bit obtained from a Bit Orb.
 */
export const summonBit = async (
    owner: string,
): Promise<ReturnValue> => {
    try {
        // get the latest bit id from the database
        const { status, message, data } = await getLatestBitId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(randomizeBit) Error from getLatestBitId: ${message}`
            }
        }
        const latestBitId = data?.latestBitId as number;

        // get the Bit's rarity based on the probability of obtaining it
        const rarity = RANDOMIZE_RARITY_FROM_ORB();

        // randomize the gender 
        const gender = RANDOMIZE_GENDER();

        // randomize the traits and the resulting stat modifiers for the bit
        const traits = randomizeBitTraits(rarity);
        const bitStatsModifiers = getBitStatsModifiersFromTraits(traits);

        // summon and return the Bit. DOESN'T SAVE TO DATABASE YET.
        const bit: Bit = {
            bitId: latestBitId + 1,
            rarity,
            gender,
            premium: true,
            owner,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.BIT_ORB,
            placedIslandId: 0,
            lastRelocationTimestamp: 0,
            currentFarmingLevel: 1,
            farmingStats: randomizeFarmingStats(rarity),
            traits,
            bitStatsModifiers
        }

        return {
            status: Status.SUCCESS,
            message: `(summonBit) Bit randomized and summoned.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(summonBit) Error: ${err.message}`
        }

    }
}