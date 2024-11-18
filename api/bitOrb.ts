import { Bit, BitTraitEnum, BitType } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits, randomizeBitType } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { IslandModel, UserModel } from '../utils/constants/db';
import { Modifier } from '../models/modifier';
import { BitOrbType, Item } from '../models/item';

/**
 * (User) Consumes a Bit Orb to obtain a Bit.
 */
export const consumeBitOrb = async (twitterId: string, bitOrbType: BitOrbType): Promise<ReturnValue> => {
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

        // check if the user has at least 1 of the bit orb type to consume
        const bitOrbAmount = (user.inventory?.items as Item[]).find(item => item.type === bitOrbType)?.amount;

        if (!bitOrbAmount || bitOrbAmount < 1) {
            return {
                status: Status.ERROR,
                message: `(consumeBitOrb) Not enough Bit Orbs to consume.`
            }
        }

        // consume the Bit Orb
        // decrement the bit orb count by 1 and increase the `totalAmountConsumed` and `weeklyAmountConsumed` by 1
        const bitOrbIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === bitOrbType);

        userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.totalAmountConsumed`] = 1;
        userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.weeklyAmountConsumed`] = 1;
        userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.amount`] = -1;

        // call `summonBit` to summon a Bit
        const { status: summonBitStatus, message: summonBitMessage, data: summonBitData } = await summonBit(user._id, bitOrbType);

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

        // check if the bit has the infuential, antagonistic, famous or mannerless traits
        const hasInfluentialTrait = bit.traits.some(trait => trait.trait === BitTraitEnum.INFLUENTIAL);
        const hasAntagonisticTrait = bit.traits.some(trait => trait.trait === BitTraitEnum.ANTAGONISTIC);
        const hasFamousTrait = bit.traits.some(trait => trait.trait === BitTraitEnum.FAMOUS);
        const hasMannerlessTrait = bit.traits.some(trait => trait.trait === BitTraitEnum.MANNERLESS);

        const gatheringRateModifiers: Modifier[] = [];

        if (hasInfluentialTrait) {
            gatheringRateModifiers.push({
                origin: `Bit ID #${bit.bitId}'s Trait: Influential`,
                value: 1.01
            });
        }

        if (hasAntagonisticTrait) {
            gatheringRateModifiers.push({
                origin: `Bit ID #${bit.bitId}'s Trait: Antagonistic`,
                value: 0.99
            });
        }

        if (hasFamousTrait) {
            gatheringRateModifiers.push({
                origin: `Bit ID #${bit.bitId}'s Trait: Famous`,
                value: 1.005
            });
        }

        if (hasMannerlessTrait) {
            gatheringRateModifiers.push({
                origin: `Bit ID #${bit.bitId}'s Trait: Mannerless`,
                value: 0.995
            });
        }

        for (const islandId of islands) {
            islandUpdateOperations.push({
                islandId,
                updateOperations: {
                    $push: {
                        'islandStatsModifiers.gatheringRateModifiers': { $each: gatheringRateModifiers },
                    },
                    $set: {},
                    $pull: {},
                    $inc: {}
                }
            });
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
 * Summons a Bit obtained from a Bit Orb (I).
 */
export const summonBit = async (
    owner: string,
    bitOrbType: BitOrbType
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
        const rarity = RANDOMIZE_RARITY_FROM_ORB(bitOrbType);

        // randomize the gender 
        const gender = RANDOMIZE_GENDER();

        // randomize the traits and the resulting stat modifiers for the bit
        const traits = randomizeBitTraits(rarity);
        const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map(trait => trait.trait));

        // summon and return the Bit. DOESN'T SAVE TO DATABASE YET.
        const bit: Bit = {
            bitId: latestBitId + 1,
            bitType: randomizeBitType(),
            bitNameData: {
                name: `Bit #${latestBitId + 1}`,
                lastChanged: 0
            },
            rarity,
            gender,
            ownerData: {
                currentOwnerId: owner,
                originalOwnerId: owner,
                currentOwnerAddress: null,
                originalOwnerAddress: null
            },
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.BIT_ORB_I,
            placedIslandId: 0,
            lastRelocationTimestamp: 0,
            currentFarmingLevel: 1,
            farmingStats: randomizeFarmingStats(rarity),
            traits,
            equippedCosmetics: {
                head: { cosmeticId: null, cosmeticName: null, equippedAt: 0 },
                body: { cosmeticId: null, cosmeticName: null, equippedAt: 0 },
                arms: { cosmeticId: null, cosmeticName: null, equippedAt: 0 },
                back: { cosmeticId: null, cosmeticName: null, equippedAt: 0 },
            },
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