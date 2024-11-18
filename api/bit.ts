import { ReturnValue, Status } from '../utils/retVal';
import { Bit, BitFarmingStats, BitNameData, BitRarity, BitType } from '../models/bit';
import {
    BIT_TRAITS,
    DEFAULT_ENERGY_DEPLETION_RATE,
    DEFAULT_GATHERING_RATE,
    DEFAULT_GATHERING_RATE_GROWTH,
    ENERGY_THRESHOLD_REDUCTIONS,
    MAX_BIT_LEVEL,
    RANDOMIZE_GENDER,
    getBitStatsModifiersFromTraits,
    randomizeBitTraits,
} from '../utils/constants/bit';
import {
    GATHERING_RATE_EXPONENTIAL_DECAY,
} from '../utils/constants/island';
import { RateType } from '../models/island';
import { Modifier } from '../models/modifier';
import { Food, FoodType } from '../models/food';
import { FOOD_ENERGY_REPLENISHMENT } from '../utils/constants/food';
import { BarrenResource, ExtendedResource } from '../models/resource';
import { generateObjectId } from '../utils/crypto';
import { BitModel, BitTraitDataModel, IslandModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';
import { redis } from '../utils/constants/redis';

/**
 * Adds the new `blockchainData` field with default values to all bits in the database.
 */
export const addBlockchainData = async (): Promise<void> => {
    try {
        await BitModel.updateMany({}, {
            $set: { blockchainData: {
                mintable: false,
                minted: false,
                tokenId: null,
                chain: null,
                contractAddress: null,
                mintHash: null
            } }
        })
    } catch (err: any) {
        console.log(`(addBlockchainData) Error: ${err.message}`);
    }
}

// /**
//  * Updates the existing `owner` data of all bits to include the new `ownerData`.
//  */
// export const updateOwnerData = async (): Promise<void> => {
//     try {
//         const bits = await BitModel.find({}).lean();

//         const bitUpdateOperations: Array<{
//             bitId: number,
//             updateOperations: {
//                 $set: {},
//                 $unset: {}
//             }
//         }> = [];

//         for (const bit of bits) {
//             const ownerData = {
//                 currentOwnerId: bit.owner,
//                 originalOwnerId: bit.owner,
//                 currentOwnerAddress: null,
//                 originalOwnerAddress: null
//             }

//             // set the owner data and unset the old `owner` field.
//             bitUpdateOperations.push({
//                 bitId: bit.bitId,
//                 updateOperations: {
//                     $set: { ownerData },
//                     $unset: { owner: 1 }
//                 }
//             });
//         }

//         // execute the update operations
//         const bitUpdatePromises = bitUpdateOperations.map(async op => {
//             return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
//         });

//         await Promise.all(bitUpdatePromises);

//         console.log(`(updateOwnerData) Updated owner data for all bits.`);
//     } catch (err: any) {
//         console.log(`(updateOwnerData) Error: ${err.message}`);
//     }
// }

/**
 * Removes earning stats from all bits in the database.
 */
export const removeEarningStatsFromBit = async (): Promise<void> => {
    try {
        // remove `baseEarningRate` and `earningRateGrowth` from all bits' `farmingStats`.
        // also, remove `bitStatsModifiers.earningRateModifiers` from all bits.
        await BitModel.updateMany({}, {
            $unset: {
                'farmingStats.baseEarningRate': 1,
                'farmingStats.earningRateGrowth': 1,
                'bitStatsModifiers.earningRateModifiers': 1,
            }
        });

        console.log(`(removeEarningStatsFromBit) Removed earning stats from all bits.`);
    } catch (err: any) {
        console.log(`(removeEarningStatsFromBit) Error: ${err.message}`);
    }
}

/**
 * Gifts a user from Xterio an Xterio bit.
 */
export const giftXterioBit = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(giftXterioBit) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const { status, message, data } = await getLatestBitId();

        if (status !== Status.SUCCESS) {
            return {
                status: Status.ERROR,
                message: `(giftXterioBit) Error: ${message}`
            }
        }

        // get the latest bit id
        const latestBitId = data?.latestBitId as number;
        
        // Xterio bits always has Rare rarity
        const rarity = BitRarity.RARE;

        const gender = RANDOMIZE_GENDER();

        const traits = randomizeBitTraits(rarity);
        const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map(trait => trait.trait));

        const bit = new BitModel({
            _id: generateObjectId(),
            bitId: latestBitId + 1,
            // the bit type will always be Xterio
            bitType: BitType.XTERIO,
            bitNameData: {
                name: `Bit #${latestBitId + 1}`,
                lastChanged: 0
            },
            rarity,
            gender,
            owner: user._id,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.XTERIO,
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
        })

        // add the bit to the user's inventory
        userUpdateOperations.$push['inventory.bitIds'] = bit.bitId;

        // add the bit to the bit database
        await bit.save();

        // execute the user update operations
        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(giftXterioBit) Xterio bit gifted.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(giftXterioBit) Error: ${err.message}`
        }
    }
}

/**
 * (User) Renames a bit to a new name.
 */
export const renameBit = async (
    twitterId: string, 
    bitId: number,
    newName: string
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(renameBit) User not found.`,
            };
        }

        const bitUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        }

        // check if the user owns this bit
        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(renameBit) User does not own the bit.`,
            };
        }

        // get the bit
        const bit = await BitModel.findOne({ bitId }).lean();

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(renameBit) Bit not found.`,
            };
        }

        // get the current name
        const currentName = (bit.bitNameData as BitNameData).name;

        // the new name must be maximum 16 characters long and CANNOT have any special characters
        // underscore and dots are allowed
        if (newName.length > 16 || !newName.match(/^[a-zA-Z0-9_.-]*$/)) {
            return {
                status: Status.ERROR,
                message: `(renameBit) New name is invalid.`,
            };
        }

        // update the bit's name
        bitUpdateOperations.$set['bitNameData.name'] = newName;

        // execute the update operation
        await BitModel.updateOne({ bitId }, bitUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(renameBit) Bit renamed.`,
            data: {
                bitId: bitId,
                oldName: currentName,
                newName: newName,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(renameBit) Error: ${err.message}`
        }
    }
}

