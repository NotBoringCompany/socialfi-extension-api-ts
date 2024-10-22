import { WonderspinAssetData } from '../models/gacha';
import { WonderspinModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new Wonderspin type to the database.
 */
export const addWonderspin = async (
    name: string,
    fortuneCrestThreshold: number | null,
    fortuneSurgeThreshold: number | null,
    fortuneBlessingThreshold: number | null,
    fortunePeakThreshold: number | null,
    assetData: WonderspinAssetData[]
): Promise<ReturnValue> => {
    try {
        // check if the Wonderspin with the same name already exists (case insensitive)
        const existingWonderspin = await WonderspinModel.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

        if (existingWonderspin) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with the same name already exists.'
            }
        }

        // for each asset to be added, ensure that:
        // 1. the asset type exists
        // 2. the asset exists
        // 3. the amount is at least 1
        // 4. the tier exists
        // 5. the probability weight is at least 1
        for (const asset of assetData) {
            if (!['item', 'resource', 'food', 'igc'].includes(asset.assetType)) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Invalid asset type.'
                }
            }

            if (!asset) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Invalid asset.'
                }
            }

            if (asset.amount < 1) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Asset amount must be at least 1.'
                }
            }

            if (!asset.tier) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Invalid asset tier.'
                }
            }

            if (asset.probabilityWeight < 1) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Asset probability weight must be at least 1.'
                }
            }
        }

        // for each asset to be added, check if any of them are featured. if yes, they NEED to be A tier, or else an error is thrown.
        const featuredAssets = assetData.filter(asset => asset.featured);

        if (featuredAssets.length > 0) {
            const invalidFeaturedAssets = featuredAssets.filter(asset => asset.tier !== 'A');

            if (invalidFeaturedAssets.length > 0) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Featured assets must be A tier.'
                }
            }
        }

        // create the new Wonderspin
        const newWonderspin = new WonderspinModel({
            _id: generateObjectId(),
            name,
            fortuneCrestThreshold,
            fortuneSurgeThreshold,
            fortuneBlessingThreshold,
            fortunePeakThreshold,
            assetData
        });

        await newWonderspin.save();

        return {
            status: Status.SUCCESS,
            message: 'Wonderspin added successfully.',
            data: {
                wonderspinId: newWonderspin._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addWonderspin) ${err.message}`
        }
    }
}

// export const rollWonderspin = async (
//     twitterId: string,
//     wonderspin
// )