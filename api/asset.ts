import { SynthesizingItemGroup } from '../models/craft';
import { Item, SynthesizingItem } from '../models/item';
import { ResourceLine } from '../models/resource';
import { GET_SYNTHESIZING_ITEM_TYPE, SYNTHESIZING_ITEM_DATA } from '../utils/constants/asset';
import { BitModel, IslandModel, UserModel } from '../utils/constants/db';
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
    newResourceLine?: ResourceLine
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
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeSynthesizingItem) ${err.message}`
        }
    }
}