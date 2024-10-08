import { BitTrait, BitTraitData, BitTraitRarity } from '../models/bit';
import { SynthesizingItemGroup } from '../models/craft';
import { Item, SynthesizingItem } from '../models/item';
import { ResourceLine } from '../models/resource';
import { GET_SYNTHESIZING_ITEM_TYPE, SYNTHESIZING_ITEM_DATA } from '../utils/constants/asset';
import { BIT_TRAITS, getBitStatsModifiersFromTraits } from '../utils/constants/bit';
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
     * the new resource line that will be applied to the island.
     */
    newResourceLine?: ResourceLine,
    /**
     * if the item is to reroll a bit's traits, this array will contain the names of the traits to reroll.
     * for instance, say a bit has 'Trait A' and 'Trait B' and this item allows 1 trait to be rerolled.
     * if the user wants to reroll 'Trait A', then this array will contain ['Trait A'].
     */
    chosenBitTraitsToReroll?: BitTrait[]
): Promise<ReturnValue> => {
    try {
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
            _id: string,
            updateOperations: {
                $set: {},
                $inc: {},
                $push: {},
                $pull: {}
            }
        }> = [];

        const islandUpdateOperations: Array<{
            _id: string,
            updateOperations: {
                $set: {},
                $inc: {},
                $push: {},
                $pull: {}
            }
        }> = [];

        // get the item data with the limitations and effects.
        // since the data contains dynamic values, we don't need to manually put logic for each item type.
        const synthesizingItemData = SYNTHESIZING_ITEM_DATA.find(i => i.name === item);

        if (!synthesizingItemData) {
            return {
                status: Status.ERROR,
                message: `(consumeSynthesizingItem) Item data not found.`
            }
        }

        // check if the item is used in an island or a bit.
        const affectedAsset = synthesizingItemData.effectValues.affectedAsset;

        if (affectedAsset === 'bit') {
            // check if the user has the specified bit id
            const bit = await BitModel.findOne({ bitId: islandOrBitId }).lean();

            if (!bit) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Bit not found.`
                }
            }

            // check if the user owns the bit
            if (bit.owner !== user._id) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Bit does not belong to the user.`
                }
            }

            // check if there are any `singleBitUsage` or `concurrentBitsUsage` limitations for this item.
            const singleBitUsageLimit = synthesizingItemData.limitations.singleBitUsage.limit;
            const concurrentBitsUsageLimit = synthesizingItemData.limitations.concurrentBitsUsage.limit;

            const usedItemInstances = await ConsumedSynthesizingItemModel.find({
                usedBy: user._id,
                item,
                affectedAsset,
            }).lean();

            if (singleBitUsageLimit !== null) {
                // check if the user has used the item on this bit before.
                const usedOnThisBitCount = usedItemInstances.filter(i => i.islandOrBitId === islandOrBitId).length;

                if (usedOnThisBitCount >= singleBitUsageLimit) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Single bit usage limit for this item reached.`
                    }
                }
            }

            if (concurrentBitsUsageLimit !== null) {
                // we don't need to worry if the item doesn't have an effect duration (i.e. it's a one-time use item).
                // this is because we want to only search for items whose effectUntil is greater than the current timestamp.
                // one-time use items will have an effectUntil === consumedTimestamp.
                const usedOnConcurrentBitsCount = usedItemInstances.filter(i => i.effectUntil > Math.floor(Date.now() / 1000)).length;

                if (usedOnConcurrentBitsCount >= concurrentBitsUsageLimit) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Concurrent bits usage limit for this item reached.`
                    }
                }
            }

            // check if this item cannot be used when another of the same item is currently active (used).
            // although this coincides with the logic for `concurrentBitsUsageLimit` (because the item being used concurrently = is usable when another item is active),
            // we still need to have this check regardless.
            if (synthesizingItemData.limitations.notUsableWhenAnotherSameItemActive) {
                // if true, check if there is an active item already being used.
                const activeItem = usedItemInstances.find(i => i.effectUntil > Math.floor(Date.now() / 1000));

                if (activeItem) {
                    return {
                        status: Status.ERROR,
                        message: `(consumeSynthesizingItem) Another instance of this is currently active on another bit.`
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
                        if (!chosenBitTraitsToReroll || chosenBitTraitsToReroll.length !== synthesizingItemData.effectValues.rerollBitTraits.value) {
                            return {
                                status: Status.ERROR,
                                message: `(consumeSynthesizingItem) User must input the correct amount of traits to reroll.`
                            }
                        }

                        // we need to also check if the chosen traits are valid (i.e. the bit needs to have ALL of the chosen traits).
                        const bitTraits = bit.traits as BitTrait[];

                        if (!chosenBitTraitsToReroll.every(trait => bitTraits.includes(trait))) {
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
                // firstly, check the amount of traits to reroll. if `all`, we set `traitsToReroll` to the bit's traits data length.
                // if it's a number, we set `traitsToReroll` to the `rerollBitTraits.value`.
                const traitsToReroll = 
                    synthesizingItemData.effectValues.rerollBitTraits.value === 'all' 
                        ? bit.traits.length 
                        : synthesizingItemData.effectValues.rerollBitTraits.value;

                const traits: BitTraitData[] = [];

                while (traits.length < traitsToReroll) {
                    // the following base rules will apply:
                    // 1. 80% common, 15% uncommon, 5% rare chance
                    // 2. for each trait category, there can only be traits of 1 subcategory.
                    // e.g. category 'Workrate A' has productive, enthusiastic, lazy, uninspired. productive and enthusiastic are positive, lazy and uninspired are negative (subcategory wise).
                    // that means that if a bit already has a trait 'productive', it can only have 'enthusiastic' as the next trait if the rand number falls within this category
                    // and not 'lazy' or 'uninspired'.
                    // 3. no duplicate traits.
                    // then, these checks will be used to apply the next few rules:
                    // 1. if `rerollBitTraits.result` is `onlyPositive`, then the rerolled trait must be positive.
                    // 2. if `rerollBitTraits.result` is `onlyNegative`, then the rerolled trait must be negative.
                    // 3. if `rerollBitTraits.result` is `any`, then the rerolled trait can be either positive or negative.
                    const rand = Math.floor(Math.random() * 100) + 1;

                    // randomize the traits from the `bitTraits` array.
                    let randomTrait: BitTraitData;

                    const rerollResult = synthesizingItemData.effectValues.rerollBitTraits.result;

                    // first, filter the traits by rarity based on the rand. then, filter the subcategory based on the `rerollResult`.
                    const filteredTraits = BIT_TRAITS.filter(trait => {
                        if (rand <= 80) {
                            return trait.rarity === BitTraitRarity.COMMON;
                        } else if (rand <= 95) {
                            return trait.rarity === BitTraitRarity.UNCOMMON;
                        } else {
                            return trait.rarity === BitTraitRarity.RARE;
                        }
                    }).filter(trait => {
                        if (rerollResult === 'onlyPositive') {
                            return trait.subcategory === 'Positive';
                        } else if (rerollResult === 'onlyNegative') {
                            return trait.subcategory === 'Negative';
                        } else {
                            return true;
                        }
                    })

                    // this rand will be used to randomize the trait from the filtered traits.
                    const traitRand = Math.floor(Math.random() * filteredTraits.length);

                    randomTrait = filteredTraits[traitRand];

                    // if the trait already exists in the bit's current traits, reroll the trait.
                    if (bit.traits.includes(randomTrait)) {
                        continue;
                    }

                    // now, check if the trait already exists in the rerolled `traits` array
                    if (!traits.includes(randomTrait)) {
                        // if it doesn't, then the trait is already unique, which is what we want.
                        // however, we need to check if an existing trait of the opposite subcategory within this category exists.
                        // if it doesn't, add the trait.
                        // this won't be an issue if `rerollResult` is `onlyPositive` or `onlyNegative`, but this needs to be checked when `rerollResult` is `random`, because we
                        // don't want to have a positive and negative trait of the same category as it doesn't make sense.
                        const traitCategory = randomTrait.category;
                        const traitSubcategory = randomTrait.subcategory;

                        // check if the trait's category is already in the traits array.
                        const categoryExists = traits.some(trait => {
                            return trait.category === traitCategory;
                        })

                        // if the category exists, check which subcategory the existing trait(s) belong to
                        // if the subcategory is the same as the random trait's subcategory, add the trait
                        if (categoryExists) {
                            const existingSubCategory = traits.find(trait => trait.category === traitCategory)?.subcategory;

                            // if the existing subcategory is the same as the random trait's subcategory, add the trait.
                            if (existingSubCategory === traitSubcategory) {
                                traits.push(randomTrait);
                            }
                        } else {
                            // if the category doesn't exist, add the trait.
                            traits.push(randomTrait);
                        }
                    }
                }

                // now, we just need to update the bit's traits with the new traits.
                // if the `type` is `chosen`, then we will update the traits the user has selected (the `chosenBitTraitsToReroll` array) with the new traits.
                // for example, say the user wants to reroll 'Trait A' and 'Trait B' such that the `chosenBitTraitsToReroll` array is ['Trait A', 'Trait B'].
                // then, the `traits` array (which contains the rerolled traits) contains ['Trait C', 'Trait D'].
                // Trait C will replace Trait A and Trait D will replace Trait B.
                // however, if the type is `random`, then we will randomly replace `rerollBitTraits.value` amount of the bit's traits with the new traits.
                // for example, say the item rerolls one trait randomly. the bit has 'Trait A', 'Trait B', 'Trait C', 'Trait D'. we will just roll a dice from 1-4 and replace one of the traits with the new trait.
                // if the dice rolls 3, then 'Trait C' will be replaced with the new trait.
                // if the item rerolls all traits, then all of the bit's traits will be replaced with the new traits.
                const indexesToReplace: number[] = [];

                if (synthesizingItemData.effectValues.rerollBitTraits.type === 'chosen') {
                    // if the type is `chosen`, we need to find the indexes of the chosen traits in the bit's traits array.
                    chosenBitTraitsToReroll.forEach(trait => {
                        const index = bit.traits.findIndex(t => t === trait);

                        if (index !== -1) {
                            indexesToReplace.push(index);
                        }
                    })
                } else {
                    // if the type is `random` and `value` is `all`, we simply add all indexes to the array.
                    if (synthesizingItemData.effectValues.rerollBitTraits.value === 'all') {
                        for (let i = 0; i < bit.traits.length; i++) {
                            indexesToReplace.push(i);
                        }
                    } else {
                        // else, we need to find the indexes of the bit's traits to replace.
                        while (indexesToReplace.length < synthesizingItemData.effectValues.rerollBitTraits.value) {
                            const rand = Math.floor(Math.random() * bit.traits.length);

                            if (!indexesToReplace.includes(rand)) {
                                indexesToReplace.push(rand);
                            }
                        }
                    }
                }
                // temp index to fetch the traits from the `traits` array.
                let tempIndex = 0;

                const updatedTraits: BitTraitData[] = bit.traits.map((trait, index) => {
                    // if the current index is NOT in the `indexesToReplace` array, return the current trait.
                    // else, return a new trait from the `traits` array (in incrementing index order).
                    if (!indexesToReplace.includes(index)) {
                        return trait;
                    } else {
                        // return the new trait and increment the tempIndex.
                        return traits[tempIndex++];
                    }
                })

                // with the new updated traits of the bit, get the bit stats modifiers and just override the existing one (we can do this safely).
                const newStatsModifiers = getBitStatsModifiersFromTraits(updatedTraits.map(trait => trait.trait));

                // we just need to set the new list of traits to the bit.
                bitUpdateOperations.push({
                    _id: bit._id,
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

                // now, we need to check if this bit is placed in an island. if yes, we may need to update the island's stats modifiers and other bits' stats modifiers
                // if the bit has traits to affect the island or the placed bits.
                //// TO DO!!!!!!!
            }
        }

        // decrement the item amount in the user's inventory.
        const consumedItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === item);
        userUpdateOperations.$inc[`inventory.items.${consumedItemIndex}.amount`] = -1;

        // add the consumed item to the `ConsumedSynthesizingItem` collection.
        const consumedSynthesizingItem = new ConsumedSynthesizingItemModel({
            _id: generateObjectId(),
            usedBy: user._id,
            item,
            affectedAsset,
            islandOrBitId,
            consumedTimestamp: Math.floor(Date.now() / 1000),
            effectUntil: synthesizingItemData.effectValues.effectDuration === 'oneTime' ? Math.floor(Date.now() / 1000) : Math.floor(Date.now() / 1000) + synthesizingItemData.effectValues.effectDuration
        });

        await consumedSynthesizingItem.save();

        //// TO DO: IF EFFECT DURATION IS NOT ONE TIME, WE NEED TO ADD A BULL QUEUE HERE.

        // do the update operations.
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeSynthesizingItem) ${err.message}`
        }
    }
}