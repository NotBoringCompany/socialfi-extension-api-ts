import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitFarmingStats, BitRarity } from '../models/bit';
import {
  BASE_ENERGY_DEPLETION_RATE,
  BIT_EVOLUTION_COST,
  BIT_RAFT_EVOLUTION_COST,
  DEFAULT_EARNING_RATE,
  DEFAULT_EARNING_RATE_GROWTH,
  DEFAULT_GATHERING_RATE,
  DEFAULT_GATHERING_RATE_GROWTH,
  ENERGY_THRESHOLD_REDUCTIONS,
  MAX_BIT_LEVEL,
  MAX_BIT_LEVEL_RAFT,
} from '../utils/constants/bit';
import {
  EARNING_RATE_EXPONENTIAL_DECAY,
  GATHERING_RATE_EXPONENTIAL_DECAY,
} from '../utils/constants/island';
import { RateType } from '../models/island';
import { Modifier } from '../models/modifier';
import { UserSchema } from '../schemas/User';
import { IslandSchema } from '../schemas/Island';
import { Food, FoodType } from '../models/food';
import { FOOD_ENERGY_REPLENISHMENT } from '../utils/constants/food';
import { Resource, ResourceType } from '../models/resource';
import { generateObjectId } from '../utils/crypto';
import { shop } from '../utils/shop';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';

/**
 * (User) Feeds a bit some food and replenishes its energy.
 */
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
        const toReplenish = FOOD_ENERGY_REPLENISHMENT(foodType);

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

        // then, update the bit's `totalXCookiesSpent` by 90% of the cost of food
        const foodCost = shop.foods.find(food => food.type === foodType)?.xCookies * 0.9;
        bitUpdateOperations.$inc['totalXCookiesSpent'] = foodCost;

        // if the bit is placed in an island, update the island's `totalXCookiesSpent` by the cost of the food
        if (bit.placedIslandId !== 0) {
            const island = await IslandModel.findOne({ islandId: bit.placedIslandId }).lean();

            if (!island) {
                return {
                    status: Status.ERROR,
                    message: `(feedBit) Island not found.`
                }
            }

            // if island's total xCookiesSpent is zero, update the `totalXCookiesSpent` AND start the `earningStart`
            if (island.islandEarningStats?.totalXCookiesSpent === 0) {
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = foodCost;
                islandUpdateOperations.$set['islandEarningStats.earningStart'] = Math.floor(Date.now() / 1000);
            } else {
                // otherwise, just update the `totalXCookiesSpent`
                islandUpdateOperations.$inc['islandEarningStats.totalXCookiesSpent'] = foodCost;
            }
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
            message: `(feedBit) Bit fed and energy replenished. Cookies spent added to bit's (and possibly the island the bit was placed in's) totalXCookiesSpent.`,
            data: {
                bitId: bitId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(feedBit) Error: ${err.message}`
        }
    }
}

/**
 * Depletes all bits' energies by calculating their energy depletion rate.
 *
 * Called by a scheduler every 10 minutes.
 */
export const depleteEnergy = async (): Promise<void> => {
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');

  try {
    const bits = await Bit.find();

    if (bits.length === 0 || !bits) {
      console.log(`(depleteEnergy) No bits found.`);
      return;
    }

    // prepare bulk write operations to update energy and modifiers
    const bulkWriteOperations = bits
      .map((bit) => {
        // if bit isn't placed on a raft or an island, don't deplete energy for this bit
        if (bit.placedRaftId === 0 && bit.placedIslandId === 0) {
          console.log(
            `(depleteEnergy) Bit ${bit.bitId} - not placed in a raft or an island. Skipping.`
          );
          return [];
        }

        // get bit's current energy
        const currentEnergy = bit.farmingStats?.currentEnergy;

        // get the bit's energy depletion rate and divide it by 6 to get the depletion rate every 10 minutes
        const depletionRate = bit.farmingStats?.currentEnergyDepletionRate / 6;

        // calculate the new energy (can go negative)
        // if current energy is already 0 or lower, `newEnergy` will be the same.
        const newEnergy =
          currentEnergy <= 0 ? currentEnergy : currentEnergy - depletionRate;

        console.log(
          `(depleteEnergy) Bit ${bit.bitId} - current energy is less than 0? ${
            currentEnergy <= 0
          } - depletion rate: ${depletionRate}`
        );
        console.log(
          `(depleteEnergy) Bit ${bit.bitId} - Current Energy: ${currentEnergy}, New Energy: ${newEnergy}`
        );

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
            console.log(
              `Bit ID ${bit.bitId} - gathering rate modifier exists AND value is 1. updating energy and removing modifier`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - gathering rate modifier exists AND value is not 1. updating energy and modifier`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - gathering rate modifier does not exist AND value is 1. updating energy and NOT pushing modifier.`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - gathering rate modifier does not exist AND value is not 1. updating energy and pushing modifier.`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - earning rate modifier exists AND value is 1. removing modifier`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - earning rate modifier exists AND value is not 1. updating modifier`
            );

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
            console.log(
              `Bit ID ${bit.bitId} - earning rate modifier does not exist AND value is not 1. pushing modifier`
            );

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
          } else {
            console.log(
              `Bit ID ${bit.bitId} - earning rate modifier does not exist AND value is 1. doing nothing.`
            );
          }
        }

        return updateOperations;
      })
      .flat();

    // execute the bulk write operations
    await Bit.bulkWrite(bulkWriteOperations);

    console.log(`(depleteEnergy) Bits' energies depleted.`);
  } catch (err: any) {
    console.error(`(depleteEnergy) Error: ${err.message}`);
  }
};

