import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandStatsModifiers, IslandTappingData, IslandTrait, IslandType, RateType, ResourceDropChance, ResourceDropChanceDiff } from '../models/island';
import { BARREN_ISLE_COMMON_DROP_CHANCE, BASE_CARESS_PER_TAPPING, BASE_ENERGY_PER_TAPPING, BIT_PLACEMENT_CAP, BIT_PLACEMENT_MIN_RARITY_REQUIREMENT, DAILY_BONUS_RESOURCES_GATHERABLE, DEFAULT_RESOURCE_CAP, GATHERING_RATE_REDUCTION_MODIFIER, ISLAND_QUEUE, ISLAND_RARITY_DEVIATION_MODIFIERS, ISLAND_TAPPING_MILESTONE_BONUS_REWARD, ISLAND_TAPPING_MILESTONE_LIMIT, ISLAND_TAPPING_REQUIREMENT, MAX_ISLAND_LEVEL, RARITY_DEVIATION_REDUCTIONS, RESOURCES_CLAIM_COOLDOWN, RESOURCE_DROP_CHANCES, RESOURCE_DROP_CHANCES_LEVEL_DIFF, TOTAL_ACTIVE_ISLANDS_ALLOWED, X_COOKIE_CLAIM_COOLDOWN, randomizeIslandTraits } from '../utils/constants/island';
import { calcBitGatheringRate, getBits } from './bit';
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, Resource, ResourceLine, ResourceRarity, ResourceRarityNumeric, ResourceType, SimplifiedResource } from '../models/resource';
import { UserSchema } from '../schemas/User';
import { Modifier } from '../models/modifier';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitRarity, BitRarityNumeric, BitStatsModifiers, BitTraitEnum, BitTraitData, BitType } from '../models/bit';
import { generateHashSalt, generateObjectId, generateOpHash } from '../utils/crypto';
import { BitModel, ConsumedSynthesizingItemModel, IslandModel, SquadLeaderboardModel, SquadModel, UserLeaderboardDataModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';
import { RELOCATION_COOLDOWN } from '../utils/constants/bit';
import { ExtendedPointsData, ExtendedXCookieData, PlayerEnergy, PlayerMastery, PointsSource, User, XCookieSource } from '../models/user';
import { resources } from '../utils/constants/resource';
import { Item } from '../models/item';
import { BoosterItem } from '../models/booster';
import { TAPPING_MASTERY_LEVEL } from '../utils/constants/mastery';
import { TappingMastery } from '../models/mastery';
import { updateReferredUsersData } from './user';
import { redis } from '../utils/constants/redis';
import { SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE } from '../utils/constants/asset';
import { CRAFTING_RECIPES } from '../utils/constants/craft';
import { DEPLOYER_WALLET, ISLANDS_CONTRACT, KAIA_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { CURRENT_SEASON } from '../utils/constants/leaderboard';
import { GET_PLAYER_LEVEL } from '../utils/constants/user';

// /**
//  * Sets the new owner data and removes the current `owner` field for all islands.
//  */
// export const updateOwnerData = async (): Promise<void> => {
//     try {
//         const islands = await IslandModel.find({}).lean();

//         const islandUpdateOperations: Array<{
//             islandId: number,
//             updateOperations: {
//                 $unset: {},
//                 $set: {}
//             }
//         }> = [];

//         for (const island of islands) {
//             islandUpdateOperations.push({
//                 islandId: island.islandId,
//                 updateOperations: {
//                     $unset: {
//                         owner: 1
//                     },
//                     $set: {
//                         ownerData: {
//                             currentOwnerId: island.owner,
//                             originalOwnerId: island.owner,
//                             currentOwnerAddress: null,
//                             originalOwnerAddress: null
//                         },
//                     }
//                 }
//             });
//         }

//         const islandUpdatePromises = islandUpdateOperations.map(async op => {
//             return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
//         });

//         await Promise.all(islandUpdatePromises);

//         console.log(`(updateOwnerData) Updated the 'ownerData' field and removed the 'owner' field from all islands.`);
//     } catch (err: any) {
//         console.error('Error in updateOwnerData:', err.message);
//     }
// }

/**
 * Adds the new `blockchainData` to all existing islands.
 */
export const addBlockchainData = async (): Promise<void> => {
    try {
        await IslandModel.updateMany({}, {
            $set: {
                blockchainData: {
                    mintable: false,
                    minted: false,
                    tokenId: null,
                    chain: null,
                    contractAddress: null,
                    mintHash: null
                }
            }
        });

        console.log(`(addBlockchainData) Added the 'blockchainData' field to all islands.`);
    } catch (err: any) {
        console.error('Error in addOwnerAndBlockchainData:', err.message);
    }
}

/**
 * Deletes the `islandEarningStats` field from all islands as well as earning modifiers.
 */
export const deleteEarningStatsFromAllIslands = async (): Promise<void> => {
    try {
        // delete the `islandEarningStats` field from all islands
        // also, delete `islandStatsModifiers.earningRateModifiers` from all islands
        await IslandModel.updateMany({}, {
            $unset: {
                islandEarningStats: 1,
                'islandStatsModifiers.earningRateModifiers': 1
            }
        }).catch(err => {
            throw err;
        })

        console.log(`(deleteEarningStatsFromAllIslands) Deleted the 'islandEarningStats' field and earning rate modifiers from all islands.`);
    } catch (err: any) {
        console.error('Error in deleteEarningStatsFromAllIslands:', err.message);
    }
}

/**
 * Deletes the `currentTax` field from all islands.
 */
export const deleteTaxFromAllIslands = async (): Promise<void> => {
    try {
        // delete the `currentTax` field from all islands
        await IslandModel.updateMany({}, {
            $unset: {
                currentTax: 1
            }
        }).catch(err => {
            throw err;
        })

        console.log(`(deleteTaxFromAllIslands) Deleted the 'currentTax' field from all islands.`);
    } catch (err: any) {
        console.error('Error in deleteTaxFromAllIslands:', err.message);
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

        // only if the island was minted and then burned in the next process
        let burnTxHash = null;

        // if the island is minted, burn the NFT
        // if the bit is minted, burn the NFT
        if (island.blockchainData?.minted) {
            // if the token ID is null or 0, throw an error
            if (!island.blockchainData.tokenId || island.blockchainData.tokenId === 0) {
                return {
                    status: Status.ERROR,
                    message: `(releaseBit) Token ID not found.`
                }
            }

            // if the user doesn't have enough KAIA to pay for the transaction, throw an error
            // estimate the gas required to burn the island
            const gasEstimation = await ISLANDS_CONTRACT.estimateGas.burn(island.blockchainData.tokenId);

             // get the current gas price
            const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

            // calculate the gas fee in KAIA
            const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

            // check if the user has enough KAIA to pay for the gas fee
            const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
            const formattedUserBalance = ethers.utils.formatEther(userBalance);

            if (Number(formattedUserBalance) < Number(gasFee)) {
                console.log(`(removeIsland) User does not have enough KAIA to pay for the gas fee.`);
                return {
                    status: Status.ERROR,
                    message: `(removeIsland) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
                }
            }

            // burn the island
            const burnTx = await ISLANDS_CONTRACT.burn(island.blockchainData.tokenId);

            // wait for the transaction to be mined
            const burnTxReceipt = await burnTx.wait();

            console.log(`(removeIsland) Island NFT burned. Transaction hash: ${burnTxReceipt.transactionHash}`);

            burnTxHash = burnTxReceipt.transactionHash;
        }

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
                islandTraits: island.traits,
                burnTxHash
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

        // check if the bit is usable
        if (!bit.usable) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit is not usable.`
            }
        }

        // check if the island is usable
        if (!island.usable) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Island is not usable.`
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
        // e.g. if Bit 40 was placed in Island 1, all other bits that has the same or lesser rarity than Bit 40 will get +5% gathering rate.
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
                    const { gatheringRateModifiers, energyRateModifiers }: BitStatsModifiers = prevIslandBit.bitStatsModifiers;

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
                const { resourceCapModifiers, gatheringRateModifiers }: IslandStatsModifiers = prevIsland.islandStatsModifiers;

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
        const bitStatsModifiersFromConsumedSynthesizingItems = await addPlacedBitModifiersFromConsumedSynthesizingItems(
            user._id,
            bitId,
            island as Island
        );

        console.log(`(placeBit) bitStatsModifiersFromConsumedSynthesizingItems: ${JSON.stringify(bitStatsModifiersFromConsumedSynthesizingItems)}`);

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

        // check if the bit is usable
        if (!bit.usable) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) Bit is not usable.`
            }
        }

        // check if the island is usable
        if (!island.usable) {
            return {
                status: Status.ERROR,
                message: `(unplaceBit) Island is not usable.`
            }
        }

        // fetch bit's rarity
        const bitRarity = <BitRarity>bit.rarity;

        // fetch rarityDeviationReductions based on bitRarity
        // xTerio bit doesn't have reductions
        const rarityDeviationReductions =
            bit.bitType === BitType.XTERIO ? {
                gatheringRateReduction: 0
            } : RARITY_DEVIATION_REDUCTIONS(<IslandType>island.type, bitRarity);

        // check if island `gatheringRateModifiers` containing `Rarity Deviation` origin && Reductions is greater than 0
        const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier.origin === 'Rarity Deviation');
        // Set the Operations only if `Rarity Deviation` gatheringRateModifierIndex is found
        if (gatheringRateModifierIndex >= 0) {
            // check if this is the last placed bit in the island
            if (island.placedBitIds.length === 1) {
                // restore the value back to 1(100%) since we are unplacing the last bit placed in island
                islandUpdateOperations.$set[`islandStatsModifiers.gatheringRateModifiers.${gatheringRateModifierIndex}.value`] = 1;
            } else if (gatheringRateModifierIndex !== 1 && rarityDeviationReductions.gatheringRateReduction > 0) {
                const currentValue = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex].value ?? 1;
                const newValue = currentValue + (rarityDeviationReductions.gatheringRateReduction / 100);

                // added the value by the reduction amount since we are unplacing the bit from the isle
                islandUpdateOperations.$set[`islandStatsModifiers.gatheringRateModifiers.${gatheringRateModifierIndex}.value`] = newValue;
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

            // if the trait is genius, remove modifiers from the island's `gatheringRateModifiers`
            if (
                trait.trait === BitTraitEnum.GENIUS ||
                trait.trait === BitTraitEnum.SLOW ||
                trait.trait === BitTraitEnum.QUICK
            ) {
                console.log(`unplaceBit ID ${bit.bitId}'s trait is ${trait}`);

                // find the index of the modifier in the island's `gatheringRateModifiers`
                const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier?.origin?.includes(`Bit ID #${bit.bitId}`));

                console.log('gathering rate modifier index: ', gatheringRateModifierIndex);

                // if the modifier is found, remove it from the island's `gatheringRateModifiers`
                if (gatheringRateModifierIndex !== -1) {
                    islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = island.islandStatsModifiers?.gatheringRateModifiers[gatheringRateModifierIndex];
                }
                // if trait is teamworker, leader, cute or lonewolf, remove modifiers for each bit that was impacted by this bit's trait
            } else if (
                trait.trait === BitTraitEnum.TEAMWORKER ||
                trait.trait === BitTraitEnum.LEADER ||
                trait.trait === BitTraitEnum.CUTE ||
                trait.trait === BitTraitEnum.LONEWOLF
            ) {
                for (const otherBit of otherBits) {
                    // check the index of the modifier in the bit's `gatheringRateModifiers`
                    const gatheringRateModifierIndex = (otherBit.bitStatsModifiers?.gatheringRateModifiers as Modifier[]).findIndex(modifier => modifier?.origin?.includes(`Bit ID #${bit.bitId}`));

                    // if the modifier is found, remove it from the bit's `gatheringRateModifiers`
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
                }
            }
        }

        const bitUpdatePromises = bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        });

        console.log(`(unplaceBit) bitUpdateOperations: ${JSON.stringify(bitUpdateOperations)}`);
        console.log(`(unplaceBit) islandUpdateOperations: ${JSON.stringify(islandUpdateOperations)}`);
        console.log(`(unplaceBit) userUpdateOperations: ${JSON.stringify(userUpdateOperations)}`);

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            }),
            IslandModel.updateOne({ islandId }, {
                $set: islandUpdateOperations.$set,
                $inc: islandUpdateOperations.$inc
            }),
            ...bitUpdatePromises
        ]);

        await Promise.all([
            UserModel.updateOne({ twitterId }, {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull
            }),
            IslandModel.updateOne({ islandId }, {
                $push: islandUpdateOperations.$push,
                $pull: islandUpdateOperations.$pull
            })
        ]);

        // check if there are synthesizing items (or other items) that impact the bit's modifiers.
        // if yes, do the updates.
        const { $pull, $inc, $set, $push } = await removePlacedBitModifiersFromConsumedSynthesizingItems(bit as Bit, islandId, user._id);

        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems - unplaceBit) $pull: ${JSON.stringify($pull)}`);
        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems - unplaceBit) $inc: ${JSON.stringify($inc)}`);
        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems - unplaceBit) $set: ${JSON.stringify($set)}`);
        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems - unplaceBit) $push: ${JSON.stringify($push)}`);

        // check, for each object, if there are any keys. if yes, execute the update operation.
        if (Object.keys($pull).length > 0 || Object.keys($push).length > 0) {
            await BitModel.updateOne({ bitId }, { $pull, $push });
        }

        if (Object.keys($inc).length > 0 || Object.keys($set).length > 0) {
            await BitModel.updateOne({ bitId }, { $inc, $set });
        }

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
 * Adds a placed bit's modifiers based on one or multiple consumed synthesizing items that have an effect on them even when placed after
 * the synthesizing items were consumed.
 */
