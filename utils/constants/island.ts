import Bull from 'bull';
import { BitRarity, BitTrait, BitTraitData } from '../../models/bit';
import {
  IslandTappingData,
  IslandTrait,
  IslandType,
  RarityDeviationReduction,
  ResourceDropChance,
  ResourceDropChanceDiff,
  TappingMilestoneBonusReward,
  TappingMilestoneReward,
} from '../../models/island';
import { TerraCapsulatorType } from '../../models/item';
import { BitModel, IslandModel, UserModel } from './db';
import { ExtendedResource, ExtendedResourceOrigin, Resource, ResourceRarity, ResourceRarityNumeric } from '../../models/resource';
import { randomizeResourceFromChances } from '../../api/island';
import { Status } from '../retVal';
import { resources } from './resource';

/** max level for any island type */
export const MAX_ISLAND_LEVEL = 20;

/** claim cooldown for claiming resources (in seconds) */
export const RESOURCES_CLAIM_COOLDOWN = 10;

/** claim cooldown for claiming xCookies [FROM THE ISLAND] (in seconds) */
export const X_COOKIE_CLAIM_COOLDOWN = 10;

/** reduction modifier for effective gathering rate for having multiple bits on an island */
export const GATHERING_RATE_REDUCTION_MODIFIER = 0.1;

/** exponential decay for gathering rate calculation (both bit and island) */
export const GATHERING_RATE_EXPONENTIAL_DECAY = 0.015;

/** the amount of bits that can be placed in an island */
export const BIT_PLACEMENT_CAP = 5;

/** the chance to drop a common resource for barren isles (in %) */
export const BARREN_ISLE_COMMON_DROP_CHANCE = 2;

/**
 * user's first received island during the tutorial
 */
export const DEFAULT_ISLAND_TYPE = IslandType['PRIMAL_ISLES'];

/**
 * the amount of islands the user can have at a time to farm resources.
 *
 * however, the user is of course still allowed to have more islands in their inventory.
 */
export const TOTAL_ACTIVE_ISLANDS_ALLOWED = 30;

/** base energy needed per one tapping */
export const BASE_ENERGY_PER_TAPPING = 5;

/** base caress energy meter gained per one tapping */
export const BASE_CARESS_PER_TAPPING = 5;

/** base caress enery meter */
export const BASE_CARESS_METER = 125;

/** caress exp base diff */
export const EXP_BASE_DIFF = 1.1;

/** caress exp multiplier */
export const EXP_MULTIPLIER = 0.006;

/** base additional exp multiplier for tapping */
export const BASE_ADDITIONAL_EXP_MULTIPLIER = 1.05;

export const BASE_BERRY_TO_POINT_MULTIPLIER = 5;

/**
 * Creates a new Bull queue for island-related tasks.
 */
export const ISLAND_QUEUE = new Bull('islandQueue', {
  redis: process.env.REDIS_URL
});

/**
 * Because the process of dropping a resource or claiming claimable resources from an island sometimes conflicts and results in `null` data in the DB,
 * we will make the processing into one single queue to process.
 */
