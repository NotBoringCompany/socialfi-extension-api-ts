import { BitRarityNumeric, BitTrait, BitTraitData, BitTraitRarity } from '../models/bit';
import { SynthesizingItemGroup } from '../models/craft';
import { IslandRarityNumeric, IslandTrait } from '../models/island';
import { Item, PotionItem, SynthesizingItem } from '../models/item';
import { Modifier } from '../models/modifier';
import { ResourceLine, ResourceRarity, ResourceRarityNumeric } from '../models/resource';
import { GET_SYNTHESIZING_ITEM_MEMBERS, GET_SYNTHESIZING_ITEM_TYPE, SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE } from '../utils/constants/asset';
import { BIT_TRAITS, getBitStatsModifiersFromTraits } from '../utils/constants/bit';
import { CRAFTING_RECIPES } from '../utils/constants/craft';
import { BitModel, ConsumedSynthesizingItemModel, IslandModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Consumes an item made from the Synthesizing crafting line.
 */
export const consumeSynthesizingItem = async (
    twitterId: string, 
    item: SynthesizingItem,
    /**
     * the island or bit id that the item will be applied to.
     */
    islandOrBitId?: number,
    /**
     * the new traits that will be applied to the island for each resource rarity.
     * 
     * NOTE: if `rerollIslandTraits.value` is `all`, then `newTraits` SHOULD contain the new traits for all resource rarities (i.e. common to legendary).
     */
    newIslandTraits?: Array<{
        rarity: ResourceRarity,
        trait: IslandTrait
    }>,
    /**
     * if the item is to reroll a bit's traits, this array will contain the names of the traits to reroll.
     * for instance, say a bit has 'Trait A' and 'Trait B' and this item allows 1 trait to be rerolled.
     * if the user wants to reroll 'Trait A', then this array will contain ['Trait A'].
     */
    chosenBitTraitsToReroll?: BitTrait[]
): Promise<ReturnValue> => {
    try {
        console.log(`(consumeSynthesizingItem) Consuming item ${item}...`);

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(consumeSynthesizingItem) User not found.`
            }
        }

        // check if the user owns at least 1 of the item.
        const itemAmount = (user.inventory?.items as Item[]).find(i => i.type === item)?.amount;

        if (!itemAmount || itemAmount < 1) {
            console.log(`(consumeSynthesizingItem) Not enough of the item to consume.`);

            return {
                status: Status.ERROR,
                message: `(consumeSynthesizingItem) Not enough of the item to consume.`
            }
        }

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        const bitUpdateOperations: Array<{
            bitId: number,
            updateOperations: {
                $set: {},
                $inc: {},
                $push: {},
                $pull: {}
            }
        }> = [];

        const islandUpdateOperations: Array<{
            islandId: number,
            updateOperations: {
                $set: {},
                $inc: {},
                $push: {},
                $pull: {}
            }
        }> = [];

        // get the item data with the limitations and effects.
        // since the data contains dynamic values, we don't need to manually put logic for each item type.
        const synthesizingItemData = CRAFTING_RECIPES.find(i => i.craftedAssetData.asset === item)?.craftedAssetData.assetExtendedData;
        // const synthesizingItemData = SYNTHESIZING_ITEM_DATA.find(i => i.name === item);

        if (!synthesizingItemData) {
            return {
                status: Status.ERROR,
                message: `(consumeSynthesizingItem) Item data not found.`
            }
        }

        // generate a random id for consumed items that impact modifiers or require bull queue.
        const randomId = generateObjectId();

        // check if the item is used in an island or a bit.
        const affectedAsset = synthesizingItemData.effectValues.affectedAsset;

        if (affectedAsset === 'bit') {
            // check if the user has the specified bit id
            const bit = await BitModel.findOne({ bitId: islandOrBitId, 'ownerData.currentOwnerId': user._id }).lean();

            if (!bit) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Bit not found.`
                }
            }

            // check if the item has a min/max rarity requirement.
            const minRarity = synthesizingItemData.minimumRarity;
            const maxRarity = synthesizingItemData.maximumRarity;

            if (minRarity !== null) {
                if (BitRarityNumeric[bit.rarity] < BitRarityNumeric[minRarity]) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Bit rarity is below the minimum requirement.`
                    }
                }
            }

            if (maxRarity !== null) {
                if (BitRarityNumeric[bit.rarity] > BitRarityNumeric[maxRarity]) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Bit rarity is above the maximum requirement.`
                    }
                }
            }

            // because some items may have limitations that check for category-based usage limits AND item-based usage limits at the same time,
            // we need to query two instances of the ConsumedSynthesizingItemModel: one for the category-based limits and one for the item-based limits.
            // this is because the category-based limits will need to check for all items in the same category, while the item-based limits will only need to check for the item itself.
            const getCategoryBasedUsedItems = () => {
                const itemTypeMembers = GET_SYNTHESIZING_ITEM_MEMBERS(item);

                if (!itemTypeMembers) {
                    return null;
                }

                return itemTypeMembers;
            }

            const categoryBasedUsedItems = getCategoryBasedUsedItems();

            // if error, return an error message.
            if (!categoryBasedUsedItems) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Category based used items is null.`
                }
            }

            const [categoryBasedUsedItemInstances, itemBasedUsedItemInstances] = await Promise.all([
                ConsumedSynthesizingItemModel.find({
                    usedBy: user._id,
                    item: { $in: categoryBasedUsedItems },
                    affectedAsset,
                }).lean(),
                ConsumedSynthesizingItemModel.find({
                    usedBy: user._id,
                    item,
                    affectedAsset,
                }).lean()
            ]);

            // now, we need to check and apply the limitations for the item.
            // for items with 'oneTime' effect durations, we don't need to worry about concurrent usage limits, hence the priority will be as follows:
            // 1. multiBitTotalCategoryUsage
            // 2. multiBitTotalUsage
            // 3. singleBitTotalCategoryUsage
            // 4. singleBitTotalUsage
            // however, for items with effect durations, we will check for concurrent usage limits too. priority is as follows:
            // 1. multiBitTotalCategoryUsage
            // 2. multiBitTotalUsage
            // 3. multiBitConcurrentCategoryUsage
            // 4. multiBitConcurrentUsage
            // 5. singleBitTotalCategoryUsage
            // 6. singleBitTotalUsage
            // 7. singleBitConcurrentCategoryUsage
            // 8. singleBitConcurrentUsage
            // NOTE: for category-based usages, we will use `categoryBasedUsedItemInstances` to check for the limits.
            // for item-based usages, we will use `itemBasedUsedItemInstances` to check for the limits.
            if (synthesizingItemData.effectValues.effectDuration === 'oneTime') {
                const multiBitTotalCategoryUsageLimit = synthesizingItemData.limitations.multiBitTotalCategoryUsage.limit;
                const multiBitTotalUsageLimit = synthesizingItemData.limitations.multiBitTotalUsage.limit;
                const singleBitTotalCategoryUsageLimit = synthesizingItemData.limitations.singleBitTotalCategoryUsage.limit;
                const singleBitTotalUsageLimit = synthesizingItemData.limitations.singleBitTotalUsage.limit;

                if (multiBitTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` contains all instances of the item used across all bits, and this is a total category usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCategoryCount = categoryBasedUsedItemInstances.length;

                    if (usedTotalCategoryCount >= multiBitTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit total category usage limit for this item reached.`
                        }
                    }
                }

                if (multiBitTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` contains all instances of the item used across all bits, and this is a total usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCount = itemBasedUsedItemInstances.length;

                    if (usedTotalCount >= multiBitTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit total usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` doesn't filter out for only a single bit, we need to filter out the instances that are used on this bit.
                    const usedTotalCount = categoryBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleBitTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit total category usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` doesn't filter out for only a single bit, we need to filter out the instances that are used on this bit.
                    const usedTotalCount = itemBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleBitTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit total usage limit for this item reached.`
                        }
                    }
                }
            } else {
                const multiBitTotalCategoryUsageLimit = synthesizingItemData.limitations.multiBitTotalCategoryUsage.limit;
                const multiBitTotalUsageLimit = synthesizingItemData.limitations.multiBitTotalUsage.limit;
                const multiBitConcurrentCategoryUsageLimit = synthesizingItemData.limitations.multiBitConcurrentCategoryUsage.limit;
                const multiBitConcurrentUsageLimit = synthesizingItemData.limitations.multiBitConcurrentUsage.limit;
                const singleBitTotalCategoryUsageLimit = synthesizingItemData.limitations.singleBitTotalCategoryUsage.limit;
                const singleBitTotalUsageLimit = synthesizingItemData.limitations.singleBitTotalUsage.limit;
                const singleBitConcurrentCategoryUsageLimit = synthesizingItemData.limitations.singleBitConcurrentCategoryUsage.limit;
                const singleBitConcurrentUsageLimit = synthesizingItemData.limitations.singleBitConcurrentUsage.limit;

                if (multiBitTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` contains all instances of the item used across all bits, and this is a total category usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCategoryCount = categoryBasedUsedItemInstances.length;

                    if (usedTotalCategoryCount >= multiBitTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit total category usage limit for this item reached.`
                        }
                    }
                }

                if (multiBitTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` contains all instances of the item used across all bits, and this is a total usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCount = itemBasedUsedItemInstances.length;

                    if (usedTotalCount >= multiBitTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit total usage limit for this item reached.`
                        }
                    }
                }

                if (multiBitConcurrentCategoryUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    const usedConcurrentCategoryCount = categoryBasedUsedItemInstances.filter(i => i.effectUntil > Math.floor(Date.now() / 1000)).length;

                    if (usedConcurrentCategoryCount >= multiBitConcurrentCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit concurrent category usage limit for this item reached.`
                        }
                    }
                }

                if (multiBitConcurrentUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    const usedConcurrentCount = itemBasedUsedItemInstances.filter(i => i.effectUntil > Math.floor(Date.now() / 1000)).length;

                    if (usedConcurrentCount >= multiBitConcurrentUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi bit concurrent usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` doesn't filter out for only a single bit, we need to filter out the instances that are used on this bit.
                    const usedTotalCount = categoryBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleBitTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit total category usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` doesn't filter out for only a single bit, we need to filter out the instances that are used on this bit.
                    const usedTotalCount = itemBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleBitTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit total usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitConcurrentCategoryUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    // NOTE: because this is also only specific to a single bit, we also only need to filter out the instances that are used on this bit.
                    const usedConcurrentCategoryCount = 
                        categoryBasedUsedItemInstances
                            .filter(i => i.islandOrBitId === islandOrBitId && i.effectUntil > Math.floor(Date.now() / 1000))
                            .length;

                    if (usedConcurrentCategoryCount >= singleBitConcurrentCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit concurrent category usage limit for this item reached.`
                        }
                    }
                }

                if (singleBitConcurrentUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    // NOTE: because this is also only specific to a single bit, we also only need to filter out the instances that are used on this bit.
                    const usedConcurrentCount = 
                        itemBasedUsedItemInstances
                            .filter(i => i.islandOrBitId === islandOrBitId && i.effectUntil > Math.floor(Date.now() / 1000))
                            .length;

                    if (usedConcurrentCount >= singleBitConcurrentUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single bit concurrent usage limit for this item reached.`
                        }
                    }
                }
            }

            // if `bitTransferrableBetweenSeasons` is active, this is still TO DO.
            if (synthesizingItemData.effectValues.bitTransferrableBetweenSeasons.active) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Bit transferrable between seasons is not yet implemented.`
                }
            }

            // if `rerollBitTraits` is active, we will proceed to do the logic to reroll the bit's traits.
            if (synthesizingItemData.effectValues.rerollBitTraits.active) {
                // we need to firstly check if the bit is placed in an island. if it is, we throw an error.
                // the bit NEEDS to be unplaced first before the item can be consumed to reroll the traits.
                if (bit.placedIslandId !== 0) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Bit is placed in an island. Please unplace the bit first.`
                    }
                }

                // check if the type is `chosen`. if it is, we need to check the amount of traits that can be rerolled (the `value`).
                if (synthesizingItemData.effectValues.rerollBitTraits.type === 'chosen') {
                    // if value is `null`, then there is an issue with the data.
                    if (synthesizingItemData.effectValues.rerollBitTraits.value === null) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Reroll bit traits value is null.`
                        }
                    }

                    // if the value is a number, we need to check if the chosenBitTraitsToReroll array has the same amount of elements as the value.
                    if (typeof synthesizingItemData.effectValues.rerollBitTraits.value === 'number') {
                        if (!chosenBitTraitsToReroll) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) Chosen bit traits to reroll array is null.`
                            }
                        }

                        // there is a case where, for example, the item allows, say, 3 traits to be rerolled, but the bit only has 2 traits.
                        // in this case, we will check the following:
                        // 1. if the bit has less traits than the value, if the length of the `chosenBitTraitsToReroll` array is not equal to the bit.traits length, we throw an error.
                        // 2. if the bit has equal or more traits than the value, we simply throw an error if the length of the `chosenBitTraitsToReroll` array is not equal to the value.
                        const bitTraits = bit.traits as BitTraitData[];

                        if (bitTraits.length < synthesizingItemData.effectValues.rerollBitTraits.value) {
                            if (chosenBitTraitsToReroll.length !== bitTraits.length) {
                                return {
                                    status: Status.ERROR,
                                    message: `(consumeSynthesizingItem) Bit does not have the correct amount of traits to reroll.`
                                }
                            }
                        } else {
                            if (chosenBitTraitsToReroll.length !== synthesizingItemData.effectValues.rerollBitTraits.value) {
                                return {
                                    status: Status.ERROR,
                                    message: `(consumeSynthesizingItem) User must input the correct amount of traits to reroll.`
                                }
                            }
                        }

                        // we need to also check if the chosen traits are valid (i.e. the bit needs to have ALL of the chosen traits).
                        // Each `bitTrait` instance in `bitTraits` is of BitTraitData type, while `chosenBitTraitsToReroll` is of BitTrait type.
                        // we need to fetch the `bitTrait.trait` from each `bitTrait` instance and compare it with the `trait` from each `chosenBitTrait`
                        // and ensure that the bit has all of the chosen traits to reroll.
                        if (!chosenBitTraitsToReroll.every(trait => bitTraits.some(t => t.trait === trait))) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) Bit does not have all of the chosen traits to reroll.`
                            }
                        }
                    }
                }

                // at this point, we should be done with the checks for `chosen` type. 
                // if the type is `random`, we don't need to do any checks as the logic will simply just reroll the traits.
                // we now need to just handle the logic to reroll the traits.
                // firstly, check the amount of traits to reroll. 
                // if `all`, we set `traitsToReroll` to the bit's traits data length.
                // if it's a number, we need to check if the number is > the bit's traits data length. if it is, we set it to the bit's traits data length.
                // if it's a number and <= the bit's traits data length, we set it to the number.
                const traitsToReroll = 
                    synthesizingItemData.effectValues.rerollBitTraits.value === 'all' ? 
                    bit.traits.length :
                    synthesizingItemData.effectValues.rerollBitTraits.value > bit.traits.length ?
                    bit.traits.length :
                    synthesizingItemData.effectValues.rerollBitTraits.value;

                console.log(`(consumeSynthesizingItems) Rerolling ${traitsToReroll} traits...`);

                const bitTraits = bit.traits as BitTraitData[];

                // get the indexes of the traits to reroll from the `bit.traits` array.
                // if `traitsToReroll` === bit.traits.length, we just need to get all indexes.
                // if `traitsToReroll` < bit.traits.length, we will check the following:
                // if `rerollBitTraits.type` is `chosen`, we will get the indexes of the chosen traits.
                // else, if `rerollBitTraits.type` is `random`, we will randomize the indexes to get the traits to reroll.
                // for random, for example, say `traitsToReroll` is 2 and the bit has 3 traits. we will randomize 2 indexes from 0-2 and reroll those traits.
                const indexesToReroll: number[] = [];

                if (traitsToReroll === bitTraits.length) {
                    // reroll all traits regardless (because `traitsToReroll` is equal to the bit's traits length).
                    for (let i = 0; i < bitTraits.length; i++) {
                        indexesToReroll.push(i);
                    }
                } else {
                    // if the type is `chosen`, we will get the indexes of the chosen traits.
                    if (synthesizingItemData.effectValues.rerollBitTraits.type === 'chosen') {
                        chosenBitTraitsToReroll.forEach(trait => {
                            const index = bitTraits.findIndex(t => t.trait === trait);

                            if (index !== -1) {
                                indexesToReroll.push(index);
                            }
                        });
                    } else {
                        // if the type is `random`, we will randomize the indexes to reroll.
                        while (indexesToReroll.length < traitsToReroll) {
                            const rand = Math.floor(Math.random() * bitTraits.length);

                            if (!indexesToReroll.includes(rand)) {
                                indexesToReroll.push(rand);
                            }
                        }
                    }
                }

                console.log(`(consumeSynthesizingItems) Indexes to reroll: ${indexesToReroll.join(', ')}`);

                // now, we need to randomize the new traits for the bit.
                // we will initially set it to the bit's traits array.
                // we need to do a deep copy of the bit's traits array to prevent any reference issues.
                const updatedTraits: BitTraitData[] = JSON.parse(JSON.stringify(bitTraits));

                // loop through each trait in the bit's traits array.
                // if the index is in the `indexesToReroll` array, we will reroll the trait.
                // if it's not, we will keep the trait as is.
                updatedTraits.forEach((trait, index) => {
                    // if the index is not in the `indexesToReroll` array, we keep the trait as is.
                    if (!indexesToReroll.includes(index)) {
                        return;
                    // if it is included, we will reroll the trait.
                    } else {
                        let randomTrait: BitTraitData | null = null;

                        while (!randomTrait) {
                            // the following base rules will apply:
                            // 1. 80% common, 15% uncommon, 5% rare chance
                            // 2. for each trait category, there can only be traits of 1 subcategory.
                            // e.g. category 'Workrate A' has productive, enthusiastic, lazy, uninspired. productive and enthusiastic are positive, lazy and uninspired are negative (subcategory wise).
                            // that means that if a bit already has a trait 'productive', it can only have 'enthusiastic' as the next trait if the rand number falls within this category
                            // and not 'lazy' or 'uninspired'.
                            // then, these checks will be used to apply the next few rules/filters:
                            // 1. if `rerollBitTraits.result` is `onlyPositive`, then the rerolled trait must be positive.
                            // 2. if `rerollBitTraits.result` is `onlyNegative`, then the rerolled trait must be negative.
                            // 3. if `rerollBitTraits.result` is `any`, then the rerolled trait can be either positive or negative.
                            // 4. if `allowDuplicates` is false, then the rerolled trait cannot be the same as the old trait.
                            // if true, the rerolled trait can be the exact same as the old trait (if the user is unlucky enough to roll the same trait).
                            const rand = Math.floor(Math.random() * 100) + 1;

                            const rerollResult = synthesizingItemData.effectValues.rerollBitTraits.result;
                            const allowDuplicates = synthesizingItemData.effectValues.rerollBitTraits.allowDuplicates;

                            // first, filter the traits by rarity based on the rand.
                            // then, filter based on `allowDuplicates`.
                            // then, filter the subcategory based on the `rerollResult`.
                            const filteredTraits = BIT_TRAITS
                            .filter((trait, filterIndex) => {
                                if (!allowDuplicates) {
                                    // not allowing duplicates means that the bit CANNOT have any of the traits from `bitTraits` in the `updatedTraits` array.
                                    // for example, if the original traits of the bit were [A, B, C, D], then each rerolled trait CANNOT be A, B, C or D.
                                    // let's say the rerolled indexes are 1, 2, and 3.
                                    // so far, indexes 1 and 2 are rerolled, such that `updatedTraits` is now [A, E, F, D] (A, index 0, is NOT rerolled, and index 3 is not rerolled yet, so it stays at D).
                                    // this means that A, B, C, E, F and D are NOT allowed in the rollable traits pool when index 3 is rerolled (when D is rerolled).
                                    return !bitTraits.some(t => t.trait === trait.trait) && !updatedTraits.some(t => t.trait === trait.trait);
                                } else {
                                    // if `allowDuplicates`, we will just check if the trait is not already in the `updatedTraits` array.
                                    // however, we will exclude the current index's trait from the check, because they can reroll the same trait.
                                    // for example, say the original traits are [A, B, C, D] and the rerolled index is 2, which is C.
                                    // C will be added to the rollable traits pool, while A, B and D will be excluded (because that will be a 'true duplicate').
                                    // get all the traits in `updatedTraits` that are NOT in the current index's trait and filter them out.
                                    return !updatedTraits.filter((_, idx) => idx !== index).some(t => t.trait === trait.trait);
                                }
                            })
                            .filter(trait => {
                                if (rerollResult === 'onlyPositive') {
                                    return trait.subcategory === 'Positive';
                                } else if (rerollResult === 'onlyNegative') {
                                    return trait.subcategory === 'Negative';
                                } else {
                                    return true;
                                }
                            })
                            .filter(trait => {
                                if (rand <= 80) {
                                    return trait.rarity === BitTraitRarity.COMMON;
                                } else if (rand <= 95) {
                                    return trait.rarity === BitTraitRarity.UNCOMMON;
                                } else {
                                    return trait.rarity === BitTraitRarity.RARE;
                                }
                            })

                            if (filteredTraits.length === 0) {
                                console.log(`(consumeSynthesizingItem) No traits to reroll for index ${index}.`);
                                // if there are no traits that can be rerolled, redo the while loop.
                                continue;
                            }

                            // get all traits that are not in `filteredTraits` but are in `BIT_TRAITS`.
                            const excludedTraitsForIndex = BIT_TRAITS.filter(trait => {
                                return !filteredTraits.some(t => t.trait === trait.trait);
                            })

                            console.log(`(consumeSynthesizingItem) Filtered traits (excluding subcategory filter) for index ${index}: ${filteredTraits.map(trait => trait.trait).join(', ')}`);
                            console.log(`(consumeSynthesizingItem) Excluded traits (excluding subcategory filter) for this index: ${excludedTraitsForIndex.map(trait => trait.trait).join(', ')}`);
 
                            // this rand will be used to randomize the trait from the filtered traits.
                            const traitRand = Math.floor(Math.random() * filteredTraits.length);

                            const rolledRandomTrait = filteredTraits[traitRand];

                            // because we already check for duplicates on the filter above, now we just need to check the following:
                            // 1. if an existing trait of the opposite subcategory within this category exists.
                            // if it doesn't, add the trait. otherwise, reroll.
                            const traitCategory = rolledRandomTrait.category;
                            const traitSubcategory = rolledRandomTrait.subcategory;

                            // check if the trait's category is already in the `updatedTraits` array.
                            const categoryExists = updatedTraits.some(trait => {
                                return trait.category === traitCategory;
                            })

                            // if the category exists, check which subcategory the existing trait(s) in the `updatedTraits` array belong to.
                            // if the subcategory is the same as the random trait's subcategory, add the trait.
                            if (categoryExists) {
                                const existingSubCategory = updatedTraits.length > 0 ? updatedTraits.find(trait => trait.category === traitCategory)?.subcategory : null;

                                // if the existing subcategory is the same as the random trait's subcategory, add the trait.
                                if (existingSubCategory === traitSubcategory) {
                                    randomTrait = rolledRandomTrait;
                                } else {
                                    console.log(
                                        `(consumeSynthesizingItem) Trait ${rolledRandomTrait.trait} is of the opposite subcategory of the existing trait in the category. 
                                        Existing trait: ${trait}. Rerolling...`
                                    );
                                }
                            } else {
                                // if the category doesn't exist, add the trait.
                                randomTrait = rolledRandomTrait;
                            }
                        }

                        // if the new trait is the exact same as the old trait, log it.
                        if (trait.trait === randomTrait.trait) {
                            console.log(`(consumeSynthesizingItem) Rerolled trait ${randomTrait.trait} is the same as the old trait ${trait.trait}.`);
                        }

                        // update the `updatedTraits` array with the new trait.
                        updatedTraits[index] = randomTrait;
                    }
                })

                console.log(`(consumeSynthesizingItem) New traits: ${updatedTraits.map(trait => trait.trait).join(', ')}`);
                console.log(`(consumeSynthesizingItem) Bit's old traits: ${bit.traits.map(trait => trait.trait).join(', ')}`);

                // with the new updated traits of the bit, get the bit stats modifiers and just override the existing one (we can do this safely).
                const newStatsModifiers = getBitStatsModifiersFromTraits(updatedTraits.map(trait => trait.trait));

                // we just need to set the new list of traits to the bit.
                bitUpdateOperations.push({
                    bitId: bit.bitId,
                    updateOperations: {
                        $set: {
                            traits: updatedTraits,
                            bitStatsModifiers: newStatsModifiers
                        },
                        $inc: {},
                        $push: {},
                        $pull: {}
                    }
                });

                // because this bit isn't placed in an island, we don't need to worry about updating the island's or the placed bit's (in the island) modifiers.
                // we just need to check if the bit now has either: antagonistic, influential, famous or mannerless traits.
                // these traits impact ALL of the user's islands' working rates.
                // the logic is as follows:
                // 1. if the bit previously had any of these traits and still have them now, we don't need to do anything.
                // 2. if the bit previously had any of these traits but now doesn't have them, we need to remove the modifiers from the user's islands.
                // 3. if the bit didn't have any of these traits but now has them, we need to add the modifiers to the user's islands. 
                const islandIds = user.inventory?.islandIds as number[];

                // check if the bit has the infuential, antagonistic, famous or mannerless traits (but not querying `bit.traits`, rather querying the `updatedTraits` array).
                const nowHasInfluentialTrait = updatedTraits.some(trait => trait.trait === 'Influential');
                const nowHasAntagonisticTrait = updatedTraits.some(trait => trait.trait === 'Antagonistic');
                const nowHasFamousTrait = updatedTraits.some(trait => trait.trait === 'Famous');
                const nowHasMannerlessTrait = updatedTraits.some(trait => trait.trait === 'Mannerless');

                // if bit has influential trait, add 1% working rate to all islands owned by the user
                // if bit has antagonistic trait, reduce 1% working rate to all islands owned by the user
                // if bit has famous trait, add 0.5% working rate to all islands owned by the user
                // if bit has mannerless trait, reduce 0.5% working rate to all islands owned by the user
                // the bit cannot have all 4, because influential and antagonistic are positive while famous and mannerless are negative of the same category.
                // at most, the bit can only have influential AND antagonistic OR famous AND mannerless.
                
                // we need to check for any changes from the old traits (bit.traits) to the new traits (updatedTraits).
                // for example, say the user previously had influential and famous and now only has influential.
                // we need to remove the famous modifier from the user's islands.
                const oldHasInfluentialTrait = (bit.traits as BitTraitData[]).some(trait => trait.trait === 'Influential');
                const oldHasAntagonisticTrait = (bit.traits as BitTraitData[]).some(trait => trait.trait === 'Antagonistic');
                const oldHasFamousTrait = (bit.traits as BitTraitData[]).some(trait => trait.trait === 'Famous');
                const oldHasMannerlessTrait = (bit.traits as BitTraitData[]).some(trait => trait.trait === 'Mannerless');

                for (const islandId of islandIds) {
                    // if the bit now has the influential trait but didn't have it before, add the modifier.
                    if (nowHasInfluentialTrait && !oldHasInfluentialTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $push: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Influential`,
                                        value: 1.01
                                    },
                                },
                                $pull: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now doesn't have the influential trait but had it before, remove the modifier.
                    if (!nowHasInfluentialTrait && oldHasInfluentialTrait) {
                        // a modifier consists of `origin` and `value`.
                        // find the `origin` that says `Bit ID #{bit.bitId}'s Trait: Influential` and remove that modifier from gatheringRateModifiers
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $pull: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Influential`
                                    },
                                },
                                $push: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now has the antagonistic trait but didn't have it before, add the modifier.
                    if (nowHasAntagonisticTrait && !oldHasAntagonisticTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $push: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Antagonistic`,
                                        value: 0.99
                                    },
                                },
                                $pull: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now doesn't have the antagonistic trait but had it before, remove the modifier.
                    if (!nowHasAntagonisticTrait && oldHasAntagonisticTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $pull: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Antagonistic`
                                    },
                                },
                                $push: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now has the famous trait but didn't have it before, add the modifier.
                    if (nowHasFamousTrait && !oldHasFamousTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $push: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Famous`,
                                        value: 1.005
                                    },
                                },
                                $pull: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now doesn't have the famous trait but had it before, remove the modifier.
                    if (!nowHasFamousTrait && oldHasFamousTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $pull: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Famous`
                                    },
                                },
                                $push: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now has the mannerless trait but didn't have it before, add the modifier.
                    if (nowHasMannerlessTrait && !oldHasMannerlessTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $push: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Mannerless`,
                                        value: 0.995
                                    },
                                },
                                $pull: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }

                    // if the bit now doesn't have the mannerless trait but had it before, remove the modifier.
                    if (!nowHasMannerlessTrait && oldHasMannerlessTrait) {
                        islandUpdateOperations.push({
                            islandId,
                            updateOperations: {
                                $pull: {
                                    'islandStatsModifiers.gatheringRateModifiers': {
                                        origin: `Bit ID #${bit.bitId}'s Trait: Mannerless`
                                    },
                                },
                                $push: {},
                                $set: {},
                                $inc: {}
                            }
                        })
                    }
                }
            }
        } else if (affectedAsset === 'island') {
            // check if the user has the specified island id
            const island = await IslandModel.findOne({ islandId: islandOrBitId, 'ownerData.currentOwnerId': user._id }).lean();

            if (!island) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Island not found.`
                }
            }

            // check if the item being consumed has a minimum or maximum rarity requirement.
            // if it does, we need to check if the island's rarity is within the range.
            const minRarity = synthesizingItemData.minimumRarity;
            const maxRarity = synthesizingItemData.maximumRarity;

            if (minRarity !== null) {
                if (IslandRarityNumeric[island.type] < IslandRarityNumeric[minRarity]) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Island rarity is below the minimum requirement.`
                    }
                }
            }

            if (maxRarity !== null) {
                if (IslandRarityNumeric[island.type] > IslandRarityNumeric[maxRarity]) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Island rarity is above the maximum requirement.`
                    }
                }
            }

            // check if the item can be applied on an empty island (i.e. an island without placed bits).
            if (!synthesizingItemData.limitations.applicableOnEmptyIsland && island.placedBitIds.length === 0) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Item cannot be applied on an empty island.`
                }
            }

            // because some items may have limitations that check for category-based usage limits AND item-based usage limits at the same time,
            // we need to query two instances of the ConsumedSynthesizingItemModel: one for the category-based limits and one for the item-based limits.
            // this is because the category-based limits will need to check for all items in the same category, while the item-based limits will only need to check for the item itself.
            const getCategoryBasedUsedItems = () => {
                const itemTypeMembers = GET_SYNTHESIZING_ITEM_MEMBERS(item);

                if (!itemTypeMembers) {
                    return null;
                }

                return itemTypeMembers;
            }

            const categoryBasedUsedItems = getCategoryBasedUsedItems();

            // if error, return an error message.
            if (!categoryBasedUsedItems) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Category based used items is null.`
                }
            }

            const [categoryBasedUsedItemInstances, itemBasedUsedItemInstances] = await Promise.all([
                ConsumedSynthesizingItemModel.find({
                    usedBy: user._id,
                    item: { $in: categoryBasedUsedItems },
                    affectedAsset,
                }).lean(),
                ConsumedSynthesizingItemModel.find({
                    usedBy: user._id,
                    item,
                    affectedAsset,
                }).lean()
            ]);

            // now, we need to check and apply the limitations for the item.
            // for items with 'oneTime' effect durations, we don't need to worry about concurrent usage limits, hence the priority will be as follows:
            // 1. multiIslandTotalCategoryUsage
            // 2. multiIslandTotalUsage
            // 3. singleIslandTotalCategoryUsage
            // 4. singleIslandTotalUsage
            // however, for items with effect durations, we will check for concurrent usage limits too. priority is as follows:
            // 1. multiIslandTotalCategoryUsage
            // 2. multiIslandTotalUsage
            // 3. multiIslandConcurrentCategoryUsage
            // 4. multiIslandConcurrentUsage
            // 5. singleIslandTotalCategoryUsage
            // 6. singleIslandTotalUsage
            // 7. singleIslandConcurrentCategoryUsage
            // 8. singleIslandConcurrentUsage
            // NOTE: for category-based usages, we will use `categoryBasedUsedItemInstances` to check for the limits.
            // for item-based usages, we will use `itemBasedUsedItemInstances` to check for the limits.
            if (synthesizingItemData.effectValues.effectDuration === 'oneTime') {
                const multiIslandTotalCategoryUsageLimit = synthesizingItemData.limitations.multiIslandTotalCategoryUsage.limit;
                const multiIslandTotalUsageLimit = synthesizingItemData.limitations.multiIslandTotalUsage.limit;
                const singleIslandTotalCategoryUsageLimit = synthesizingItemData.limitations.singleIslandTotalCategoryUsage.limit;
                const singleIslandTotalUsageLimit = synthesizingItemData.limitations.singleIslandTotalUsage.limit;

                if (multiIslandTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` contains all instances of the item used across all islands, and this is a total category usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCategoryCount = categoryBasedUsedItemInstances.length;

                    if (usedTotalCategoryCount >= multiIslandTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island total category usage limit for this item reached.`
                        }
                    }
                }

                if (multiIslandTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` contains all instances of the item used across all Islands, and this is a total usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCount = itemBasedUsedItemInstances.length;

                    if (usedTotalCount >= multiIslandTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island total usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` doesn't filter out for only a single Island, we need to filter out the instances that are used on this Island.
                    const usedTotalCount = categoryBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleIslandTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island total category usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` doesn't filter out for only a single Island, we need to filter out the instances that are used on this Island.
                    const usedTotalCount = itemBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleIslandTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island total usage limit for this item reached.`
                        }
                    }
                }
            } else {
                const multiIslandTotalCategoryUsageLimit = synthesizingItemData.limitations.multiIslandTotalCategoryUsage.limit;
                const multiIslandTotalUsageLimit = synthesizingItemData.limitations.multiIslandTotalUsage.limit;
                const multiIslandConcurrentCategoryUsageLimit = synthesizingItemData.limitations.multiIslandConcurrentCategoryUsage.limit;
                const multiIslandConcurrentUsageLimit = synthesizingItemData.limitations.multiIslandConcurrentUsage.limit;
                const singleIslandTotalCategoryUsageLimit = synthesizingItemData.limitations.singleIslandTotalCategoryUsage.limit;
                const singleIslandTotalUsageLimit = synthesizingItemData.limitations.singleIslandTotalUsage.limit;
                const singleIslandConcurrentCategoryUsageLimit = synthesizingItemData.limitations.singleIslandConcurrentCategoryUsage.limit;
                const singleIslandConcurrentUsageLimit = synthesizingItemData.limitations.singleIslandConcurrentUsage.limit;

                if (multiIslandTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` contains all instances of the item used across all islands, and this is a total category usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCategoryCount = categoryBasedUsedItemInstances.length;

                    if (usedTotalCategoryCount >= multiIslandTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island total category usage limit for this item reached.`
                        }
                    }
                }

                if (multiIslandTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` contains all instances of the item used across all Islands, and this is a total usage limit,
                    // we just return the total length and check if it's greater than or equal to the limit.
                    const usedTotalCount = itemBasedUsedItemInstances.length;

                    if (usedTotalCount >= multiIslandTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island total usage limit for this item reached.`
                        }
                    }
                }

                if (multiIslandConcurrentCategoryUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    const usedConcurrentCategoryCount = categoryBasedUsedItemInstances.filter(i => i.effectUntil > Math.floor(Date.now() / 1000)).length;

                    if (usedConcurrentCategoryCount >= multiIslandConcurrentCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island concurrent category usage limit for this item reached.`
                        }
                    }
                }
                
                if (multiIslandConcurrentUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    const usedConcurrentCount = itemBasedUsedItemInstances.filter(i => i.effectUntil > Math.floor(Date.now() / 1000)).length;

                    if (usedConcurrentCount >= multiIslandConcurrentUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Multi island concurrent usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandTotalCategoryUsageLimit !== null) {
                    // because `categoryBasedUsedItemInstances` doesn't filter out for only a single Island, we need to filter out the instances that are used on this Island.
                    const usedTotalCount = categoryBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleIslandTotalCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island total category usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandTotalUsageLimit !== null) {
                    // because `itemBasedUsedItemInstances` doesn't filter out for only a single Island, we need to filter out the instances that are used on this Island.
                    const usedTotalCount = itemBasedUsedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                    if (usedTotalCount >= singleIslandTotalUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island total usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandConcurrentCategoryUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    // NOTE: because this is also only specific to a single island, we also only need to filter out the instances that are used on this island.
                    const usedConcurrentCategoryCount = 
                        categoryBasedUsedItemInstances
                            .filter(i => i.islandOrBitId === islandOrBitId && i.effectUntil > Math.floor(Date.now() / 1000))
                            .length;

                    if (usedConcurrentCategoryCount >= singleIslandConcurrentCategoryUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island concurrent category usage limit for this item reached.`
                        }
                    }
                }

                if (singleIslandConcurrentUsageLimit !== null) {
                    // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                    // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                    // one-time use items will have an effectUntil === consumedTimestamp.
                    // NOTE: because this is also only specific to a single island, we also only need to filter out the instances that are used on this island.
                    const usedConcurrentCount = 
                        itemBasedUsedItemInstances
                            .filter(i => i.islandOrBitId === islandOrBitId && i.effectUntil > Math.floor(Date.now() / 1000))
                            .length;

                    if (usedConcurrentCount >= singleIslandConcurrentUsageLimit) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) Single island concurrent usage limit for this item reached.`
                        }
                    }
                }
            }

            // check if this item is to modify the resource cap of the island.
            if (synthesizingItemData.effectValues.resourceCapModifier.active) {
                // get the current base resource cap of the island
                const currentResourceCap = island.islandResourceStats?.baseResourceCap;

                // if type is `fixed`, the new resource cap will just add the value to the current resource cap.
                // if `percentage`, then it will be (100 + value)% of the current resource cap.
                const newResourceCap = synthesizingItemData.effectValues.resourceCapModifier.type === 'fixed'
                    ? currentResourceCap + synthesizingItemData.effectValues.resourceCapModifier.value
                    : Math.floor(currentResourceCap * (100 + synthesizingItemData.effectValues.resourceCapModifier.value) / 100);

                islandUpdateOperations.push({
                    islandId: island.islandId,
                    updateOperations: {
                        // set newResourceCap & Set gatheringEnd into 0 (In case if island already depleted)
                        $set: {
                            'islandResourceStats.baseResourceCap': newResourceCap,
                            'islandResourceStats.gatheringEnd': 0
                        },
                        $inc: {},
                        $push: {},
                        $pull: {}
                    }
                });
            }

            // check if this item transmutes the traits of the island
            if (synthesizingItemData.effectValues.rerollIslandTraits.active) {
                // check if the type is `chosen`, `chosenSame` or `random`.
                // if `chosen` or `chosenSame`, we need to ensure the following:
                // 1. the `newIslandTraits` array is NOT empty.
                // 2. if `rerollIslandTraits.value` is an array of resource rarities, then the `newIslandTraits` array must ONLY have the rarities specified in the `rerollIslandTraits.value` array.
                //  for `chosenSame`, each trait in the `newIslandTraits` array MUST be the exact same. for `chosen`, each trait in the `newIslandTraits` array can be different.
                // if `random`, we just need to randomly `value` amount of traits from the island.
                // we also then need to check if the inputted traits are valid traits (that exist).
                // NOTE: if `allowDuplicates` is true (for `random` only), then the rerolled trait MAY be the same as the existing trait for each resource rarity.
                const rerollType = synthesizingItemData.effectValues.rerollIslandTraits.type;

                if (rerollType === 'chosen' || rerollType === 'chosenSame') {
                    if (!newIslandTraits || newIslandTraits.length === 0) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) New island traits not provided.`
                        }
                    }

                    // check if `the rerollIslandTraits.value` is an array of resource rarities or 'all'.
                    // if an array of resource rarities, check that each element in the `newIslandTraits` array contains the rarities specified in the `rerollIslandTraits.value` array.
                    // if 'all', we need to check if the `newIslandTraits` array contains all of rarities (from common to legendary).
                    if (Array.isArray(synthesizingItemData.effectValues.rerollIslandTraits.value)) {
                        if (!synthesizingItemData.effectValues.rerollIslandTraits.value.every(rarity => newIslandTraits.some(trait => trait.rarity === rarity))) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) New island traits must contain the specified resource rarities.`
                            }
                        }
                    } else if (synthesizingItemData.effectValues.rerollIslandTraits.value === 'all') {
                        if (!newIslandTraits.every(trait => Object.values(ResourceRarity).includes(trait.rarity))) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) New island traits must contain all resource rarities.`
                            }
                        }
                    }

                    // if `chosenSame`, we need to check if all of the traits in the `newIslandTraits` array are the same.
                    if (rerollType === 'chosenSame') {
                        // we just take the first trait in the `newIslandTraits` array and check if all of the traits are the same.
                        if (!newIslandTraits.every(trait => trait.trait === newIslandTraits[0].trait)) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) New island traits must be the same.`
                            }
                        }
                    }

                    // check, for each trait in the `newIslandTraits` array, if the trait exists in the `IslandTrait` enum.
                    if (!newIslandTraits.every(trait => Object.values(IslandTrait).includes(trait.trait))) {
                        return {
                            status: Status.ERROR,
                            message: `(consumeSynthesizingItem) One or more inputted new island traits are invalid.`
                        }
                    }
                }

                // get the current traits
                const currentTraits: IslandTrait[] = island?.traits;
                // this will be used to insert the new traits into the island's traits array.
                const updatedTraits: IslandTrait[] = [];

                // fetch all rarities in ascending order from `ResourceRarity`.
                // we will use this to loop through each rarity to input to `updatedTraits`.
                const resourceRarities: ResourceRarity[] = Object.values(ResourceRarity);

                if (rerollType === 'chosen' || rerollType === 'chosenSame') {
                    // if reroll type is 'chosen' or 'chosenSame' we will replace the existing traits with the new traits.
                    // if `value` is all, we simply input the new traits into the `updatedTraits` array.
                    // if `value` is an array of resource rarities, we will need to replace the traits of those resource rarities only and keep the other traits.
                    if (synthesizingItemData.effectValues.rerollIslandTraits.value === 'all') {
                        resourceRarities.forEach(rarity => {
                            // fetch the trait in the `newIslandTraits` array that has the same rarity as the current rarity.
                            const trait = newIslandTraits.find(t => t.rarity === rarity)?.trait ?? null;

                            // if the trait exists, add it to the `updatedTraits` array.
                            // no need to check for `else`, because we already checked if all traits existed.
                            if (trait !== null) {
                                updatedTraits.push(trait);
                            }
                        })
                    }

                    if (Array.isArray(synthesizingItemData.effectValues.rerollIslandTraits.value)) {
                        synthesizingItemData.effectValues.rerollIslandTraits.value.forEach((rarity, index) => {
                            // fetch the trait in the `newIslandTraits` array that has the same rarity as the current rarity.
                            const trait = newIslandTraits.find(t => t.rarity === rarity)?.trait ?? null;

                            // if the trait exists, add it to the `updatedTraits` array.
                            if (trait !== null) {
                                updatedTraits.push(trait);
                            } else {
                                // here, because we might not replace some of the traits for specific resource rarities,
                                // we will need to add the existing trait for that rarity.
                                // since the order is preserved, we can just fetch the trait at the same index as the current rarity.
                                updatedTraits.push(currentTraits[index]);
                            }
                        })
                    }
                }

                if (rerollType === 'random') {
                    // if reroll type is random:
                    // 1. if `value` is 'all', we will loop through each existing trait and throw a dice to see which trait to obtain.
                    // 2. if `value` is an array of resource rarities, we will only reroll the traits of those resource rarities.
                    // 3. if `allowDuplicates` is true, then we can reroll the same trait multiple times. this means that for each loop, we will include the current trait into the pool of traits obtainable.
                    // if false, then we will exclude the current trait from the pool of traits obtainable.

                    const allowDuplicates = synthesizingItemData.effectValues.rerollIslandTraits.allowDuplicates;

                    if (synthesizingItemData.effectValues.rerollIslandTraits.value === 'all') {
                        // loop through each existing trait and reroll the trait.
                        currentTraits.forEach((trait) => {
                            // if `allowDuplicates` is false, we need to exclude the current trait from the pool of traits obtainable.
                            const pool = allowDuplicates ? Object.values(IslandTrait) : Object.values(IslandTrait).filter(t => t !== trait);

                            // randomize the trait from the `pool` array.
                            const rand = Math.floor(Math.random() * pool.length);

                            updatedTraits.push(pool[rand]);
                        });
                    // if an array of resource rarities
                    } else {
                        // fetch the ResourceRarityNumeric of the resource rarities in the `value` array. this will be used as the index to fetch the trait from the `currentTraits` array.
                        const rarityIndexes = synthesizingItemData.effectValues.rerollIslandTraits.value.map(rarity => ResourceRarityNumeric[rarity]);

                        // now, loop through `currentTraits`. if the `index` is in the `rarityIndexes` array, reroll the trait.
                        // if not, keep the trait.
                        currentTraits.forEach((trait, index) => {
                            if (rarityIndexes.includes(index)) {
                                // if `allowDuplicates` is false, we need to exclude the current trait from the pool of traits obtainable.
                                const pool = allowDuplicates ? Object.values(IslandTrait) : Object.values(IslandTrait).filter(t => t !== trait);

                                // randomize the trait from the `pool` array.
                                const rand = Math.floor(Math.random() * pool.length);

                                updatedTraits.push(pool[rand]);
                            } else {
                                updatedTraits.push(trait);
                            }
                        });
                    }
                }
                
                // now, we just need to update the island's traits with the new traits.
                islandUpdateOperations.push({
                    islandId: island.islandId,
                    updateOperations: {
                        $set: {
                            traits: updatedTraits
                        },
                        $inc: {},
                        $push: {},
                        $pull: {}
                    }
                });
            }

            if (synthesizingItemData.effectValues.gatheringRateModifier.active) {
                // because the `value` is in %, we need to divide it by 100 and add 1 to get the multiplier.
                const modifierValue = 1 + (synthesizingItemData.effectValues.gatheringRateModifier.value / 100);

                // add the gathering rate modifier to the island.
                islandUpdateOperations.push({
                    islandId: island.islandId,
                    updateOperations: {
                        $push: {
                            'islandStatsModifiers.gatheringRateModifiers': {
                                origin: `Synthesizing Item: ${item}. Instance ID: ${randomId}`,
                                value: modifierValue
                            }
                        },
                        $pull: {},
                        $set: {},
                        $inc: {}
                    }
                });

                // if there is an effect duration, we need to add a bull queue to remove the modifier after the effect duration.
                if (synthesizingItemData.effectValues.effectDuration !== 'oneTime') {
                    SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.add(
                        'removeIslandGatheringRateModifier',
                        {
                            islandId: island.islandId,
                            owner: user._id,
                            origin: `Synthesizing Item: ${item}. Instance ID: ${randomId}`,
                            endTimestamp: Math.floor(Date.now() / 1000) + synthesizingItemData.effectValues.effectDuration
                        },
                        { delay: synthesizingItemData.effectValues.effectDuration as number * 1000 }
                    )
                }
            }

            if (synthesizingItemData.effectValues.placedBitsEnergyDepletionRateModifier.active) {
                // check the island's `placedBitIds` array to get all the placed bits.
                const placedBitIds = island.placedBitIds as number[];

                // if the island has no placed bits, we don't need to do anything.
                // if the island has placed bits, we need to update the energy depletion rate of each placed bit.
                if (placedBitIds.length > 0) {
                    const energyDepletionRateModifier = 1 + (synthesizingItemData.effectValues.placedBitsEnergyDepletionRateModifier.value / 100);

                    // loop through each placed bit and update the energy depletion rate.
                    placedBitIds.forEach(bitId => {
                        bitUpdateOperations.push({
                            bitId,
                            updateOperations: {
                                $push: {
                                    'bitStatsModifiers.energyRateModifiers': {
                                        origin: `Synthesizing Item: ${item}. Instance ID: ${randomId}`,
                                        value: energyDepletionRateModifier
                                    }
                                },
                                $pull: {},
                                $set: {},
                                $inc: {}
                            }
                        });

                        // if there is an effect duration, we need to add a bull queue to remove the modifier after the effect duration.
                        if (synthesizingItemData.effectValues.effectDuration !== 'oneTime') {
                            SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.add(
                                'removeBitEnergyDepletionRateModifier',
                                {
                                    bitId,
                                    islandId: island.islandId,
                                    owner: user._id,
                                    origin: `Synthesizing Item: ${item}. Instance ID: ${randomId}`,
                                    endTimestamp: Math.floor(Date.now() / 1000) + synthesizingItemData.effectValues.effectDuration
                                },
                                { delay: synthesizingItemData.effectValues.effectDuration as number * 1000 }
                            )
                        }
                    })
                }
            }
        }

        // decrement the item amount in the user's inventory.
        const consumedItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === item);
        userUpdateOperations.$inc[`inventory.items.${consumedItemIndex}.amount`] = -1;

        // increase the `totalAmountConsumed` and `weeklyAmountConsumed` of the item.
        userUpdateOperations.$inc[`inventory.items.${consumedItemIndex}.weeklyAmountConsumed`] = 1;
        userUpdateOperations.$inc[`inventory.items.${consumedItemIndex}.totalAmountConsumed`] = 1;

        // add the consumed item to the `ConsumedSynthesizingItem` collection.
        const consumedSynthesizingItem = new ConsumedSynthesizingItemModel({
            _id: randomId,
            usedBy: user._id,
            item,
            affectedAsset,
            islandOrBitId,
            consumedTimestamp: Math.floor(Date.now() / 1000),
            effectUntil: synthesizingItemData.effectValues.effectDuration === 'oneTime' ? Math.floor(Date.now() / 1000) : Math.floor(Date.now() / 1000) + synthesizingItemData.effectValues.effectDuration
        });

        await consumedSynthesizingItem.save();

        // do the update operations.
        const islandUpdatePromisesSetInc = islandUpdateOperations.length > 0 ? islandUpdateOperations.map(async op => {
            return IslandModel.updateOne({ islandId: op.islandId, owner: user._id }, {
                $set: op.updateOperations.$set,
                $inc: op.updateOperations.$inc
            });
        }) : [];

        const bitUpdatePromisesSetInc = bitUpdateOperations.length > 0 ? bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId, owner: user._id }, {
                $set: op.updateOperations.$set,
                $inc: op.updateOperations.$inc
            });
        }) : [];

        const islandUpdatePromisesPushPull = islandUpdateOperations.length > 0 ? islandUpdateOperations.map(async op => {
            return IslandModel.updateOne({ islandId: op.islandId, owner: user._id }, {
                $push: op.updateOperations.$push,
                $pull: op.updateOperations.$pull
            });
        }) : [];

        const bitUpdatePromisesPushPull = bitUpdateOperations.length > 0 ? bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId, owner: user._id }, {
                $push: op.updateOperations.$push,
                $pull: op.updateOperations.$pull
            });
        }) : [];

        // do the $set and $inc in one operation, and then $push and $pull in another.
        await Promise.all([
            UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc
            }),
            ...islandUpdatePromisesSetInc,
            ...bitUpdatePromisesSetInc
        ]);

        await Promise.all([
            ...islandUpdatePromisesPushPull,
            ...bitUpdatePromisesPushPull
        ]);

        return {
            status: Status.SUCCESS,
            message: `(consumeSynthesizingItem) Successfully consumed the item.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeSynthesizingItem) ${err.message}`
        }
    }
}