export const addPlacedBitModifiersFromConsumedSynthesizingItems = async (userId: string, bitId: number, island: Island): Promise<BitStatsModifiers> => {
    try {
        // loop through the ConsumedSynthesizingItems where `effectUntil` is greater than the current timestamp
        const consumedSynthesizingItems = await ConsumedSynthesizingItemModel.find({ usedBy: userId, affectedAsset: 'island', islandOrBitId: island.islandId, effectUntil: { $gt: Math.floor(Date.now() / 1000) } }).lean();

        // if there are no consumed synthesizing items, return an empty object
        if (consumedSynthesizingItems.length === 0) {
            console.log(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) No consumed synthesizing items found.`);

            return {
                gatheringRateModifiers: [],
                energyRateModifiers: [],
                foodConsumptionEfficiencyModifiers: []
            }
        }

        const bitStatsModifiers: BitStatsModifiers = {
            gatheringRateModifiers: [],
            energyRateModifiers: [],
            foodConsumptionEfficiencyModifiers: []
        }

        // for each consumed item, fetch the synthesizing item data and check if they have the `allowLaterPlacedBitsToObtainEffect` set to true.
        // if yes, based on what the item does, update the bit's modifiers.
        for (const consumedItem of consumedSynthesizingItems) {
            const craftingRecipe = CRAFTING_RECIPES.find(recipe => recipe.craftedAssetData.asset === consumedItem.item);
            const itemData = craftingRecipe?.craftedAssetData.assetExtendedData;

            if (!itemData) {
                continue;
            }

            // if the synthesizing item has `placedBitsEnergyDepletionRateModifier.active` set to true and `allowLaterPlacedBitsToObtainEffect` set to true,
            // we need to update the bit's energy rate modifiers to include the synthesizing item's effects.
            if (itemData.effectValues.placedBitsEnergyDepletionRateModifier.active && itemData.effectValues.placedBitsEnergyDepletionRateModifier.allowLaterPlacedBitsToObtainEffect) {
                console.log(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) FOUND ITEM WHERE DEPLETION RATE MODIFIER ALLOWS LATER PLACED BITS TO OBTAIN EFFECT: ${craftingRecipe.craftedAssetData.asset}`);

                // get the placed bits of the island
                const placedBits = island.placedBitIds;

                // fetch the bull queue data for this item (if there are multiple, fetch the first one)
                const bullQueueData = await SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.getJobs(['waiting', 'active', 'delayed']);

                console.log(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) origin for bull queue data #0: `, bullQueueData[0].data.origin);

                // find any bull queues that have the `origin` starting with `Synthesizing Item: ${itemData.name}. Instance ID: ${consumedItem._id}` and `bitId` is in the `placedBits`
                const relevantBullQueueData = bullQueueData
                    .filter(queue => queue.name === 'removeBitEnergyDepletionRateModifier')
                    .filter(queue => queue.data.origin.startsWith(`Synthesizing Item: ${craftingRecipe.craftedAssetData.asset}`))
                    // check if the bit ID is in the placed bits
                    .filter(queue => placedBits.includes(queue.data.bitId));

                // get the first data (because we just care about the endTimestamp)
                const relevantBullQueueDataFirst = relevantBullQueueData[0];

                // create the modifier
                const energyRateModifier: Modifier = {
                    origin: `Synthesizing Item: ${craftingRecipe.craftedAssetData.asset}. Instance ID: ${consumedItem._id}`,
                    value: 1 + (itemData.effectValues.placedBitsEnergyDepletionRateModifier.value / 100)
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
                        islandId: island.islandId,
                        owner: userId,
                        origin: `Synthesizing Item: ${craftingRecipe.craftedAssetData.asset}. Instance ID: ${consumedItem._id}`,
                        // for the end timestamp, we will match it with the `relevantBullQueueDataFirst`'s endTimestamp
                        // because we don't want it to last longer than the other bits.
                        endTimestamp: relevantBullQueueDataFirst.data.endTimestamp
                    },
                    // make it so the delay is the difference between the endTimestamp and the current timestamp 
                    { delay: (relevantBullQueueDataFirst.data.endTimestamp - Math.floor(Date.now() / 1000)) * 1000 }
                );
            }

            // TO DO: when other synthesizing items are added, add their effects here.
        }

        return bitStatsModifiers;
    } catch (err: any) {
        console.error(`(updatePlacedBitModifiersFromConsumedSynthesizingItems) Error: ${err.message}`);

        return {
            gatheringRateModifiers: [],
            energyRateModifiers: [],
            foodConsumptionEfficiencyModifiers: []
        }
    }
}