/**
 * (User) Manually releases a bit from the user's inventory. 
 */
export const releaseBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {
    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean()
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
                message: `(releaseBit) User not found.`
            }
        }

        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(releaseBit) User does not own the bit.`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(releaseBit) Bit not found.`
            }
        }

        // check if the bit is placed in any island
        const placedIslandId = bit.placedIslandId;

        // remove the bit from the user's inventory
        userUpdateOperations.$pull['inventory.bitIds'] = bitId;

        // if the bit is placed in an island, we do these checks:
        // 1. remove the bit from the island's `placedBitIds`
        // 2. check if the bit affects the islandStatsModifiers. if yes, remove the modifier related to this bit.
        // 3. check if this bit affects the other bits' bitStatsModifiers (if the island has more bits). if yes, remove the modifier related to this bit.
        if (placedIslandId !== 0) {
            // remove the bit from the island's `placedBitIds`
            islandUpdateOperations.$pull['placedBitIds'] = bitId;

            // check if the island's `islandStatsModifiers` contain any modifiers related to this bit
            // it should say something like `Bit ID ${bitId}'s Trait: ...` as the origin of the modifier.
            // if there is, remove it/them.
            const island = await IslandModel.findOne({ islandId: placedIslandId }).lean();

            if (!island) {
                return {
                    status: Status.ERROR,
                    message: `(releaseBit) Island not found.`
                }
            }

            const islandStatsModifiers = island.islandStatsModifiers;

            // check if the islandStatsModifiers contain any modifiers related to this bit
            const gatheringRateModifiers = islandStatsModifiers?.gatheringRateModifiers as Modifier[];
            const resourceCapModifiers = islandStatsModifiers?.resourceCapModifiers as Modifier[];

            // check if the `gatheringRateModifiers` contain a modifier related to this bit
            const gatheringRateModifierIndex = gatheringRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
            const resourceCapModifierIndex = resourceCapModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));

            // if the modifier exists, remove it
            if (gatheringRateModifierIndex !== -1) {
                islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = gatheringRateModifiers[gatheringRateModifierIndex];
            }

            if (resourceCapModifierIndex !== -1) {
                islandUpdateOperations.$pull['islandStatsModifiers.resourceCapModifiers'] = resourceCapModifiers[resourceCapModifierIndex];
            }

            // check if the island has more bits. if yes, check if the other bits' bitStatsModifiers contain any modifiers related to this bit
            // if there is, remove it/them.
            const placedBitIds = island.placedBitIds as number[];

            // filter out the bitId from the placedBitIds
            const otherBitIds = placedBitIds.filter(id => id !== bitId);

            if (otherBitIds.length > 0) {
                // get the other bits' bitStatsModifiers
                const otherBits = await BitModel.find({ bitId: { $in: otherBitIds } }).lean();

                otherBits.forEach(otherBit => {
                    const otherBitStatsModifiers = otherBit.bitStatsModifiers;

                    // check if the bitStatsModifiers contain any modifiers related to this bit
                    const gatheringRateModifiers = otherBitStatsModifiers?.gatheringRateModifiers as Modifier[];
                    const energyRateModifiers = otherBitStatsModifiers?.energyRateModifiers as Modifier[];
                    const foodConsumptionEfficiencyModifiers = otherBitStatsModifiers?.foodConsumptionEfficiencyModifiers as Modifier[];

                    const gatheringRateModifierIndex = gatheringRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
                    const energyRateModifierIndex = energyRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
                    const foodConsumptionEfficiencyModifierIndex = foodConsumptionEfficiencyModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));

                    // if the modifier exists, remove it
                    if (gatheringRateModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: { 'bitStatsModifiers.gatheringRateModifiers': gatheringRateModifiers[gatheringRateModifierIndex] },
                                $inc: {},
                                $set: {},
                                $push: {}
                            }
                        });
                    }

                    if (energyRateModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: { 'bitStatsModifiers.energyRateModifiers': energyRateModifiers[energyRateModifierIndex] },
                                $inc: {},
                                $set: {},
                                $push: {}
                            }
                        });
                    }

                    if (foodConsumptionEfficiencyModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: { 'bitStatsModifiers.foodConsumptionEfficiencyModifiers': foodConsumptionEfficiencyModifiers[foodConsumptionEfficiencyModifierIndex] },
                                $inc: {},
                                $set: {},
                                $push: {}
                            }
                        });
                    }
                });
            }
        }

        const bitUpdatePromises = bitUpdateOperations.length > 0 && bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        });

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            BitModel.deleteOne({ bitId }),
            IslandModel.updateOne({ islandId: placedIslandId }, islandUpdateOperations),
            bitUpdatePromises
        ]);

        return {
            status: Status.SUCCESS,
            message: `(releaseBit) Bit released.`,
            data: {
                bitId: bitId,
                bitRarity: bit.rarity,
                bitTraits: bit.traits,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(releaseBit) Error: ${err.message}`,
        };
    }
}

/**
 * (User) Feeds a bit some food and replenishes its energy.
 */
export const feedBit = async (twitterId: string, bitId: number, foodType: FoodType): Promise<ReturnValue> => {
    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean()
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
                message: `(feedBit) User not found.`
            }
        }

        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(feedBit) User does not own the bit.`
            }
        }

        // check if the user has at least 1 of the specified `food` by checking if:
        // 1. the food type exists in `foods`
        // 2. the `amount` of the food type is at least 1
        const userFood = (user.inventory?.foods as Food[]).find(food => food.type === foodType);
        if (!userFood || userFood.amount < 1) {
            return {
                status: Status.ERROR,
                message: `(feedBit) User does not have enough of the specified food.`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(feedBit) Bit not found.`
            }
        }

        // check if the bit's energy is already at max (100)
        if (bit.farmingStats?.currentEnergy === 100) {
            return {
                status: Status.ERROR,
                message: `(feedBit) Bit's energy is already at max.`
            }
        }

        // calculate the amount of energy to replenish
        const baseToReplenish = FOOD_ENERGY_REPLENISHMENT(foodType);

        // check if the bit has any modifiers that impact food consumption efficiency
        const foodConsumptionModifiers = bit.bitStatsModifiers?.foodConsumptionEfficiencyModifiers as Modifier[];
        const foodConsumptionMultiplier = foodConsumptionModifiers.reduce((acc, modifier) => acc * modifier.value, 1);

        const toReplenish = baseToReplenish * foodConsumptionMultiplier;

        // if the amount of energy to replenish is more than the amount of energy needed to reach 100, set the amount to replenish to the amount needed to reach 100
        const energyNeededToReach100 = 100 - bit.farmingStats?.currentEnergy;
        const actualToReplenish = Math.min(toReplenish, energyNeededToReach100);

        // search for the food type (in string format) in the `foods` array and decrement the `amount` by `1`
        userUpdateOperations.$inc['inventory.foods.$.amount'] = -1;

        // increment the bit's current energy by `actualToReplenish`
        bitUpdateOperations.$inc['farmingStats.currentEnergy'] = actualToReplenish;

        // check if the current energy is above the thresholds defined by `ENERGY_THRESHOLD_REDUCTIONS`. if so, check for prev. negative modifiers and update them.
        // here, we assume that `currentEnergy` is still the same because it was called before updating it, so we use `currentEnergy` instead of `currentEnergy + actualToReplenish`
        const currentEnergy: number = bit.farmingStats?.currentEnergy + actualToReplenish;

        const { gatheringRateReduction } = ENERGY_THRESHOLD_REDUCTIONS(currentEnergy);

        // update the modifiers of the bit regardless based on the energy thresholds
        const gatheringRateModifier: Modifier = {
            origin: 'Energy Threshold Reduction',
            value: 1 - (gatheringRateReduction / 100)
        }

        // update the bit's `statsModifiers` with the new modifiers. check first if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`
        const gatheringRateModifiers = bit.bitStatsModifiers?.gatheringRateModifiers;

        // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
        const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');

        // if the modifier exists, update it; if not, push it
        if (gatheringRateModifierIndex !== -1) {
            // if the new gathering rate modifier is 1, remove the modifier
            if (gatheringRateModifier.value === 1) {
                bitUpdateOperations.$pull['bitStatsModifiers.gatheringRateModifiers'] = { origin: 'Energy Threshold Reduction' };
            } else {
                bitUpdateOperations.$set[`bitStatsModifiers.gatheringRateModifiers.$[elem].value`] = gatheringRateModifier.value;
            }
        } else {
            bitUpdateOperations.$push['bitStatsModifiers.gatheringRateModifiers'] = gatheringRateModifier;
        }

        let bitUpdateOptions = {};

        // set the array filters for the bit update operations if gathering rate modifier value is not 1
        if (gatheringRateModifier.value !== 1) {
            bitUpdateOptions = { arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }] };
        }

        // execute the update operations
        await Promise.all([
            BitModel.updateOne({ bitId }, bitUpdateOperations, bitUpdateOptions),
            UserModel.updateOne({ twitterId, 'inventory.foods.type': foodType }, userUpdateOperations),
            IslandModel.updateOne({ islandId: bit.placedIslandId }, islandUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(feedBit) Bit fed and energy replenished.`,
            data: {
                bitId: bitId,
                foodType: foodType,
            }
        }
    } catch (err: any) {
        console.log(`(feedBit) Error: ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(feedBit) Error: ${err.message}`
        }
    }
}

/**
 * Bulk feed all bits based on passed bitIds
 */
export const bulkFeedBits = async (userId: string, foodType: FoodType, bitIds: number[]): Promise<ReturnValue> => {
    try {
        const [user, workingBits] = await Promise.all([
            UserModel.findOne({ _id: userId }).lean(),
            BitModel.find({ 
                owner: userId, 
                placedIslandId: { $ne: 0 },
                "farmingStats.currentEnergy": {$lt: 100},
                bitId: { $in: bitIds }
            }).lean()
        ]);

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(bulkFeedBit) User not found.`
            }
        }

        if (!workingBits || workingBits.length <= 0) {
            return {
                status: Status.ERROR,
                message: `(bulkFeedBit) active Bits are not found.`
            }
        }

        // Check user owned foodType by comparing the amount and workingBits.length
        const userFood = (user.inventory?.foods as Food[]).find(food => food.type === foodType);
        if (!userFood || userFood.amount < workingBits.length) {
            return {
                status: Status.ERROR,
                message: `(bulkFeedBit) User does not have enough ${foodType}. Required ${workingBits.length} Quantity`
            }
        }

        // get based Energy to replenish from foodType
        const baseToReplenish = FOOD_ENERGY_REPLENISHMENT(foodType);

        // Prepare bulk write operations to feed bits
        const bulkWriteOpsPromises = workingBits.map(async (bit) => {
            // check if the bit has any modifiers that impact food consumption efficiency
            const foodConsumptionModifiers = bit.bitStatsModifiers?.foodConsumptionEfficiencyModifiers as Modifier[];
            const foodConsumptionMultiplier = foodConsumptionModifiers.reduce((acc, modifier) => acc * modifier.value, 1);

            const toReplenish = baseToReplenish * foodConsumptionMultiplier;

            // if the amount of energy to replenish is more than the amount of energy needed to reach 100, set the amount to replenish to the amount needed to reach 100
            const energyNeededToReach100 = 100 - bit.farmingStats?.currentEnergy;
            const actualToReplenish = Math.min(toReplenish, energyNeededToReach100);

            // check if the current energy is above the thresholds defined by `ENERGY_THRESHOLD_REDUCTIONS`. if so, check for prev. negative modifiers and update them.
            // here, we assume that `currentEnergy` is still the same because it was called before updating it, so we use `currentEnergy` instead of `currentEnergy + actualToReplenish`
            const currentEnergy: number = bit.farmingStats?.currentEnergy + actualToReplenish;
            const { gatheringRateReduction } = ENERGY_THRESHOLD_REDUCTIONS(currentEnergy);

            // Initialize updateOperations
            let updateOperations = [];

            // update the modifiers of the bit regardless based on the energy thresholds
            const gatheringRateModifier: Modifier = {
                origin: 'Energy Threshold Reduction',
                value: 1 - (gatheringRateReduction / 100)
            }

            // update the bit's `statsModifiers` with the new modifiers. check first if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`
            const gatheringRateModifiers = bit.bitStatsModifiers?.gatheringRateModifiers || [];

            // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
            const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');

            // if the modifier exists, update it; if not, push it
            if (gatheringRateModifierIndex !== -1) {
                // if the new gathering rate modifier is 1, remove the modifier
                if (gatheringRateModifier.value === 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $inc: { 'farmingStats.currentEnergy': actualToReplenish },
                                $pull: {
                                    'bitStatsModifiers.gatheringRateModifiers': {
                                        origin: 'Energy Threshold Reduction',
                                    },
                                },
                            },
                        },
                    });
                // if the new gathering rate modifier is not 1, push the modifier
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: {
                                    'bitStatsModifiers.gatheringRateModifiers.$[elem].value':
                                        gatheringRateModifier.value,
                                },
                                $inc: { 'farmingStats.currentEnergy': actualToReplenish },
                            },
                            arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }],
                        },
                    });
                }
            } else {
                // if the new gathering rate modifier is 1, only update the energy and don't push the modifier
                if (gatheringRateModifier.value === 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $inc: { 'farmingStats.currentEnergy': actualToReplenish },
                            },
                        },
                    });
                // if the new gathering rate modifier is not 1, push the modifier
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $inc: { 'farmingStats.currentEnergy': actualToReplenish },
                                $push: {
                                    'bitStatsModifiers.gatheringRateModifiers':
                                        gatheringRateModifier,
                                },
                            },
                        },
                    });
                }
            }

            return updateOperations;
        })

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteFeedOps = bulkWriteOpsArrays.flat().filter(op => op);

        if (bulkWriteFeedOps.length === 0) {
            console.log(`(bulkFeedBits) No bits to update.`);
            return;
        }

        // Update the user's food amount (reduce by number of bits fed)
        const userUpdateOperation = {
            $inc: { 'inventory.foods.$.amount': -workingBits.length }
        };

        // execute update operations
        await Promise.all([
            UserModel.updateOne({ _id: userId, 'inventory.foods.type': foodType}, userUpdateOperation),
            BitModel.bulkWrite(bulkWriteFeedOps)
        ]);
        
        return {
            status: Status.SUCCESS,
            message: `(bulkFeedBit) Successfully fed ${workingBits.length} bits.`,
            data: {
                fedBits: workingBits.map(bit => bit.bitId),
                foodType: foodType,
                foodUsed: workingBits.length
            }
        };
    } catch (err: any) {
        console.error(`(bulkFeedBit) Error for user ${userId}: ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(bulkFeedBit) Error: ${err.message}`
        }
    }
}

