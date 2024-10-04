import { SynthesizingItemGroup } from '../models/craft';
import { Item, SynthesizingItem } from '../models/item';
import { GET_SYNTHESIZING_ITEM_TYPE } from '../utils/constants/asset';
import { IslandModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Consumes an item made from the Synthesizing crafting line.
 */
export const consumeSynthesizingItem = async (
    twitterId: string, 
    item: SynthesizingItem,
    // only for restoration items
    islandId?: number
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

        const synthesizingItemType = GET_SYNTHESIZING_ITEM_TYPE(item);

        // augmentation items increases the island's `baseResourceCap` by x%.
        if (synthesizingItemType === SynthesizingItemGroup.AUGMENTATION_ITEM) {
            if (!islandId || islandId < 1) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) Island ID not provided.`
                }
            }

            // check if the user owns the island
            const island = await IslandModel.findOne({ islandId, owner: user._id }).lean();

            if (!island) {
                return {
                    status: Status.ERROR,
                    message: `(consumeSynthesizingItem) User does not own the island.`
                }
            }

            // 
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeSynthesizingItem) ${err.message}`
        }
    }
}