ISLAND_QUEUE.process('dropResourceOrClaimResources', async (job) => {
  const { queueType, islandId, twitterId, claimType, chosenResources } = job.data;

  // set a 3-second delay between each job processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  if (queueType === 'dropResource') {
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
          message: `(ISLAND_QUEUE/dropResource) Island not found.`
        }
      }

      console.log(`(ISLAND_QUEUE/dropResource) Island ID ${islandId}'s claimableResources: ${island.islandResourceStats.claimableResources} `);
  
      // a list of resources to be added to the island's `claimableResources`.
      const claimableResourcesToAdd: ExtendedResource[] = [];
      // a list of resources to be added to the island's `resourcesGathered`.
      const gatheredResourcesToAdd: ExtendedResource[] = [];
  
      // check if the `resourcesLeft` is at least 1, if not, return an error.
      const baseResourceCap = island.islandResourceStats?.baseResourceCap as number;
      // check resourcesGathered (which only counts resources gathered with a 'NORMAL' origin. bonus resources are not counted towards the base resource cap.)
      const resourcesGathered: ExtendedResource[] = island.islandResourceStats?.resourcesGathered.filter((r: ExtendedResource) => r.origin === ExtendedResourceOrigin.NORMAL);
      // get the amount per `resourcesGathered` instance
      const resourcesGatheredAmount = resourcesGathered.length > 0 ? resourcesGathered.reduce((acc, r) => acc + r.amount, 0) : 0;
  
      // for any other isles, check the entire length of resources gathered.
      if (baseResourceCap - resourcesGatheredAmount <= 0) {
        console.log(`(ISLAND_QUEUE/dropResource) No resources left to drop for Island ${islandId}.`);
  
        // if the island's `gatheringEnd` is still equal to 0 at this point, update it to the current time.
        if (island.islandResourceStats?.gatheringEnd === 0) {
          await IslandModel.updateOne({ islandId }, {
            $set: {
              'islandResourceStats.gatheringEnd': Math.floor(Date.now() / 1000)
            }
          });
  
          return {
            status: Status.ERROR,
            message: `(ISLAND_QUEUE/dropResource) No resources left to drop. Updated gatheringEnd to current time.`
          }
        }
  
        return {
          status: Status.ERROR,
          message: `(ISLAND_QUEUE/dropResource) No resources left to drop.`
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
      let resourceToDrop: Resource | null = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);

      console.log(`(ISLAND_QUEUE/dropResource) resourceToDrop before accessing type: `, resourceToDrop);
  
      // keep fetching a resource until it's not undefined/null if it is currently so (just in case it returns undefined at times)
      while (!resourceToDrop || !resourceToDrop.type || !resourceToDrop.rarity || !resourceToDrop.weight || !resourceToDrop.line) {
        if (resourceToDrop === null) {
          console.log(`(ISLAND_QUEUE/dropResource) resourceToDrop is null. randomizing again...`);
        }
        resourceToDrop = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);
      }

      console.log(`(ISLAND_QUEUE/dropResource) Island ${island.islandId} has dropped a resource: ${JSON.stringify(resourceToDrop, null, 2)}`);
  
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
        console.log(`(ISLAND_QUEUE/dropResource) resourceToDrop before accessing type 2: `, resourceToDrop);

        // if not empty, check if the resource already exists in `claimableResources`
        const existingResourceIndex = claimableResources.filter(r => r !== null).findIndex(r => r.type === resourceToDrop.type);

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
        console.log(`(ISLAND_QUEUE/dropResource) resourceToDrop before accessing type 3: `, resourceToDrop);

        // if not empty, check if the resource already exists in `resourcesGathered`
        const existingResourceIndex = resourcesGathered.filter(r => r !== null).findIndex(r => r.type === resourceToDrop.type);
  
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
  
        // only if bonus resource chance is above 0 will we proceed to check if we can drop a bonus resource.
        if (bonusResourceChance > 0) {
          // roll a dice between 1-100
          const rand = Math.random() * 100 + 1;
  
          if (rand <= bonusResourceChance) {
            console.log(`(ISLAND_QUEUE/dropResource) rand is below bonusResourceChance. dropping bonus resource!`);
            // randomize a resource based on the island's resource drop chances
            let bonusResource: Resource = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);
  
            // keep fetching a resource until it's not undefined/null in case it currently is (just in case it returns undefined at times)
            while (!bonusResource) {
              bonusResource = randomizeResourceFromChances(<IslandType>island.type, island.traits, island.currentLevel);
            }
  
            console.log(`(ISLAND_QUEUE/dropResource) Island ${island.islandId} has dropped a bonus resource: ${bonusResource}`);
  
            // if the resource inside the `claimableResources` is the same as the bonus resource, increment its amount.
            // if not, push a new resource.
            // check if the resource exists in the island's `claimableResources` OR the new `claimableResourcesToAdd`.
            // `claimableResources` means that the resource is already in the island's claimable resources.
            // `claimableResourcesToAdd` means that the resource isn't in the island's claimable resources, but the user has obtained it from the resource to drop.
            const existingClaimableResourceToAddIndex = claimableResourcesToAdd.filter(r => r !== null).findIndex(r => r.type === bonusResource?.type);
            const existingClaimableResourceIndex = claimableResources.filter(r => r !== null).findIndex(r => r.type === bonusResource?.type);
  
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
            const existingGatheredResourceIndex = resourcesGathered.filter(r => r !== null).findIndex(r => r.type === bonusResource?.type);
            const existingGatheredResourceToAddIndex = gatheredResourcesToAdd.filter(r => r !== null).findIndex(r => r.type === bonusResource?.type);
  
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

      console.log(`(ISLAND_QUEUE/dropResource) gathered resources to add: ${JSON.stringify(gatheredResourcesToAdd, null, 2)}`);
      console.log(`(ISLAND_QUEUE/dropResource) claimable resources to add: ${JSON.stringify(claimableResourcesToAdd, null, 2)}`);
  
      // add the resources to the island's `claimableResources` and `resourcesGathered`
      islandUpdateOperations.$push['islandResourceStats.claimableResources'].$each.push(...claimableResourcesToAdd);
      islandUpdateOperations.$push['islandResourceStats.resourcesGathered'].$each.push(...gatheredResourcesToAdd);

      console.log(`(ISLAND_QUEUE/dropResource) islandUpdateOperations: `, JSON.stringify(islandUpdateOperations, null, 2));
  
      // set and inc combined first to prevent conflicting issues
      await IslandModel.updateOne(
        { islandId },
        {
          $set: Object.keys(islandUpdateOperations.$set).length > 0 ? islandUpdateOperations.$set : {},
          $inc: Object.keys(islandUpdateOperations.$inc).length > 0 ? islandUpdateOperations.$inc : {}
        }
      );
  
      // do push and pull
      await IslandModel.updateOne(
        { islandId },
        {
          $pull: Object.keys(islandUpdateOperations.$pull).length > 0 ? islandUpdateOperations.$pull : {},
          $push: Object.keys(islandUpdateOperations.$push).length > 0 ? islandUpdateOperations.$push : {}
        }
      )
  
      return {
        status: Status.SUCCESS,
        message: `(ISLAND_QUEUE/dropResource) Island ID ${islandId} has dropped a resource: ${resourceToDrop}.`,
        data: {
          resource: resourceToDrop
        }
      }
    } catch (err: any) {
      console.error(`(ISLAND_QUEUE) Error occurred while dropping resources for island ${islandId}: ${err.message}`);
  
      return {
        status: Status.ERROR,
        message: `(ISLAND_QUEUE/dropResource) Error occurred while dropping resources for island ${islandId}: ${err.message}`
      }
    }
  } else if (queueType === 'claimResources') {
    try {
      // the return message (just in case not all resources can be claimed). only for successful claims.
      let returnMessage: string = `(ISLAND_QUEUE/claimResources) Claimed all resources from island ID ${islandId}.`;
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
          message: `(ISLAND_QUEUE/claimResources) User not found.`
        }
      }
  
      if (!island) {
        return {
          status: Status.ERROR,
          message: `(ISLAND_QUEUE/claimResources) Island not found.`
        }
      }

      console.log(`(ISLAND_QUEUE/claimResources) Island ID ${islandId}'s claimableResources: ${island.islandResourceStats.claimableResources} `);
  
      // check if the user owns the island
      if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
        return {
          status: Status.UNAUTHORIZED,
          message: `(ISLAND_QUEUE/claimResources) User does not own the island.`
        }
      }
  
      // if the user is currently travelling, disable claiming resources
      if (user.inGameData.travellingTo !== null) {
        return {
          status: Status.ERROR,
          message: `(ISLAND_QUEUE/claimResources) User is currently travelling.`
        }
      }
  
      // check if the `RESOURCES_CLAIM_COOLDOWN` has passed from the last claimed time
      const currentTime = Math.floor(Date.now() / 1000);
      const lastClaimedTime = island.islandResourceStats?.lastClaimed as number;
  
      if (currentTime - lastClaimedTime < RESOURCES_CLAIM_COOLDOWN) {
        return {
          status: Status.ERROR,
          message: `(ISLAND_QUEUE/claimResources) Cooldown not yet passed.`
        }
      }
  
      // check all claimable resources 
      const claimableResources = island.islandResourceStats?.claimableResources as ExtendedResource[];
  
      if (claimableResources.length === 0 || !claimableResources) {
        return {
          status: Status.ERROR,
          message: `(ISLAND_QUEUE/claimResources) No claimable resources found.`
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
            message: `(ISLAND_QUEUE/claimResources) No chosen resources found. This is required for manual claiming.`
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
              message: `(ISLAND_QUEUE/claimResources) Chosen resource ${chosenResource.type} not found in island's claimable resources.`
            }
          }
  
          if (chosenResource.amount <= 0) {
            return {
              status: Status.ERROR,
              message: `(ISLAND_QUEUE/claimResources) Chosen resource ${chosenResource.type} amount is 0.`
            }
          }
  
          if (chosenResource.amount > claimableResources[claimableResourceIndex].amount) {
            return {
              status: Status.ERROR,
              message: `(ISLAND_QUEUE/claimResources) Chosen resource ${chosenResource.type} amount exceeds claimable amount.`
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
            message: `(ISLAND_QUEUE/claimResources) Total weight of chosen resources exceeds player's max inventory weight.`
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
          const resourceWeight: number = resources.find(r => r?.type === resource?.type)?.weight ?? 0;
          const totalWeight = resourceWeight * resource.amount;
  
          if (totalWeight === 0) {
            console.log(`(ISLAND_QUEUE/claimResources) Resource weight is 0 (maybe null issue?). Resource: ${JSON.stringify(resource, null, 2)}`);
          }
  
          totalWeightToClaim += totalWeight;
        }
  
        // if the total weight to claim doesn't exceed the user's max inventory weight, we can claim all resources.
        if (currentInventoryWeight + totalWeightToClaim <= user.inventory.maxWeight) {
          // loop through each resource and add it to the user's inventory
          for (const resource of claimableResources) {
            if (!resource || !resource.type) {
              console.log(`(ISLAND_QUEUE/claimResources) Resource is null or resource type is null. Resource: ${JSON.stringify(resource, null, 2)}`);
            }
  
            // check if this resource exists on the user's inventory or not. if not, we push a new resource; if yes, we increment the amount.
            const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r?.type === resource?.type);
  
            if (existingResourceIndex !== -1) {
              userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = resource.amount;
            } else {
              console.log(`(ISLAND_QUEUE/claimResources) New resource. found. Adding resource to inventory... Resource: ${JSON.stringify(resource, null, 2)}`);
              /// CHECK THIS!!!!!
              userUpdateOperations.$push['inventory.resources'].$each.push(resource);
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

          // check if the $in has any `null` values. if yes, remove it.
          if (userUpdateOperations.$push['inventory.resources']?.$each?.includes(null)) {
            console.log(`(ISLAND_QUEUE/claimResources) $push's $each includes null. deleting...`);
            userUpdateOperations.$push['inventory.resources'].$each = userUpdateOperations.$push['inventory.resources'].$each.filter((r: ExtendedResource) => r !== null);
          }
  
          // add the weight to the user's inventory
          userUpdateOperations.$inc['inventory.weight'] = currentWeight;
  
          returnMessage = `Unable to claim all resources due to max inventory weight. Automatically claimed partial resources for Island ID ${islandId}.`;
        }
      }
  
      // set the island's `lastClaimed` to the current time
      islandUpdateOperations.$set['islandResourceStats.lastClaimed'] = currentTime;
  
      // check if either the $push or $inc's `inventory.resources`'s $each is empty. if yes, remove it.
      if (userUpdateOperations.$push['inventory.resources']?.$each?.length === 0) {
        console.log(`(ISLAND_QUEUE/claimResources) $push's $each is empty. deleting...`);
        delete userUpdateOperations.$push['inventory.resources'];
      }
      
      if (userUpdateOperations.$inc['inventory.resources']?.$each?.length === 0) {
        console.log(`(ISLAND_QUEUE/claimResources) $inc's $each is empty. deleting...`);
        delete userUpdateOperations.$inc['inventory.resources'];
      }
  
      console.log(`Island ${island.islandId} userUpdateOperations: `, JSON.stringify(userUpdateOperations, null, 2));
      console.log(`Island ${island.islandId} islandUpdateOperations: `, JSON.stringify(islandUpdateOperations, null, 2));
  
      // do set and inc first to prevent conflicting issues
      await UserModel.updateOne({ twitterId }, {
        $set: Object.keys(userUpdateOperations.$set).length > 0 ? userUpdateOperations.$set : {},
        $inc: Object.keys(userUpdateOperations.$inc).length > 0 ? userUpdateOperations.$inc : {}
      });
  
      await UserModel.updateOne({ twitterId }, {
        $push: Object.keys(userUpdateOperations.$push).length > 0 ? userUpdateOperations.$push : {},
        $pull: Object.keys(userUpdateOperations.$pull).length > 0 ? userUpdateOperations.$pull : {}
      });
  
      // first check if we have any set/inc operations to perform
      if (Object.keys(islandUpdateOperations.$set).length > 0 || Object.keys(islandUpdateOperations.$inc).length > 0) {
        const islandResultOne = await IslandModel.updateOne(
          { islandId },
          {
            $set: Object.keys(islandUpdateOperations.$set).length > 0 ? islandUpdateOperations.$set : {},
            $inc: Object.keys(islandUpdateOperations.$inc).length > 0 ? islandUpdateOperations.$inc : {}
          }
        );
  
        console.log(`(ISLAND_QUEUE/claimResources) Island ${islandId} islandResultOne: `, islandResultOne);
      }
  
      // do push and pull operations
      if (Object.keys(islandUpdateOperations.$push).length > 0 || Object.keys(islandUpdateOperations.$pull).length > 0) {
        const islandResultTwo = await IslandModel.updateOne(
          { islandId },
          {
            $push: Object.keys(islandUpdateOperations.$push).length > 0 ? islandUpdateOperations.$push : {},
            $pull: Object.keys(islandUpdateOperations.$pull).length > 0 ? islandUpdateOperations.$pull : {}
          }
        );
  
        console.log(`(ISLAND_QUEUE/claimResources) Island ${islandId} islandResultTwo: `, islandResultTwo);
      }
  
      return {
        status: Status.SUCCESS,
        message: returnMessage,
        data: {
          claimType: claimType,
          claimedResources: claimType === 'manual' ? chosenResources : claimedResources,
        }
      };
    } catch (err: any) {
      console.error(`(ISLAND_QUEUE) Error occurred while claiming resources for island ${islandId}: ${err.message}`);
  
      return {
        status: Status.ERROR,
        message: `(ISLAND_QUEUE/claimResources) Error occurred while claiming resources for island ${islandId}: ${err.message}`
      }
    }
  } else {
    return {
      status: Status.ERROR,
      message: `(ISLAND_QUEUE) Invalid queue type.`
    }
  }
})