/**
 * Depletes all bits' energies by calculating their energy depletion rate.
 *
 * Called by a scheduler every 15 minutes.
 */
export const depleteEnergy = async (): Promise<void> => {
    try {
        // only deplete energy for bits that are placed in an island
        const bits = await BitModel.find({ placedIslandId: { $ne: 0 }, 'farmingStats.currentEnergy': { $gt: 0} }).lean();

        if (bits.length === 0 || !bits) {
            console.log(`(depleteEnergy) No bits found.`);
            return;
        }

        // prepare bulk write operations to update energy and modifiers
        const bulkWriteOpsPromises = bits.map(async (bit) => {
            // check if the island the bit is placed in is still active (i.e. gatheringEnd is still 0)
            const island = await IslandModel.findOne({ islandId: bit.placedIslandId }).lean();

            // if the island is not active, return an empty array (i.e. don't update the bit's energy)
            if (!island || island.islandResourceStats.gatheringEnd !== 0) {
                return [];
            }

            // get bit's current energy
            const currentEnergy = bit.farmingStats?.currentEnergy;

            // get the bit's energy depletion rate and divide it by 4 to get the depletion rate every 15 minutes
            const baseDepletionRate = bit.farmingStats?.currentEnergyDepletionRate / 4;

            // get (if applicable) the bit's energy rate modifiers. multiply the value to get the final depletion rate
            const energyRateModifiers = bit.bitStatsModifiers?.energyRateModifiers as Modifier[];
            const energyRateMultiplier = energyRateModifiers.reduce((acc, modifier) => acc * modifier.value, 1);

            const depletionRate = baseDepletionRate * energyRateMultiplier;

            // get the new energy
            const newEnergy = Math.max(currentEnergy - depletionRate, 0);

            // check if the new energy goes below a certain threshold
            const { gatheringRateReduction } =
                ENERGY_THRESHOLD_REDUCTIONS(newEnergy);

            let updateOperations = [];

            const gatheringRateModifier: Modifier = {
                origin: 'Energy Threshold Reduction',
                value: 1 - gatheringRateReduction / 100,
            };

            // update the bit's `statsModifiers` with the new modifiers. if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`, overwrite them, else push them
            const gatheringRateModifiers = bit.bitStatsModifiers
                ?.gatheringRateModifiers as Modifier[];

            // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
            const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex(
                (modifier: Modifier) =>
                    modifier.origin === 'Energy Threshold Reduction'
            );

            // if the modifier exists, update it
            if (gatheringRateModifierIndex !== -1) {
                // if the new gathering rate modifier is 1, remove the modifier, else, update it
                if (gatheringRateModifier.value === 1) {
                    console.log(
                        `Bit ID ${bit.bitId} - gathering rate modifier exists AND value is 1. updating energy and removing modifier`
                    );

                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                // decrement current energy by current energy - new energy (i.e. actual depletion rate)
                                $inc: { 'farmingStats.currentEnergy': -(currentEnergy - newEnergy) },
                                $pull: {
                                    'bitStatsModifiers.gatheringRateModifiers': {
                                        origin: 'Energy Threshold Reduction',
                                    },
                                },
                            },
                        },
                    });
                    // if the new gathering rate modifier is not 1, update it
                } else {
                    console.log(
                        `Bit ID ${bit.bitId} - gathering rate modifier exists AND value is not 1. updating energy and modifier`
                    );

                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: {
                                    'bitStatsModifiers.gatheringRateModifiers.$[elem].value':
                                        gatheringRateModifier.value,
                                },
                                // decrement current energy by current energy - new energy (i.e. actual depletion rate)
                                $inc: { 'farmingStats.currentEnergy': -(currentEnergy - newEnergy) },
                            },
                            arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }],
                        },
                    });
                }
                // if the modifier doesn't exist, push it
            } else {
                // if the new gathering rate modifier is 1, only update the energy and don't push the modifier
                if (gatheringRateModifier.value === 1) {
                    console.log(
                        `Bit ID ${bit.bitId} - gathering rate modifier does not exist AND value is 1. updating energy and NOT pushing modifier.`
                    );

                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                // decrement current energy by current energy - new energy (i.e. actual depletion rate)
                                $inc: { 'farmingStats.currentEnergy': -(currentEnergy - newEnergy) },
                            },
                        },
                    });
                    // if the new gathering rate modifier is not 1, push the modifier
                } else {
                    console.log(
                        `Bit ID ${bit.bitId} - gathering rate modifier does not exist AND value is not 1. updating energy and pushing modifier.`
                    );

                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                // decrement current energy by current energy - new energy (i.e. actual depletion rate)
                                $inc: { 'farmingStats.currentEnergy': -(currentEnergy - newEnergy) },
                                $push: {
                                    'bitStatsModifiers.gatheringRateModifiers':
                                        gatheringRateModifier,
                                },
                            },
                        },
                    });
                }
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op);

        if (bulkWriteOps.length === 0) {
            console.log(`(depleteEnergy) No bits to update.`);
            return;
        }

        // execute the bulk write operations
        await BitModel.bulkWrite(bulkWriteOps);

        console.log(`(depleteEnergy) Bits' energies depleted.`);
    } catch (err: any) {
        console.error(`(depleteEnergy) Error: ${err.message}`);
    }
};

