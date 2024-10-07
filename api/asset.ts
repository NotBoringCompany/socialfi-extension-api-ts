import { BitTrait, BitTraitData } from '../models/bit';
import { SynthesizingItemGroup } from '../models/craft';
import { Item, SynthesizingItem } from '../models/item';
import { ResourceLine } from '../models/resource';
import { GET_SYNTHESIZING_ITEM_TYPE, SYNTHESIZING_ITEM_DATA } from '../utils/constants/asset';
import { BitModel, ConsumedSynthesizingItemModel, IslandModel, UserModel } from '../utils/constants/db';
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

            // if `rerollBitTraits` is active, we will check a few things.
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

                    // at this point, we should be done with the checks for `chosen` type. we now need to just handle the logic
                    // to reroll the traits.
                    // firstly, check the amount of traits to reroll. if `all`, we set `traitsToReroll` to the bit's traits data length.
                    // if it's a number, we set `traitsToReroll` to the `rerollBitTraits.value`.
                    const traitsToReroll = 
                        synthesizingItemData.effectValues.rerollBitTraits.value === 'all' 
                            ? bit.traits.length 
                            : synthesizingItemData.effectValues.rerollBitTraits.value;

                    const traits: BitTraitData[] = [];

                    while (traits.length < traitsToReroll) {
                        
                    }
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeSynthesizingItem) ${err.message}`
        }
    }
}