/**
 * gets the amount of bonus resources that can be gathered daily based on the island type.
 */
export const DAILY_BONUS_RESOURCES_GATHERABLE = (type: IslandType) => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 2;
    case IslandType.VERDANT_ISLES:
      return 3;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 4;
    case IslandType.CRYSTAL_ISLES:
      return 5;
    case IslandType.CELESTIAL_ISLES:
      return 6;
  }
};

/**
 * Randomizes 5 traits from the available island traits.
 */
export const randomizeIslandTraits = (): IslandTrait[] => {
  const traits = Object.values(IslandTrait);

  const randomTraits: IslandTrait[] = [];

  for (let i = 0; i < 5; i++) {
    const rand = Math.floor(Math.random() * traits.length);
    randomTraits.push(traits[rand]);
  }

  return randomTraits;
};

/**
 * Gets the default resource cap for an Island based on its type.
 */
export const DEFAULT_RESOURCE_CAP = (type: IslandType) => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 500;
    case IslandType.VERDANT_ISLES:
      return 1250;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 2500;
    case IslandType.CRYSTAL_ISLES:
      return 2500;
    case IslandType.CELESTIAL_ISLES:
      return 2500;
  }
};
/**
 * Gets the base resource drop chances for an Island based on its type.
 */
export const RESOURCE_DROP_CHANCES = (type: IslandType): ResourceDropChance => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return {
        common: 77.5,
        uncommon: 18.5,
        rare: 4,
        epic: 0,
        legendary: 0,
      };
    case IslandType.VERDANT_ISLES:
      return {
        common: 62.5,
        uncommon: 28.7,
        rare: 8.6,
        epic: 0.2,
        legendary: 0,
      };
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return {
        common: 50,
        uncommon: 33.745,
        rare: 15,
        epic: 1.25,
        legendary: 0.005,
      };
    case IslandType.CRYSTAL_ISLES:
      return {
        common: 35.5,
        uncommon: 34,
        rare: 25,
        epic: 5,
        legendary: 0.5,
      };
    case IslandType.CELESTIAL_ISLES:
      return {
        common: 15,
        uncommon: 20,
        rare: 40,
        epic: 20,
        legendary: 5,
      };
  }
};