/**
 * Adds a bit (e.g. when summoned via Bit Orb) to the database.
 */
export const addBitToDatabase = async (bit: Bit): Promise<ReturnValue> => {
    try {
        const newBit = new BitModel({
            _id: generateObjectId(),
            ...bit,
        });

        await newBit.save();

        return {
            status: Status.SUCCESS,
            message: `(addBitToDatabase) Bit added to database.`,
            data: {
                bit: newBit,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addBitToDatabase) Error: ${err.message}`,
        };
    }
};

/**
 * Fetches the latest bit id from the database.
 */
export const getLatestBitId = async (): Promise<ReturnValue> => {
    try {
        const bitId = await redis.get('counter.bitId');

        // check if the bitId was already set in Redis
        if (!bitId) {
            // sort the bit ids in descending order and get the first one
            const latestBit = await BitModel.findOne().sort({ bitId: -1 }).lean();

            // set the counter to the latest bit
            await redis.set('counter.bitId', latestBit?.bitId ?? 0);
        }

        // increment the bit id counter
        const nextBitId = await redis.incr('counter.bitId');

        return {
            status: Status.SUCCESS,
            message: `(getLatestBitId) Latest bit id fetched.`,
            data: {
                latestBitId: nextBitId ?? 0,
            },
        };
    } catch (err: any) {        
        return {
            status: Status.ERROR,
            message: `(getLatestBitId) Error: ${err.message}`,
        };
    }
};

/**
 * Randomizes the farming stats of a Bit.
 */
export const randomizeFarmingStats = (rarity: BitRarity): BitFarmingStats => {
    // get the default gathering rate
    const defaultGatheringRate = DEFAULT_GATHERING_RATE(rarity);
    // get the default gathering rate growth
    const defaultGatheringRateGrowth = DEFAULT_GATHERING_RATE_GROWTH(rarity);
    // get the base energy depletion rate
    const baseEnergyDepletionRate = DEFAULT_ENERGY_DEPLETION_RATE(rarity);

    // rand from 0.9 to 1.1 to determine base gathering rate (and also current gathering rate since it's at level 1), gathering rate growth,
    // earning rate (and also current earning rate since it's at level 1) and earning rate growth
    const rand1 = Math.random() * 0.2 + 0.9;

    const baseGatheringRate = defaultGatheringRate * rand1;

    // rand from 0.9 to 1.1 to determine gathering rate growth
    const gatheringRateGrowth =
        defaultGatheringRateGrowth * rand1;

    return {
        baseGatheringRate,
        gatheringRateGrowth,
        currentEnergyDepletionRate: baseEnergyDepletionRate,
        currentEnergy: 100,
    };
};

/**
 * Calculates the current gathering rate of the bit (at level `bitLevel`).
 *
 * Note that bits with 0 energy will have a reduction of 100% in the gathering rate per being added via `modifiers`, so the overall rate returned will be 0.
 */
export const calcBitGatheringRate = (
    // base gathering rate
    baseRate: number,
    bitLevel: number,
    // initial gathering growth rate
    initialGrowthRate: number,
    // gathering OR earning rate modifiers from `BitStatsModifiers`
    modifiers: Modifier[]
): number => {
    //  get the final modifier multiplier based on all the modifiers
    const modifierMultiplier = modifiers.reduce((acc, modifier) => acc * modifier.value, 1);

    // choose which exponential decay to use
    const expDecay = GATHERING_RATE_EXPONENTIAL_DECAY;

    return (
        (baseRate +
            (bitLevel - 1) *
            initialGrowthRate *
            Math.exp(-expDecay * (bitLevel - 1))) *
        modifierMultiplier
    );
};

/**
 * Gets one or multiple bits based on the IDs.
 */
export const getBits = async (bitIds: number[]): Promise<ReturnValue> => {
    try {
        const bits = await BitModel.find({ bitId: { $in: bitIds } }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getBits) Bits fetched.`,
            data: {
                bits,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getBits) Error: ${err.message}`,
        };
    }
};