// /**
//  * Depletes a bit's energy given their `bitId` by calculating their energy depletion rate.
//  *
//  * Called by a scheduler every 10 minutes.
//  */
// export const depleteEnergy = async (bitId: number): Promise<ReturnValue> => {
//     const Bit = mongoose.model('Bits', BitSchema, 'Bits');

//     try {
//         const bit = await Bit.findOne({ bitId });

//         if (!bit) {
//             return {
//                 status: Status.ERROR,
//                 message: `(depleteEnergy) Bit not found.`
//             }
//         }

//         // get bit's current energy
//         const currentEnergy = bit.farmingStats?.currentEnergy;

//         // divide base energy depletion rate by 6 to get the depletion rate every 10 minutes
//         const depletionRate = BASE_ENERGY_DEPLETION_RATE / 6;

//         // calculate the new energy (can go negative)
//         const newEnergy = currentEnergy - depletionRate;

//         // check if the new energy goes below a certain threshold
//         const { gatheringRateReduction, earningRateReduction } = ENERGY_THRESHOLD_REDUCTIONS(newEnergy);

//         // instant double check if both values aren't 0 (because it can't be that 1 value is 0 and the other is not)
//         if (gatheringRateReduction !== 0 && earningRateReduction !== 0) {
//             const gatheringRateModifier: Modifier = {
//                 origin: 'Energy Threshold Reduction',
//                 value: 1 - (gatheringRateReduction / 100)
//             };

//             const earningRateModifier: Modifier = {
//                 origin: 'Energy Threshold Reduction',
//                 value: 1 - (earningRateReduction / 100)
//             };

//             // update the bit's `statsModifiers` with the new modifiers. if the `bitStatsModifiers` already has modifiers called `Energy Threshold Reduction`, overwrite them, else push them
//             const gatheringRateModifiers = bit.bitStatsModifiers?.gatheringRateModifiers as Modifier[];
//             const earningRateModifiers = bit.bitStatsModifiers?.earningRateModifiers as Modifier[];

//             // check if the `gatheringRateModifiers` already has a modifier called `Energy Threshold Reduction`
//             const gatheringRateModifierIndex = gatheringRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');
//             // check if the `earningRateModifiers` already has a modifier called `Energy Threshold Reduction`
//             const earningRateModifierIndex = earningRateModifiers?.findIndex((modifier: Modifier) => modifier.origin === 'Energy Threshold Reduction');

//             // if the modifier exists, update it; if not, push it
//             if (gatheringRateModifierIndex !== -1) {
//                 await Bit.updateOne({ bitId }, { $set: { 'bitStatsModifiers.gatheringRateModifiers.$[elem].value': gatheringRateModifier.value } }, { arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }] });
//             } else {
//                 await Bit.updateOne({ bitId }, { $push: { 'bitStatsModifiers.gatheringRateModifiers': gatheringRateModifier } });
//             }