/**
 * Gets the percentage modifier (diff) for the resource drop chances of an island every time it levels up.
 */
export const RESOURCE_DROP_CHANCES_LEVEL_DIFF = (
  type: IslandType
): ResourceDropChanceDiff => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return {
        common: -0.13,
        uncommon: 0.12,
        rare: 0.01,
        epic: 0,
        legendary: 0,
      };
    case IslandType.VERDANT_ISLES:
      return {
        common: -0.21001,
        uncommon: 0.155,
        rare: 0.05,
        epic: 0.005,
        legendary: 0,
      };
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return {
        common: -0.44825,
        uncommon: 0.175,
        rare: 0.25,
        epic: 0.0225,
        legendary: 0.00075,
      };
    case IslandType.CRYSTAL_ISLES:
      return {
        common: -0.429,
        uncommon: 0.02,
        rare: 0.3,
        epic: 0.1,
        legendary: 0.009,
      };
    case IslandType.CELESTIAL_ISLES:
      return {
        common: -0.55,
        uncommon: -0.175,
        rare: 0.3,
        epic: 0.25,
        legendary: 0.175,
      };
  }
};

/**
 * Returrns the minimum rarity the bit needs to be to be placed on an island based on its type.
 */
export const BIT_PLACEMENT_MIN_RARITY_REQUIREMENT = (
  type: IslandType
): BitRarity => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return BitRarity.COMMON;
    case IslandType.VERDANT_ISLES:
      return BitRarity.COMMON;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return BitRarity.COMMON;
    case IslandType.CRYSTAL_ISLES:
      return BitRarity.UNCOMMON;
    case IslandType.CELESTIAL_ISLES:
      return BitRarity.RARE;
  }
};

