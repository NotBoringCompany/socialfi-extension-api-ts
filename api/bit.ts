import { ReturnValue, Status } from '../utils/retVal';
import { Bit, BitFarmingStats, BitNameData, BitRarity, BitType } from '../models/bit';
import {
    BASE_ENERGY_DEPLETION_RATE,
    BIT_EVOLUTION_COST,
    DEFAULT_EARNING_RATE,
    DEFAULT_EARNING_RATE_GROWTH,
    DEFAULT_GATHERING_RATE,
    DEFAULT_GATHERING_RATE_GROWTH,
    ENERGY_THRESHOLD_REDUCTIONS,
    FREE_BIT_EVOLUTION_COST,
    MAX_BIT_LEVEL,
    RANDOMIZE_GENDER,
    getBitStatsModifiersFromTraits,
    randomizeBitTraits,
} from '../utils/constants/bit';
import {
    EARNING_RATE_EXPONENTIAL_DECAY,
    GATHERING_RATE_EXPONENTIAL_DECAY,
} from '../utils/constants/island';
import { RateType } from '../models/island';
import { Modifier } from '../models/modifier';
import { Food, FoodType } from '../models/food';
import { FOOD_ENERGY_REPLENISHMENT } from '../utils/constants/food';
import { BarrenResource, ExtendedResource } from '../models/resource';
import { generateObjectId } from '../utils/crypto';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
import { ObtainMethod } from '../models/obtainMethod';

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

        // xterio bits are always uncommon due to the logic from the game mechanics
        const rarity = BitRarity.UNCOMMON;

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
            premium: true,
            owner: user._id,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.XTERIO,
            placedIslandId: 0,
            lastRelocationTimestamp: 0,
            currentFarmingLevel: 1,
            farmingStats: randomizeFarmingStats(rarity),
            traits,
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
            const earningRateModifiers = islandStatsModifiers?.earningRateModifiers as Modifier[];
            const resourceCapModifiers = islandStatsModifiers?.resourceCapModifiers as Modifier[];

            // check if the `gatheringRateModifiers` contain a modifier related to this bit
            const gatheringRateModifierIndex = gatheringRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
            const earningRateModifierIndex = earningRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
            const resourceCapModifierIndex = resourceCapModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));

            // if the modifier exists, remove it
            if (gatheringRateModifierIndex !== -1) {
                islandUpdateOperations.$pull['islandStatsModifiers.gatheringRateModifiers'] = gatheringRateModifiers[gatheringRateModifierIndex];
            }

            if (earningRateModifierIndex !== -1) {
                islandUpdateOperations.$pull['islandStatsModifiers.earningRateModifiers'] = earningRateModifiers[earningRateModifierIndex];
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
                    const earningRateModifiers = otherBitStatsModifiers?.earningRateModifiers as Modifier[];
                    const energyRateModifiers = otherBitStatsModifiers?.energyRateModifiers as Modifier[];
                    const foodConsumptionEfficiencyModifiers = otherBitStatsModifiers?.foodConsumptionEfficiencyModifiers as Modifier[];

                    const gatheringRateModifierIndex = gatheringRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
                    const earningRateModifierIndex = earningRateModifiers.findIndex((modifier: Modifier) => modifier.origin.includes(`Bit ID #${bitId}`));
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

                    if (earningRateModifierIndex !== -1) {
                        bitUpdateOperations.push({
                            bitId: otherBit.bitId,
                            updateOperations: {
                                $pull: { 'bitStatsModifiers.earningRateModifiers': earningRateModifiers[earningRateModifierIndex] },
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
                bitId: bitId
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

        const { gatheringRateReduction, earningRateReduction } = ENERGY_THRESHOLD_REDUCTIONS(currentEnergy);

        // update the modifiers of the bit regardless based on the energy thresholds
        const gatheringRateModifier: Modifier = {
            origin: 'Energy Threshold Reduction',
            value: 1 - (gatheringRateReduction / 100)
        }

        const earningRateModifier: Modifier = {
            origin: 'Energy Threshold Reduction',
            value: 1 - (earningRateReduction / 100)
        }

        // update the bit's `statsModifiers` with the new modifiers. check first if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`
        const gatheringRateModifiers = bit.bitStatsModifiers?.gatheringRateModifiers;
        const earningRateModifiers = bit.bitStatsModifiers?.earningRateModifiers;

        // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
        const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');
        const earningRateModifierIndex = earningRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');

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

        if (earningRateModifierIndex !== -1) {
            // if the new earning rate modifier is 1, remove the modifier
            if (earningRateModifier.value === 1) {
                bitUpdateOperations.$pull['bitStatsModifiers.earningRateModifiers'] = { origin: 'Energy Threshold Reduction' };
            } else {
                bitUpdateOperations.$set[`bitStatsModifiers.earningRateModifiers.$[elem].value`] = earningRateModifier.value;
            }
        } else {
            bitUpdateOperations.$push['bitStatsModifiers.earningRateModifiers'] = earningRateModifier;
        }

        let bitUpdateOptions = {};

        // set the array filters for the bit update operations if gathering rate and earning rate modifier values are not 1
        if (gatheringRateModifier.value !== 1 && earningRateModifier.value !== 1) {
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
                bitId: bitId
            }
        }
    } catch (err: any) {
        console.log('(feedBit) Error: ', err.message);
        return {
            status: Status.ERROR,
            message: `(feedBit) Error: ${err.message}`
        }
    }
}

/**
 * Depletes all bits' energies by calculating their energy depletion rate.
 *
 * Called by a scheduler every 3 minutes.
 */
export const depleteEnergy = async (): Promise<void> => {
    try {
        // only deplete energy for bits that are placed in an island
        const bits = await BitModel.find({ placedIslandId: { $ne: 0 } }).lean();

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

            // get the bit's energy depletion rate and divide it by 6 to get the depletion rate every 3 minutes
            const baseDepletionRate = bit.farmingStats?.currentEnergyDepletionRate / 20;

            // get (if applicable) the bit's energy rate modifiers. multiply the value to get the final depletion rate
            const energyRateModifiers = bit.bitStatsModifiers?.energyRateModifiers as Modifier[];
            const energyRateMultiplier = energyRateModifiers.reduce((acc, modifier) => acc * modifier.value, 1);

            const depletionRate = baseDepletionRate * energyRateMultiplier;

            // calculate the new energy (if currentEnergy - depletionRate is less than 0, set it to 0)
            const newEnergy = Math.max(currentEnergy - depletionRate, 0);

            // check if the new energy goes below a certain threshold
            const { gatheringRateReduction, earningRateReduction } =
                ENERGY_THRESHOLD_REDUCTIONS(newEnergy);

            let updateOperations = [];

            const gatheringRateModifier: Modifier = {
                origin: 'Energy Threshold Reduction',
                value: 1 - gatheringRateReduction / 100,
            };

            const earningRateModifier: Modifier = {
                origin: 'Energy Threshold Reduction',
                value: 1 - earningRateReduction / 100,
            };

            // update the bit's `statsModifiers` with the new modifiers. if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`, overwrite them, else push them
            const gatheringRateModifiers = bit.bitStatsModifiers
                ?.gatheringRateModifiers as Modifier[];
            const earningRateModifiers = bit.bitStatsModifiers
                ?.earningRateModifiers as Modifier[];

            // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
            const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex(
                (modifier: Modifier) =>
                    modifier.origin === 'Energy Threshold Reduction'
            );
            // check if the `earningRateModifiers` already has a modifier called `Energy Threshold Reduction`
            const earningRateModifierIndex = earningRateModifiers?.findIndex(
                (modifier: Modifier) =>
                    modifier.origin === 'Energy Threshold Reduction'
            );

            // if the modifier exists, update it
            if (gatheringRateModifierIndex !== -1) {
                // if the new gathering rate modifier is 1, remove the modifier, else, update it
                if (gatheringRateModifier.value === 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: { 'farmingStats.currentEnergy': newEnergy },
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
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: {
                                    'farmingStats.currentEnergy': newEnergy,
                                    'bitStatsModifiers.gatheringRateModifiers.$[elem].value':
                                        gatheringRateModifier.value,
                                },
                            },
                            arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }],
                        },
                    });
                }
                // if the modifier doesn't exist, push it
            } else {
                // if the new gathering rate modifier is 1, only update the energy and don't push the modifier
                if (gatheringRateModifier.value === 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: { 'farmingStats.currentEnergy': newEnergy },
                            },
                        },
                    });
                    // if the new gathering rate modifier is not 1, push the modifier
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: { 'farmingStats.currentEnergy': newEnergy },
                                $push: {
                                    'bitStatsModifiers.gatheringRateModifiers':
                                        gatheringRateModifier,
                                },
                            },
                        },
                    });
                }
            }

            // at this point, we've already updated the gathering rate modifier AND the energy. We don't need to update the energy anymore.
            if (earningRateModifierIndex !== -1) {
                // if the new earning rate modifier is 1, remove modifier
                if (earningRateModifier.value === 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $pull: {
                                    'bitStatsModifiers.earningRateModifiers': {
                                        origin: 'Energy Threshold Reduction',
                                    },
                                },
                            },
                        },
                    });
                    // if the new earning rate modifier is not 1, update it
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $set: {
                                    'farmingStats.currentEnergy': newEnergy,
                                    'bitStatsModifiers.earningRateModifiers.$[elem].value':
                                        earningRateModifier.value,
                                },
                            },
                            arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }],
                        },
                    });
                }
                // if the modifier doesn't exist, push it
            } else {
                // if the new earning rate modifier is not 1, push the modifier, else, do nothing (since energy is already updated)
                if (earningRateModifier.value !== 1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { bitId: bit.bitId },
                            update: {
                                $push: {
                                    'bitStatsModifiers.earningRateModifiers':
                                        earningRateModifier,
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
 * (User) Evolves a bit to the next level (levelling it up).
 * 
 * Premium bits require xCookies, while non-premium bits require seaweed.
 *
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the bit ID.
 */
export const evolveBit = async (
    twitterId: string,
    bitId: number
): Promise<ReturnValue> => {
    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean()
        ]);

        let bitUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        };

        let userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        // Track consumed Currency
        let totalPaid: number
        let paymentChoice: 'xCookies' | 'seaweed';

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(evolveBit) User not found.`,
            };
        }

        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(evolveBit) User does not own the bit.`,
            };
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(evolveBit) Bit not found.`,
            };
        }

        // check if the bit is already placed in an island to start evolving
        if (bit.placedIslandId === 0) {
            return {
                status: Status.ERROR,
                message: `(evolveBit) Bit is not placed in an island.`,
            };
        }

        // check if the bit is already at max level
        if (bit.currentFarmingLevel >= MAX_BIT_LEVEL(<BitRarity>bit.rarity)) {
            return {
                status: Status.ERROR,
                message: `(evolveBit) Bit is already at max level.`,
            };
        }

        // if bit is premium, check if the user has enough xCookies to evolve the bit
        if (bit.premium) {
            // check if the user has enough xCookies to evolve the bit
            const userXCookies = user.inventory?.xCookieData.currentXCookies;

            // calculate the cost to evolve the bit to the next level
            const requiredXCookies = BIT_EVOLUTION_COST(bit.currentFarmingLevel);
            totalPaid = requiredXCookies;
            paymentChoice = 'xCookies';

            // if not enough xCookies, return an error
            if (userXCookies < requiredXCookies) {
                return {
                    status: Status.ERROR,
                    message: `(evolveBit) Not enough xCookies to evolve the bit.`,
                };
            }

            // deduct the required xCookies from the user's inventory. increase the `totalXCookiesSpent` and `weeklyXCookiesSpent` by the required xCookies
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = requiredXCookies;

            // increase the bit's current farming level by 1
            bitUpdateOperations.$inc['currentFarmingLevel'] = 1;
        // if bit is not premium, check if the user has enough seaweed to evolve the bit
        } else {
            const userSeaweed = (user.inventory?.resources as ExtendedResource[]).find(resource => resource.type === BarrenResource.SEAWEED);

            const requiredSeaweed = FREE_BIT_EVOLUTION_COST(bit.currentFarmingLevel);
            totalPaid = requiredSeaweed;
            paymentChoice = 'seaweed';

            // if not enough seaweed, return an error
            if (!userSeaweed || userSeaweed.amount < requiredSeaweed) {
                return {
                    status: Status.ERROR,
                    message: `(evolveBit) Not enough seaweed to evolve the bit.`,
                };
            }

            const userSeaweedIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === BarrenResource.SEAWEED);
            // deduct the required seaweed from the user's inventory
            userUpdateOperations.$inc[`inventory.resources.${userSeaweedIndex}.amount`] = -requiredSeaweed;

            // increase the bit's current farming level by 1
            bitUpdateOperations.$inc['currentFarmingLevel'] = 1;
        }

        // execute the update operations
        await Promise.all([
            BitModel.updateOne({ bitId }, bitUpdateOperations),
            UserModel.updateOne({ twitterId }, userUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(evolveBit) Bit evolved to the next level.`,
            data: {
                bitId: bitId,
                currentLevel: bit.currentFarmingLevel,
                nextLevel: bit.currentFarmingLevel + 1,
                totalPaid,
                paymentChoice,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(evolveBit) Error: ${err.message}`,
        };
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
        // sort the bit ids in descending order and get the first one
        const latestBit = await BitModel.findOne().sort({ bitId: -1 }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getLatestBitId) Latest bit id fetched.`,
            data: {
                latestBitId: latestBit ? latestBit.bitId : 0,
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
    // get the default earning rate
    const defaultEarningRate = DEFAULT_EARNING_RATE(rarity);
    // get the default earning rate growth
    const defaultEarningRateGrowth = DEFAULT_EARNING_RATE_GROWTH(rarity);
    // get the base energy depletion rate
    const baseEnergyDepletionRate = BASE_ENERGY_DEPLETION_RATE;

    // rand from 0.9 to 1.1 to determine base gathering rate (and also current gathering rate since it's at level 1), gathering rate growth,
    // earning rate (and also current earning rate since it's at level 1) and earning rate growth
    const rand1 = Math.random() * 0.2 + 0.9;

    const baseGatheringRate = defaultGatheringRate * rand1;

    // rand from 0.9 to 1.1 to determine gathering rate growth
    const gatheringRateGrowth =
        defaultGatheringRateGrowth * rand1;

    // rand from 0.9 to 1.1 to determine base earning rate (and also current earning rate since it's at level 1)
    const baseEarningRate = defaultEarningRate * rand1;

    // rand from 0.9 to 1.1 to determine earning rate growth
    const earningRateGrowth = defaultEarningRateGrowth * rand1;

    return {
        baseGatheringRate,
        gatheringRateGrowth,
        baseEarningRate,
        earningRateGrowth,
        currentEnergyDepletionRate: baseEnergyDepletionRate,
        currentEnergy: 100,
    };
};

/**
 * Calculates the current gathering OR earning rate of the bit (at level `bitLevel`).
 *
 * Since both rates use the same formula, only the parameters need to be adjusted according to which rate wants to be calculated.
 *
 * Note that bits with 0 energy will have a reduction of 100% in the gathering/earning rate per being added via `modifiers`, so the overall rate returned will be 0.
 */
export const calcBitCurrentRate = (
    type: RateType,
    // base gathering/earning rate
    baseRate: number,
    bitLevel: number,
    // initial gathering/earning growth rate
    initialGrowthRate: number,
    // gathering OR earning rate modifiers from `BitStatsModifiers`
    modifiers: Modifier[]
): number => {
    //  get the final modifier multiplier based on all the modifiers
    const modifierMultiplier = modifiers.reduce((acc, modifier) => acc * modifier.value, 1);

    // choose which exponential decay to use
    const expDecay =
        type === RateType.GATHERING
            ? GATHERING_RATE_EXPONENTIAL_DECAY
            : EARNING_RATE_EXPONENTIAL_DECAY;

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