//             if (earningRateModifierIndex !== -1) {
//                 await Bit.updateOne({ bitId }, { $set: { 'bitStatsModifiers.earningRateModifiers.$[elem].value': earningRateModifier.value } }, { arrayFilters: [{ 'elem.origin': 'Energy Threshold Reduction' }] });
//             } else {
//                 await Bit.updateOne({ bitId }, { $push: { 'bitStatsModifiers.earningRateModifiers': earningRateModifier } });
//             }
//         }

//         // update the bit's current energy
//         await Bit.updateOne({ bitId }, { $set: { 'farmingStats.currentEnergy': newEnergy } });

//         return {
//             status: Status.SUCCESS,
//             message: `(depleteEnergy) Bit's energy depleted.`,
//             data: {
//                 bitId: bitId
//             }
//         }
//     } catch (err: any) {
//         return {
//             status: Status.ERROR,
//             message: `(depleteEnergy) Error: ${err.message}`
//         }
//     }
// }

/**
 * (User) Evolves a bit to the next level (levelling it up). !!!ONLY FOR LEVELLING UP IN ISLANDS!!!
 *
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the bit ID.
 */
export const evolveBit = async (
  twitterId: string,
  bitId: number
): Promise<ReturnValue> => {
  const User = mongoose.model('Users', UserSchema, 'Users');
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');
  const Island = mongoose.model('Islands', IslandSchema, 'Islands');

  try {
    // first, check if the user owns the bit
    const user = await User.findOne({ twitterId });

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

    // ensure that the bit exists
    const bit = await Bit.findOne({ bitId });

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

    // check if the user has enough xCookies to evolve the bit
    const userXCookies = user.inventory?.xCookies;

    // calculate the cost to evolve the bit to the next level
    const requiredXCookies = BIT_EVOLUTION_COST(bit.currentFarmingLevel);

    // if not enough xCookies, return an error
    if (userXCookies < requiredXCookies) {
      return {
        status: Status.ERROR,
        message: `(evolveBit) Not enough xCookies to evolve the bit.`,
      };
    }

    // deduct the required xCookies from the user's inventory
    await User.updateOne(
      { twitterId },
      { $inc: { 'inventory.xCookies': -requiredXCookies } }
    );

    // increase the bit's current farming level by 1 and increment the `totalXCookiesSpent` by `requiredXCookies`
    await Bit.updateOne(
      { bitId },
      { $inc: { currentFarmingLevel: 1, totalXCookiesSpent: requiredXCookies } }
    );

    // check if the bit has a `placedIslandId`. if yes, update the island's `totalXCookiesSpent` by `requiredXCookies` and if required, start the `earningStart` if the island previously has 0 totalXCookiesSpent.
    if (bit.placedIslandId !== 0) {
      const island = await Island.findOne({ islandId: bit.placedIslandId });

      if (!island) {
        return {
          status: Status.ERROR,
          message: `(evolveBit) Island not found.`,
        };
      }

      const islandTotalXCookiesSpentIsZero =
        island.islandEarningStats?.totalXCookiesSpent === 0;

      // if island's total xCookiesSpent is zero, update the `totalXCookiesSpent` AND start the `earningStart`
      if (islandTotalXCookiesSpentIsZero) {
        await Island.updateOne(
          { islandId: bit.placedIslandId },
          {
            $inc: { 'islandEarningStats.totalXCookiesSpent': requiredXCookies },
            'islandEarningStats.earningStart': Math.floor(Date.now() / 1000),
          }
        );
        // otherwise, just update the `totalXCookiesSpent`
      } else {
        await Island.updateOne(
          { islandId: bit.placedIslandId },
          {
            $inc: { 'islandEarningStats.totalXCookiesSpent': requiredXCookies },
          }
        );
      }
    }

    return {
      status: Status.SUCCESS,
      message: `(evolveBit) Bit evolved to the next level.`,
      data: {
        bitId: bitId,
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
 * (User) Evolves a bit to the next level (levelling it up). !!!ONLY FOR LEVELLING UP IN RAFTS!!!
 *
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the bit ID.
 */
export const evolveBitInRaft = async (
  twitterId: string,
  bitId: number
): Promise<ReturnValue> => {
  const User = mongoose.model('Users', UserSchema, 'Users');
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');

  try {
    // first, check if the user owns the bit
    const user = await User.findOne({ twitterId });

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) User not found.`,
      };
    }

    // check if the user owns the bit
    if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) User does not own the bit.`,
      };
    }

    // ensure that the bit exists
    const bit = await Bit.findOne({ bitId });

    if (!bit) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) Bit not found.`,
      };
    }

    // check if the bit is already placed in the raft to start evolving
    if (bit.placedRaftId === 0) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) Bit is not placed in a raft.`,
      };
    }

    // check if the bit is already at max level
    if (bit.currentFarmingLevel >= MAX_BIT_LEVEL_RAFT) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) Bit is already at max level.`,
      };
    }

    // check if the user has enough seaweed to evolve the bit
    const userSeaweed = (user.inventory?.resources as Resource[]).find(
      (resource) => resource.type === ResourceType.SEAWEED
    );

    if (!userSeaweed || userSeaweed.amount === 0) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) Not enough seaweed to evolve the bit.`,
      };
    }

    // calculate the cost to evolve the bit to the next level
    const requiredSeaweed = BIT_RAFT_EVOLUTION_COST(bit.currentFarmingLevel);

    // if not enough seaweed, return an error
    if (userSeaweed.amount < requiredSeaweed) {
      return {
        status: Status.ERROR,
        message: `(evolveBitInRaft) Not enough seaweed to evolve the bit.`,
      };
    }

    // deduct the required seaweed from the user's inventory
    await User.updateOne(
      { twitterId, 'inventory.resources.type': ResourceType.SEAWEED },
      { $inc: { 'inventory.resources.$.amount': -requiredSeaweed } }
    );

    // increase the bit's current farming level by 1
    await Bit.updateOne({ bitId }, { $inc: { currentFarmingLevel: 1 } });

    return {
      status: Status.SUCCESS,
      message: `(evolveBitInRaft) Bit evolved to the next level.`,
      data: {
        bitId: bitId,
      },
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(evolveBitInRaft) Error: ${err.message}`,
    };
  }
};

/**
 * Adds a bit (e.g. when summoned via Bit Orb) to the database.
 */
export const addBitToDatabase = async (bit: Bit): Promise<ReturnValue> => {
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');

  try {
    const newBit = new Bit({
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
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');

  try {
    const latestBitId = await Bit.countDocuments();

    return {
      status: Status.SUCCESS,
      message: `(getLatestBitId) Latest bit id fetched.`,
      data: {
        latestBitId,
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

  // rand from 0.9 to 1.1 to determine base gathering rate (and also current gathering rate since it's at level 1)
  const randGatheringRate = Math.random() * 0.2 + 0.9;
  const baseGatheringRate = defaultGatheringRate * randGatheringRate;

  // rand from 0.9 to 1.1 to determine gathering rate growth
  const randGatheringRateGrowth = Math.random() * 0.2 + 0.9;
  const gatheringRateGrowth =
    defaultGatheringRateGrowth * randGatheringRateGrowth;

  // rand from 0.9 to 1.1 to determine base earning rate (and also current earning rate since it's at level 1)
  const randEarningRate = Math.random() * 0.2 + 0.9;
  const baseEarningRate = defaultEarningRate * randEarningRate;

  // rand from 0.9 to 1.1 to determine earning rate growth
  const randEarningRateGrowth = Math.random() * 0.2 + 0.9;
  const earningRateGrowth = defaultEarningRateGrowth * randEarningRateGrowth;

  // rand from 0.75 to 1.25 to determine current energy depletion rate
  const randEnergyDepletionRate = Math.random() * 0.5 + 0.75;
  const currentEnergyDepletionRate =
    baseEnergyDepletionRate * randEnergyDepletionRate;

  return {
    baseGatheringRate,
    gatheringRateGrowth,
    baseEarningRate,
    earningRateGrowth,
    currentEnergyDepletionRate,
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
  let modifierMultiplier = 1;

  // check if modifiers is not empty; if not empty, multiply each modifier's amount to the modifierMultiplier
  if (modifiers.length > 0) {
    modifiers.forEach((modifier) => {
      modifierMultiplier *= modifier.value;
    });
  }

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
  const Bit = mongoose.model('Bits', BitSchema, 'Bits');

  try {
    const bits = await Bit.find({ bitId: { $in: bitIds } });

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