/**
 * Removes any 
 */
export const removePlacedBitModifiersFromConsumedSynthesizingItems = async (bit: Bit, islandId: number, userId: string): Promise<
    {
        bitId: number,
        $pull: {},
        $inc: {},
        $set: {},
        $push: {}
    }> => {
    try {
        const bullQueueData = await SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.getJobs(['waiting', 'active', 'delayed']);

        // find any bull queues that have the `origin` starting with `Synthesizing Item: ${itemData.name}. Instance ID: ${consumedItem._id}` and `bitId` is in the `placedBits`
        const relevantBullQueueData = bullQueueData.filter(queue => queue.name === 'removeBitEnergyDepletionRateModifier' && queue.data.bitId === bit.bitId && queue.data.owner === userId);

        // if there are no relevant bull queue data, return an empty object
        if (relevantBullQueueData.length === 0) {
            return {
                bitId: bit.bitId,
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }

        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems) Relevant Bull Queue Data: ${JSON.stringify(relevantBullQueueData, null, 2)}`);

        const updateOperations: {
            bitId: number,
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        } = {
            bitId: bit.bitId,
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const consumedItems = await ConsumedSynthesizingItemModel.find({ usedBy: userId, affectedAsset: 'island', islandOrBitId: islandId }).lean();

        if (!consumedItems || consumedItems.length === 0) {
            console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems) No consumed synthesizing items found.`);
            return updateOperations;
        }

        console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems) Consumed Items: ${JSON.stringify(consumedItems, null, 2)}`);

        // loop through each relevant bull queue data and remove any modifiers that have the origin of the synthesizing item
        for (const queueData of relevantBullQueueData) {
            // for each modifier, check the origin.
            const origin = queueData.data.origin as string;

            console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems) Origin: ${origin}`);

            // find the consumed item that includes the origin
            const consumedItem = consumedItems.find(item => origin.includes(item._id));

            if (!consumedItem) {
                continue;
            }

            console.log(`(removePlacedBitModifiersFromConsumedSynthesizingItems) Consumed Item: ${JSON.stringify(consumedItem)}`);

            // check if this item has 'allowLaterUnplacedBitsToLoseEffect' set to true. if yes, remove the modifier.
            const craftingRecipe = CRAFTING_RECIPES.find(recipe => recipe.craftedAssetData.asset === consumedItem.item);
            const itemData = craftingRecipe?.craftedAssetData.assetExtendedData;

            if (!itemData) {
                continue;
            }

            if (itemData.effectValues.placedBitsEnergyDepletionRateModifier.allowLaterPlacedBitsToObtainEffect) {
                // remove the modifier from the bit's energy rate modifiers
                updateOperations.$pull['bitStatsModifiers.energyRateModifiers'] = { origin };
            }

            // TO DO: when other synthesizing items are added, add their effects here.
        }

        return updateOperations;
    } catch (err: any) {
        console.error(`(removePlacedBitModifiersFromConsumedSynthesizingItems) Error: ${err.message}`);
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
        // increase all other bits that have the same or lesser rarity as the bit being placed by 5% gathering rate
        if (trait.trait === BitTraitEnum.TEAMWORKER) {
            // loop through each other bit and check if they have the same or lesser rarity as the bit being placed
            // if no other bits found, skip this trait
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // check if the other bit's rarity is the same or lesser than the bit being placed
                if (BitRarityNumeric[otherBit.rarity] <= BitRarityNumeric[bit.rarity]) {
                    // add the new modifier to the bit's `gatheringRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${bit.bitId}'s Trait: Teamworker`,
                        value: 1.05
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers`
                    bitUpdateOperations.push({
                        bitId: otherBit.bitId,
                        updateOperations: {
                            $push: {
                                'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
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
            // increase all other bits' gathering rate by 10%
        } else if (trait.trait === BitTraitEnum.LEADER) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Leader`,
                    value: 1.1
                }

                // add the new modifier to the bit's `gatheringRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
            // if bit trait is cute:
            // increase gathering rate of all other bits by 12.5%
        } else if (trait.trait === BitTraitEnum.CUTE) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Cute`,
                    value: 1.125
                }

                // add the new modifier to the bit's `gatheringRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
            // if bit trait is genius:
            // increase the island's gathering rate by 7.5%
        } else if (trait.trait === BitTraitEnum.GENIUS) {
            // add the new modifier to the island's `gatheringRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Genius`,
                value: 1.075
            }

            // add the new modifier to the island's `gatheringRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            // if bit trait is lonewolf:
            // reduce the working rate of all other bits by 5%
        } else if (trait.trait === BitTraitEnum.LONEWOLF) {
            if (otherBits.length === 0 || !otherBits) {
                console.log(`(updateExtendedTraitEffects) No other bits found.`);
                continue;
            }

            for (const otherBit of otherBits) {
                // add the new modifier to the bit's `gatheringRateModifiers`
                const newGatheringRateModifier: Modifier = {
                    origin: `Bit ID #${bit.bitId}'s Trait: Lonewolf`,
                    value: 0.95
                }

                // add the new modifier to the bit's `gatheringRateModifiers`
                bitUpdateOperations.push({
                    bitId: otherBit.bitId,
                    updateOperations: {
                        $push: {
                            'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                        },
                        $pull: {},
                        $inc: {},
                        $set: {}
                    }
                });
            }
            // if bit trait is slow, reduce 1% of the island's gathering rate
        } else if (trait.trait === BitTraitEnum.SLOW) {
            // add the new modifier to the island's `gatheringRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Slow`,
                value: 0.99
            }

            // add the new modifier to the island's `gatheringRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
            // if bit trait is quick, increase 1% of the island's gathering rate
        } else if (trait.trait === BitTraitEnum.QUICK) {
            // add the new modifier to the island's `gatheringRateModifiers`
            const newGatheringRateModifier: Modifier = {
                origin: `Bit ID #${bit.bitId}'s Trait: Quick`,
                value: 1.01
            }

            // add the new modifier to the island's `gatheringRateModifiers`
            islandUpdateOperations.$push['islandStatsModifiers.gatheringRateModifiers'] = newGatheringRateModifier;
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
                // if yes, add 5% gathering rate to the to-be-placed bit
                if (trait.trait === BitTraitEnum.TEAMWORKER) {
                    if (BitRarityNumeric[bit.rarity] <= BitRarityNumeric[otherBit.rarity]) {
                        // add the new modifier to the bit's `gatheringRateModifiers`
                        const newGatheringRateModifier: Modifier = {
                            origin: `Bit ID #${otherBit.bitId}'s Trait: Teamworker`,
                            value: 1.05
                        }

                        // add the new modifier to the bit's `gatheringRateModifiers`
                        bitUpdateOperations.push({
                            bitId: bit.bitId,
                            updateOperations: {
                                $push: {
                                    'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                                },
                                $pull: {},
                                $inc: {},
                                $set: {}
                            }
                        });
                    }
                }

                // if the other bit's trait is leader, add 10% gathering rate to the to-be-placed bit
                if (trait.trait === BitTraitEnum.LEADER) {
                    // add the new modifier to the bit's `gatheringRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Leader`,
                        value: 1.1
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
                        updateOperations: {
                            $push: {
                                'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                            },
                            $pull: {},
                            $inc: {},
                            $set: {}
                        }
                    });
                }

                // if the other bit's trait is cute, add 12.5% gathering rate to the to-be-placed bit
                if (trait.trait === BitTraitEnum.CUTE) {
                    // add the new modifier to the bit's `gatheringRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Cute`,
                        value: 1.125
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
                        updateOperations: {
                            $push: {
                                'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
                            },
                            $pull: {},
                            $inc: {},
                            $set: {}
                        }
                    });
                }

                // if the other bit's trait is lonewolf, reduce 5% gathering rate to the to-be-placed bit
                if (trait.trait === BitTraitEnum.LONEWOLF) {
                    // add the new modifier to the bit's `gatheringRateModifiers`
                    const newGatheringRateModifier: Modifier = {
                        origin: `Bit ID #${otherBit.bitId}'s Trait: Lonewolf`,
                        value: 0.95
                    }

                    // add the new modifier to the bit's `gatheringRateModifiers`
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
                        updateOperations: {
                            $push: {
                                'bitStatsModifiers.gatheringRateModifiers': newGatheringRateModifier,
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
            const gatheringRate = calcIslandGatheringRate(
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
        const gatheringRate = calcIslandGatheringRate(
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

        // check if the island is usable
        if (!island.usable) {
            return {
                status: Status.ERROR,
                message: `(applyGatheringProgressBooster) Island ID ${islandId} is not usable.`
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
        const job = await ISLAND_QUEUE.add(
            'dropResourceOrClaimResources', 
            { queueType: 'claimResources', twitterId, islandId, claimType, chosenResources }
        );

        // wait until the job finishes processing
        const { status, message, data } = await job.finished();

        if (status !== Status.SUCCESS) {
            console.error(`(claimResources) Error: ${message}`);
            return {
                status: Status.ERROR,
                message: `(claimResources) Error: ${message}`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(claimResources) Resources claimed successfully for Island ID ${islandId}.`,
            data
        }
    } catch (err: any) {
        console.error(`(claimResources) Error: ${err.message}`);
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
 * Drops a resource for a user's island. 
 * 
 * Should only be called when gathering progress has reached >= 100% (and then reset back to 0%). Scheduler/parent function will check this.
 */
export const dropResource = async (islandId: number): Promise<ReturnValue> => {
    try {
        const job = await ISLAND_QUEUE.add(
            'dropResourceOrClaimResources', 
            { queueType: 'dropResource', islandId }
        );

        // wait until the job finishes processing
        const { status, message, data } = await job.finished();

        if (status !== Status.SUCCESS) {
            console.error(`(dropResource) Error: ${message}`);
            return {
                status: Status.ERROR,
                message: `(dropResource) Error: ${message}`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(dropResource) Resource dropped successfully for Island ID ${islandId}.`,
            data
        }
    } catch (err: any) {
        console.error(`(dropResource) Error: ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(dropResource) Error: ${err.message}`
        };
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

            console.log(`(randomizeResourceFromChances) trait: `, trait);

            // if trait is mineral rich, find the ore resource with the specified rarity.
            // if trait is aquifer, find the liquid resource with the specified rarity.
            // if trait is fertile, find the fruit resource with the specified rarity
            const resource = resources.find(r => {
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
            console.log(`(randomizeResourceFromChances) resource is null: `, resource === null);

            console.log(`(randomizeResourceFromChances) resource: `, resource);
            return resource;
        }
    }

    return null;
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
 * Calculates the current gathering rate of the island, based on various factors like number of bits, the bits' stats and island type among others.
 * 
 * NOTE: to prevent miscalculations, ensure that:
 * 
 * 1. `baseRates` (referring to the base gathering rate of the bits), `bitLevels`, and `initialGrowthRates` are all of the same length.
 * 
 * 2. the indexes of each array correspond to the same bit; for example, if `baseRates[0]` = 0.025, `bitLevels[0]` = 3 and `initialGrowthRates[0]` = 0.0002,
 * this should mean that Bit #1 has a base gathering rate of 0.025, is at level 3, and has an initial growth rate of 0.0002.
 */
export const calcIslandGatheringRate = (
    islandType: IslandType,
    baseRates: number[],
    bitLevels: number[],
    initialGrowthRates: number[],
    // gathering rate modifiers from `BitStatsModifiers` for each bit (each bit will have Modifier[], so multiple bits will be an array of Modifier[], thus Modifier[][])
    bitModifiers: Modifier[][],
    // gathering rate modifiers from `IslandStatsModifiers`
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
            // get the gathering rate for each bit
            const currentRate = calcBitGatheringRate(baseRates[i], bitLevels[i], initialGrowthRates[i], bitModifiers[i]);

            // add the current rate to the sum
            sum += currentRate;
        }

        // multiply the sum with the reduction modifier part of the formula
        const reductionModifier = GATHERING_RATE_REDUCTION_MODIFIER;

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

        const owner = await UserModel.findOne({ _id: island.ownerData.currentOwnerId }).lean();

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

        const userLeaderboardDataUpdateOperations = {
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
        const leaderboardData = await UserLeaderboardDataModel.findOne({ userId: user._id, season: CURRENT_SEASON }).lean();
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Island with ID ${islandId} not found.`
            };
        }

        // check if island is usable
        if (!island.usable) {
            return {
                status: Status.ERROR,
                message: `(applyIslandTapping) Island ID ${islandId} is not usable.`
            }
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) User not found.`
            };
        }

        if (!latestSquadLeaderboard) {
            return {
                status: Status.ERROR,
                message: `(getIslandTappingData) Squad leaderboard not found.`
            }
        }

        // Destructure currentEnergy
        const { currentEnergy } = user.inGameData.energy as PlayerEnergy;
        // Destructure islandTappingData & islandType
        const { caressEnergyMeter, currentCaressEnergyMeter, currentMilestone, milestoneReward } = island.islandTappingData as IslandTappingData;
        const { type } = island as Island;

        // Check islandTappingLimit & boosterPercentage.
        // If island Type is Primal, add 100% booster on top of milestone Booster reward
        const islandTappingLimit = ISLAND_TAPPING_MILESTONE_LIMIT(type);
        const boosterPercentage = type === IslandType.PRIMAL_ISLES ? milestoneReward.boosterReward + 100 : milestoneReward.boosterReward;
        console.log(`(applyIslandTapping), Island #${island.islandId} type ${type}. Apply ${boosterPercentage}% Booster`);
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
                // add the points to the user's leaderboard data and the user's `points` in the inventory
                if (!leaderboardData) {
                    // create a new leaderboard data instance
                    await UserLeaderboardDataModel.create({
                        _id: generateObjectId(),
                        userId: user._id,
                        username: user.twitterUsername,
                        twitterProfilePicture: user.twitterProfilePicture,
                        season: CURRENT_SEASON,
                        points: secondOptionReward.pointDrop
                    });

                    const newLevel = GET_PLAYER_LEVEL(secondOptionReward.pointDrop);

                    // if user levelled up, set the user's `inGameData.level` to the new level
                    if (newLevel > user.inGameData.level) {
                        userUpdateOperations.$set['inGameData.level'] = newLevel;
                    }
                } else {
                    // increment the user's points in the leaderboard data
                    userLeaderboardDataUpdateOperations.$inc['points'] = secondOptionReward.pointDrop;

                    // check if the user is eligible to level up to the next level
                    const newLevel = GET_PLAYER_LEVEL(leaderboardData.points + secondOptionReward.pointDrop);

                    // if user levelled up, set the user's `inGameData.level` to the new level
                    if (newLevel > user.inGameData.level) {
                        userUpdateOperations.$set['inGameData.level'] = newLevel;
                    }
                }

                // update the points data for the user too
                userUpdateOperations.$inc['inventory.pointsData.currentPoints'] = secondOptionReward.pointDrop;
                
                // check if the source exists in the extended points data
                const rewardsIndex = (user.inventory?.pointsData.extendedPointsData as ExtendedPointsData[]).findIndex(data => data.source === PointsSource.ISLAND_TAPPING);

                if (rewardsIndex !== -1) {
                    // increment the points
                    userUpdateOperations.$inc[`inventory.pointsData.extendedPointsData.${rewardsIndex}.points`] = secondOptionReward.pointDrop;
                } else {
                    // push a new instance to the array
                    userUpdateOperations.$push[`inventory.pointsData.extendedPointsData`] = {
                        source: PointsSource.ISLAND_TAPPING,
                        points: secondOptionReward.pointDrop
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

            UserLeaderboardDataModel.updateOne({ userId: user._id, season: CURRENT_SEASON }, {
                $set: userLeaderboardDataUpdateOperations.$set,
                $inc: userLeaderboardDataUpdateOperations.$inc
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

            UserLeaderboardDataModel.updateOne({ userId: user._id, season: CURRENT_SEASON }, {
                $push: userLeaderboardDataUpdateOperations.$push,
                $pull: userLeaderboardDataUpdateOperations.$pull
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

        // check if the island is usable
        if (!island.usable) {
            return {
                status: Status.ERROR,
                message: `(rerollBonusMilestoneReward) Island ID ${islandId} is not usable.`
            }
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
            message: `(rerollBonusMilestoneReward) Error: ${err.message}`
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
            const owner = await UserModel.findOne({ _id: island.ownerData.currentOwnerId }).lean();

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

export const cleanUpRarityDeviation = async () => {
    try {
        // Find all islands with Rarity Deviation modifiers
        const islands = await IslandModel.find({ 'islandStatsModifiers.gatheringRateModifiers.origin': 'Rarity Deviation' }).lean();
        // Find all Bits that is Active in island right now
        const bits = await BitModel.find({ placedIslandId: { $ne: 0 } }).lean();

        if (islands.length === 0) {
            throw new Error(`(cleanUpRarityDeviation) No islands found.`);
        }

        if (bits.length === 0) {
            throw new Error(`(cleanUpRarityDeviation) No bits found.`);
        }

        const bulkWriteOps = await Promise.all(
            islands.map((island) => {
                const { placedBitIds } = island as Island;

                // Sum total of gatheringRateReduction using reduce
                const totalGatheringRateReduction = placedBitIds.reduce((acc, bitId) => {
                    const bitFound = bits.find((bit) => bit.bitId === bitId);

                    // If the bit is not found, return the current accumulated value (no addition)
                    if (!bitFound) return acc;

                    const rarity = bitFound.rarity as BitRarity;

                    // Calculate the rarity deviation reductions based on bit type and rarity
                    const rarityDeviationReductions =
                        bitFound.bitType === BitType.XTERIO
                            ? { gatheringRateReduction: 0 }
                            : RARITY_DEVIATION_REDUCTIONS(<IslandType>island.type, rarity);

                    // Add the gatheringRateReduction to the accumulator
                    return acc + rarityDeviationReductions.gatheringRateReduction;
                }, 0); // Initialize accumulator with 0

                // Get gatheringRateModifierIndex for 'Rarity Deviation'.
                const gatheringRateModifierIndex = (island.islandStatsModifiers?.gatheringRateModifiers as Modifier[])?.findIndex(
                    (modifier) => modifier.origin === 'Rarity Deviation'
                );

                // Handle the case where the gatheringRateModifier is not found
                if (gatheringRateModifierIndex === -1) {
                    return null; // No modifier found, skip this island
                }

                // Prepare the update operation for MongoDB bulk write
                return {
                    updateOne: {
                        filter: { islandId: island.islandId },
                        update: {
                            $set: {
                                [`islandStatsModifiers.gatheringRateModifiers.${gatheringRateModifierIndex}.value`]:
                                    1 - totalGatheringRateReduction / 100, // Adjust gathering rate value
                            },
                        },
                    },
                };
            })
        );

        // Filter out any null values from the operations array
        const filteredBulkWriteOps = bulkWriteOps.filter((op) => op !== null);

        // Perform the bulk write operation only if there are valid operations
        if (filteredBulkWriteOps.length > 0) {
            await IslandModel.bulkWrite(filteredBulkWriteOps);
        } else {
            throw new Error(`(cleanUpRarityDeviation) No valid operations to execute.`);
        }
    } catch (err: any) {
        console.error(`(cleanUpRarityDeviation) Error: ${err.message}`);
    }
};