/**
 * Shows the different negative modifiers when the bit's rarity deviates from the island's type (in rarity format).
 *
 * For instance, if a common Bit is placed on Verdant Isles (in rarity format: uncommon), there will be a negative modifier for gathering rate and resource cap.
 */
export const RARITY_DEVIATION_REDUCTIONS = (
  type: IslandType,
  rarity: BitRarity
): RarityDeviationReduction => {
  switch (type) {
    // for primal isles, all bits from common to legendary will NOT receive any reductions
    case IslandType.PRIMAL_ISLES:
      return {
        gatheringRateReduction: 0,
      };
    // for verdant isles, only common bits will get reductions.
    case IslandType.VERDANT_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          return {
            gatheringRateReduction: 2,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for exotic isles, only common and uncommon bits will get reductions.
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          return {
            gatheringRateReduction: 5,
          };
        case BitRarity.UNCOMMON:
          return {
            gatheringRateReduction: 3,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for crystal isles, commons cannot be placed, so technically only uncommons and rares will get reductions.
    case IslandType.CRYSTAL_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Crystal Isles.`
          );
        case BitRarity.UNCOMMON:
          return {
            gatheringRateReduction: 5.75,
          };
        case BitRarity.RARE:
          return {
            gatheringRateReduction: 4,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for celestial isles, commons and uncommons cannot be placed, so technically only rares and epics will get reductions.
    case IslandType.CELESTIAL_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Celestial Isles.`
          );
        case BitRarity.UNCOMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Uncommon bits are not allowed to be placed on Celestial Isles.`
          );
        case BitRarity.RARE:
          return {
            gatheringRateReduction: 7.5,
          };
        case BitRarity.EPIC:
          return {
            gatheringRateReduction: 5.25,
          };
        case BitRarity.LEGENDARY:
          return {
            gatheringRateReduction: 0,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
  }
};

/**
 * Increases the gathering rate by a multiplier of an island based on its type (for calculation balancing).
 */
export const ISLAND_RARITY_DEVIATION_MODIFIERS = (type: IslandType): number => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 5;
    case IslandType.VERDANT_ISLES:
      return 2;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 1;
    case IslandType.CRYSTAL_ISLES:
      return 1;
    case IslandType.CELESTIAL_ISLES:
      return 1;
  }
};

/**
 * Calculates the caress energy meter required for a given milestone tier
 * and returns the associated IslandTappingData.
 */
export const ISLAND_TAPPING_REQUIREMENT = (milestoneTier: number, tappingLevel: number): IslandTappingData => {
  // calculate current milestone caress required based on milestonTier parameter.
  let caressEnergyRequired: number;

  if (milestoneTier === 1) {
    caressEnergyRequired = BASE_CARESS_METER;
  } else {
    caressEnergyRequired = Math.ceil(BASE_CARESS_METER * EXP_BASE_DIFF ** (milestoneTier * (1 + EXP_MULTIPLIER) - 1));
  }

  // return IslandTappingData after calculating caressEnergyMeter required for this milestoneTier
  return {
    currentMilestone: milestoneTier,
    milestoneReward: ISLAND_TAPPING_MILESTONE_REWARD(milestoneTier, tappingLevel),
    caressEnergyMeter: caressEnergyRequired,
    currentCaressEnergyMeter: 0,
  }
};

/**
 * Return island tapping milestone reward based on given milestone tier
 */
export const ISLAND_TAPPING_MILESTONE_REWARD = (milestoneTier: number, tappingLevel: number): TappingMilestoneReward => {
  let reward: TappingMilestoneReward = {
    boosterReward: 0,
    masteryExpReward: 0,
    bonusReward: ISLAND_TAPPING_MILESTONE_BONUS_REWARD(milestoneTier, tappingLevel),
  };
  reward.boosterReward = 10 * milestoneTier;

  if (milestoneTier >= 1 && milestoneTier <= 5) {
    reward.masteryExpReward = 5;
  } else if (milestoneTier >= 6 && milestoneTier <= 10) {
    reward.masteryExpReward = 10;
  } else if (milestoneTier >= 11 && milestoneTier <= 15) {
    reward.masteryExpReward = 15;
  } else if (milestoneTier >= 16 && milestoneTier <= 20) {
    reward.masteryExpReward = 20;
  } else {
    reward.masteryExpReward = 25;
  }

  return reward;
}

export const ISLAND_TAPPING_MILESTONE_BONUS_REWARD = (milestoneTier: number, tappingLevel: number): TappingMilestoneBonusReward => {
  const bonus: TappingMilestoneBonusReward = {
    firstOptionReward: 10 * milestoneTier,
    secondOptionReward: {},
  };

  // Option 2 randomize reward
  const rand = Math.floor(Math.random() * 10000) + 1;
  if (rand <= 3333) {
    // Additional Exp from firstOptionRewards * (1 + (0.05 *tappingLevel))
    bonus.secondOptionReward.additionalExp = bonus.firstOptionReward * (BASE_ADDITIONAL_EXP_MULTIPLIER + (0.05 * (tappingLevel - 1)));
  } else if (rand <= 6666) {
    // Berry Bonus
    const berryBonus = milestoneTier >= 21 ? 3 :
      milestoneTier >= 16 ? 2 :
        milestoneTier >= 11 ? 1.5 : 1;
    bonus.secondOptionReward.berryDrop = berryBonus;
  } else {
    // Calculate Point Bonus based on milestone tier and tapping level
    const pointBonus = milestoneTier >= 21 ? 3 :
      milestoneTier >= 16 ? 2 :
        milestoneTier >= 11 ? 1.5 : 1;
    bonus.secondOptionReward.pointDrop = pointBonus * (BASE_BERRY_TO_POINT_MULTIPLIER + (tappingLevel - 1));
  }

  return bonus;
};

/**
 * Determines the milestone limit for a given island type.
 */
export const ISLAND_TAPPING_MILESTONE_LIMIT = (type: IslandType): number => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 5;
    case IslandType.VERDANT_ISLES:
      return 10;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 15;
    case IslandType.CRYSTAL_ISLES:
      return 20;
    case IslandType.CELESTIAL_ISLES:
      return 25;
  }
};