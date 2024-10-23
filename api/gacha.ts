import { Asset, AssetType } from '../models/asset';
import { WonderspinAssetData, WonderspinAssetTier } from '../models/gacha';
import { Item, WonderspinTicketType } from '../models/item';
import { UserModel, UserWonderspinDataModel, WonderspinModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new Wonderspin type to the database.
 */
export const addWonderspin = async (
    name: string,
    ticketType: WonderspinTicketType,
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

        if (!ticketType) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) Invalid ticket type.'
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

        // if `fortuneBlessingThreshold` or `fortuneSurgeThreshold` is not null and there is no A tier asset, throw an error.
        if ((fortuneBlessingThreshold !== null || fortuneSurgeThreshold !== null) && assetData.every(asset => asset.tier !== WonderspinAssetTier.A)) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortuneBlessingThreshold` or `fortuneSurgeThreshold` must have at least one A tier asset.'
            }
        }

        // if `fortuneCrestThreshold` is not null and there is no B tier asset, throw an error.
        if (fortuneCrestThreshold !== null && assetData.every(asset => asset.tier !== WonderspinAssetTier.B)) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortuneCrestThreshold` must have at least one B tier asset.'
            }
        }

        // for each asset to be added, check if any of them are featured. if yes, they NEED to be A tier, or else an error is thrown.
        const featuredAssets = assetData.filter(asset => asset.featured);

        if (featuredAssets.length > 0) {
            const invalidFeaturedAssets = featuredAssets.filter(asset => asset.tier !== WonderspinAssetTier.A);

            if (invalidFeaturedAssets.length > 0) {
                return {
                    status: Status.ERROR,
                    message: '(addWonderspin) Featured assets must be A tier.'
                }
            }
        }

        // if there are no featured assets but the `fortunePeakThreshold` is not null, throw an error.
        if (featuredAssets.length === 0 && fortunePeakThreshold !== null) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortunePeakThreshold` must have at least one featured asset.'
            }
        }

        // create the new Wonderspin
        const newWonderspin = new WonderspinModel({
            _id: generateObjectId(),
            name,
            ticketType,
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

/**
 * Consumes a Wonderspin ticket to roll the Wonderspin once, 5 or 10 times at once.
 */
export const rollWonderspin = async (
    twitterId: string,
    ticket: WonderspinTicketType,
    wonderspin: string,
    amount: 1 | 5 | 10
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: '(rollWonderspin) User not found.'
            }
        }

        const userUpdateOperations = {
            $inc: {},
            $push: {},
            $set: {},
            $pull: {}
        }

        // check if the user owns `amount` of Wonderspin tickets
        const ticketIndex = (user?.inventory?.items as Item[]).findIndex(item => item.type === ticket);

        if (ticketIndex === -1 || (user.inventory.items as Item[])[ticketIndex].amount < amount) {
            return {
                status: Status.ERROR,
                message: '(rollWonderspin) Insufficient tickets to roll this Wonderspin.'
            }
        }
        
        // we fetch two things:
        // 1. the wonderspin data
        // 2. the user's data for this wonderspin
        const wonderspinData = await WonderspinModel.findOne({ name: { $regex: new RegExp(`^${wonderspin}$`, 'i') } }).lean();

        if (!wonderspinData) {
            return {
                status: Status.ERROR,
                message: '(rollWonderspin) Wonderspin not found.'
            }
        }


        // check if the ticket inputted matches the ticket type of the Wonderspin.
        if (wonderspinData.ticketType !== ticket) {
            return {
                status: Status.ERROR,
                message: `(rollWonderspin) Ticket type does not match the Wonderspin's required ticket type.`
            }
        }

        // the user might not have the data yet, so no need to check for null/undefined.
        const userWonderspinData = await UserWonderspinDataModel.findOne({ userId: user._id, wonderspinId: wonderspinData._id }).lean();
        
        // get the `rollsUntilFortuneCrest`, `rollsUntilFortuneSurge`, `currentFortuneSurgeRoll`, `rollsUntilFortuneBlessing`, and `rollsUntilFortunePeak` values.
        // for each instance, apart from `currentFortuneSurgeRoll`:
        // 1. check the wonderspin data (not the user data). if the value is null, set each value to null as well.
        // 2. if the value is not null, check the user wonderspin data. if the user wonderspin data is undefined, set the value to the threshold value.
        // 3. if the user wonderspin data is defined, fetch the value from there.
        let rollsUntilFortuneCrest: number | null = null;
        let rollsUntilFortuneSurge: number | null = null;
        let currentFortuneSurgeRoll: number = 0;
        let rollsUntilFortuneBlessing: number | null = null;
        let rollsUntilFortunePeak: number | null = null;

        if (wonderspinData.fortuneCrestThreshold !== null) {
            rollsUntilFortuneCrest = userWonderspinData
                ? userWonderspinData.rollsUntilFortuneCrest ?? wonderspinData.fortuneCrestThreshold
                : wonderspinData.fortuneCrestThreshold;
        }

        if (wonderspinData.fortuneSurgeThreshold !== null) {
            rollsUntilFortuneSurge = userWonderspinData
                ? userWonderspinData.rollsUntilFortuneSurge ?? wonderspinData.fortuneSurgeThreshold
                : wonderspinData.fortuneSurgeThreshold;
        }

        if (wonderspinData.fortuneBlessingThreshold !== null) {
            rollsUntilFortuneBlessing = userWonderspinData
                ? userWonderspinData.rollsUntilFortuneBlessing ?? wonderspinData.fortuneBlessingThreshold
                : wonderspinData.fortuneBlessingThreshold;
        }

        if (wonderspinData.fortunePeakThreshold !== null) {
            rollsUntilFortunePeak = userWonderspinData
                ? userWonderspinData.rollsUntilFortunePeak ?? wonderspinData.fortunePeakThreshold
                : wonderspinData.fortunePeakThreshold;
        }

        // used to store the assets obtained from the roll.
        const obtainedAssets: Array<{
            assetType: 'item' | 'resource' | 'food' | 'igc',
            asset: AssetType | 'xCookies' | 'diamonds',
            amount: number
        }> = [];

        while (obtainedAssets.length < amount) {
            // the order of priority is:
            // 1. featured asset (if rollsUntilFortunePeak is NOT null AND is 0)
            // 2. A tier asset (if rollsUntilFortuneBlessing is NOT null AND is 0)
            // 3. B tier asset (if rollsUntilFortuneCrest is NOT null AND is 0)
            // otherwise, the asset is randomly rolled based on the probability weights of each asset.
            // NOTE: once `rollsUntilFortuneSurge` reaches 0, the `currentFortuneSurgeRoll` will increase by 1 until an A tier asset is obtained.
            // this will also increase the cumulative probability of obtaining an A tier asset on the next roll based on the formula found in `UserWonderspinData.currentFortuneSurgeRoll`:
            // BPa + ((100 - BPa) / (fortuneBlessingThreshold - fortuneSurgeThreshold) * currentFortuneSurgeRoll)

            // check if `rollsUntilFortunePeak` is NOT null AND is 0 (meaning a guaranteed featured asset).
            if (rollsUntilFortunePeak !== null && rollsUntilFortunePeak === 0) {
                // obtain a featured asset.
                const featuredAssets = wonderspinData.assetData.filter(asset => asset.featured);

                console.log(`(rollWonderspin) Obtaining a featured asset...`);

                // we don't need to check for null or 0 featuredAssets because this is taken care of in `addWonderspin`.
                // if there is only 1 featured asset, then we can just push that asset to the obtainedAssets array.
                if (featuredAssets.length === 1) {
                    console.log(`(rollWonderspin) Obtained featured asset from guaranteed featured roll: ${JSON.stringify(featuredAssets[0])}`);

                    obtainedAssets.push({
                        assetType: featuredAssets[0].assetType,
                        asset: featuredAssets[0].asset,
                        amount: featuredAssets[0].amount
                    });
                } else {
                    // otherwise, if there are multiple featured assets, we need to roll one of them based on their probability weights.
                    let currentMinProbability = 0;

                    // filter the assets with their min and max probability ranges.
                    const filteredFeaturedAssetsData = featuredAssets.map((asset, index) => {
                        const minProbability = currentMinProbability;
                        const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                        currentMinProbability = maxProbability + 1;

                        return {
                            assetType: asset.assetType,
                            asset: asset.asset,
                            amount: asset.amount,
                            minProbability: minProbability,
                            maxProbability: maxProbability,
                        }
                    });

                    console.log(`(rollWonderspin) Filtered featured assets data: ${JSON.stringify(filteredFeaturedAssetsData)}`);

                    // get the last asset's max probability, and this is used as the max range for the random number.
                    const maxRange = filteredFeaturedAssetsData[filteredFeaturedAssetsData.length - 1].maxProbability;

                    // roll a random number between 0 and the max range.
                    const randomNumber = Math.floor(Math.random() * (maxRange + 1));

                    console.log(`(rollWonderspin) Random number for roll ${obtainedAssets.length}: ${randomNumber}`);

                    // find the asset that corresponds to the random number.
                    const obtainedAsset = filteredFeaturedAssetsData.find(asset => randomNumber >= asset.minProbability && randomNumber <= asset.maxProbability);

                    console.log(`(rollWonderspin) Roll ${obtainedAssets.length} guaranteed featured asset obtained: ${JSON.stringify(obtainedAsset)}`);

                    obtainedAssets.push({
                        assetType: obtainedAsset.assetType,
                        asset: obtainedAsset.asset,
                        amount: obtainedAsset.amount
                    });
                }

                // reset the `rollsUntilFortunePeak` counter back to `fortunePeakThreshold`.
                rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                // reset the `rollsUntilFortuneBlessing` counter back to `fortuneBlessingThreshold`, because featured assets are considered as A tier assets.
                rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                // reset the `rollsUntilFortuneSurge` counter back to `fortuneSurgeThreshold`, because obtaining a featured asset is also considered as obtaining an A tier asset.
                rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                // reset the `currentFortuneSurgeRoll` counter back to 0.
                currentFortuneSurgeRoll = 0;

                // continue to the next iteration.
                continue;
            // 2nd priority: check if `rollsUntilFortuneBlessing` is NOT null AND is 0 (meaning a guaranteed A tier asset).
            } else if (rollsUntilFortuneBlessing !== null && rollsUntilFortuneBlessing === 0) {
                // obtain an A tier asset (guaranteed).
                const aTierAssets = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.A);
                
                console.log(`(rollWonderspin) Obtaining an A tier asset from guaranteed A tier roll.`);

                // a checker to check if the asset obtained is a featured asset.
                // if yes, `rollsUntilFortunePeak` will also be reset back to `fortunePeakThreshold`.
                let obtainedAssetIsFeatured: boolean = false;

                // we don't need to check for null or 0 aTierAssets because this is taken care of in `addWonderspin`.
                // if there is only 1 A tier asset, then we can just push that asset to the obtainedAssets array.
                if (aTierAssets.length === 1) {
                    obtainedAssets.push({
                        assetType: aTierAssets[0].assetType,
                        asset: aTierAssets[0].asset,
                        amount: aTierAssets[0].amount
                    });

                    // check if the asset obtained is a featured asset.
                    obtainedAssetIsFeatured = aTierAssets[0].featured;

                    console.log(`(rollWonderspin) Obtained A tier asset from guaranteed A tier roll: ${JSON.stringify(aTierAssets[0])}`);
                } else {
                    // otherwise, if there are multiple A tier assets, we need to roll one of them based on their probability weights.
                    let currentMinProbability = 0;

                    // filter the assets with their min and max probability ranges.
                    const filteredATierAssetsData = aTierAssets.map((asset, index) => {
                        const minProbability = currentMinProbability;
                        const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                        currentMinProbability = maxProbability + 1;

                        return {
                            assetType: asset.assetType,
                            asset: asset.asset,
                            amount: asset.amount,
                            minProbability: minProbability,
                            maxProbability: maxProbability,
                        }
                    });

                    console.log(`(rollWonderspin) Filtered A tier assets data: ${JSON.stringify(filteredATierAssetsData)}`);

                    // get the last asset's max probability, and this is used as the max range for the random number.
                    const maxRange = filteredATierAssetsData[filteredATierAssetsData.length - 1].maxProbability;

                    // roll a random number between 0 and the max range.
                    const randomNumber = Math.floor(Math.random() * (maxRange + 1));

                    console.log(`(rollWonderspin) Random number for roll ${obtainedAssets.length}: ${randomNumber}`);

                    // find the asset that corresponds to the random number.
                    const obtainedAsset = filteredATierAssetsData.find(asset => randomNumber >= asset.minProbability && randomNumber <= asset.maxProbability);

                    console.log(`(rollWonderspin) Roll ${obtainedAssets.length} guaranteed A tier asset obtained: ${JSON.stringify(obtainedAsset)}`);

                    obtainedAssets.push({
                        assetType: obtainedAsset.assetType,
                        asset: obtainedAsset.asset,
                        amount: obtainedAsset.amount
                    });

                    // check if the asset obtained is a featured asset.
                    obtainedAssetIsFeatured = aTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false;
                }

                // if `obtainedAssetIsFeatured` is true, reset the `rollsUntilFortunePeak` counter back to `fortunePeakThreshold`.
                if (obtainedAssetIsFeatured && rollsUntilFortunePeak !== null) {
                    rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                }
                // reset the `rollsUntilFortuneBlessing` counter back to `fortuneBlessingThreshold`.
                rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                // reset the `rollsUntilFortuneSurge` counter back to `fortuneSurgeThreshold`.
                rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                // reset the `currentFortuneSurgeRoll` counter back to 0.
                currentFortuneSurgeRoll = 0;

                // continue to the next iteration.
                continue;
            // 3rd priority: check if `rollsUntilFortuneCrest` is NOT null AND is 0 (meaning guaranteed AT least a B tier asset).
            } else if (rollsUntilFortuneCrest !== null && rollsUntilFortuneCrest === 0) {
                // obtain AT least a B tier asset (so we will filter for B and A tier assets).
                const atLeastBTierAssets = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.B || asset.tier === WonderspinAssetTier.A);

                console.log(`(rollWonderspin) Obtaining AT LEAST a B tier asset from guaranteed B tier roll.`);

                // a checker to check if the asset obtained is a featured asset.
                // if yes, `rollsUntilFortunePeak` will also be reset back to `fortunePeakThreshold`.
                let obtainedAssetIsFeatured: boolean = false;

                // we don't need to check for null or 0 atLeastBTierAssets because this is taken care of in `addWonderspin`.
                // if somehow there is only 1 B or A tier asset, then we can just push that asset to the obtainedAssets array.
                if (atLeastBTierAssets.length === 1) {
                    obtainedAssets.push({
                        assetType: atLeastBTierAssets[0].assetType,
                        asset: atLeastBTierAssets[0].asset,
                        amount: atLeastBTierAssets[0].amount
                    });

                    // check if the asset obtained is a featured asset.
                    obtainedAssetIsFeatured = atLeastBTierAssets[0].featured;

                    console.log(`(rollWonderspin) Obtained AT LEAST a B tier asset from guaranteed B tier roll: ${JSON.stringify(atLeastBTierAssets[0])}`);
                } else {
                    // otherwise, if there are multiple B or A tier assets, we need to roll one of them based on their probability weights.
                    let currentMinProbability = 0;

                    // filter the assets with their min and max probability ranges.
                    // however, because an A tier asset is not guaranteed (B can also be obtained), we will need to fetch the `rollsUntilFortuneSurge` value as well as the `currentFortuneSurgeRoll` value.
                    // if `rollsUntilFortuneSurge` is 0, then the probability of obtaining an A tier asset will increase with each roll until it reaches `fortuneBlessingThreshold` rolls.
                    // the increase in probability is calculated by the formula: BPa + ((100 - BPa) / (fortuneBlessingThreshold - fortuneSurgeThreshold) * currentFortuneSurgeRoll)
                    
                }
            
            }
        }
        
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(rollWonderspin) ${err.message}`
        }
    }
}