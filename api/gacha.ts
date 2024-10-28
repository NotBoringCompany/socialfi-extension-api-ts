import { Asset, AssetType } from '../models/asset';
import { Food } from '../models/food';
import { Wonderspin, WonderspinAssetData, WonderspinAssetTier } from '../models/gacha';
import { Item, WonderspinTicketType } from '../models/item';
import { ExtendedResource, ExtendedResourceOrigin } from '../models/resource';
import { UserModel, UserWonderspinDataModel, WonderspinModel } from '../utils/constants/db';
import { WONDERSPIN_QUEUE } from '../utils/constants/gacha';
import { redis } from '../utils/constants/redis';
import { resources } from '../utils/constants/resource';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Fetches detailed data for all currently active Wonderspins.
 * 
 * This includes the probability to obtain each asset, the current rolls until the next fortune event, and so on.
 */
export const fetchCurrentActiveWonderspinData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        // the detailed data for each wonderspin
        const wonderspinData: Array<{
            wonderspin: string;
            wonderspinId: string;
            baseWonderspinData: {
                fortuneCrestThreshold: number | null,
                fortuneSurgeThreshold: number | null,
                fortuneBlessingThreshold: number | null,
                fortunePeakThreshold: number | null
            };
            userWonderspinData: {
                assetProbability: Array<{
                    assetType: 'item' | 'resource' | 'food' | 'igc',
                    assetTier: WonderspinAssetTier,
                    asset: AssetType | 'xCookies' | 'diamonds',
                    currentProbability: number,
                    amount: number
                }>,
                totalRolls: number,
                rollsUntilFortuneCrest: number | null,
                rollsUntilFortuneSurge: number | null,
                currentFortuneSurgeRoll: number,
                rollsUntilFortuneBlessing: number | null,
                rollsUntilFortunePeak: number | null
            };
        }> = [];

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: '(fetchCurrentWonderspinData) User not found.'
            }
        }

        const activeWonderspins = (await WonderspinModel.findOne({ active: true }).lean()) as Wonderspin[];

        if (!activeWonderspins) {
            return {
                status: Status.SUCCESS,
                message: '(fetchCurrentWonderspinData) No active Wonderspins found.',
                data: {
                    wonderspinData
                }
            }
        }

        const allUserWonderspinData = await UserWonderspinDataModel.find({ userId: user._id }).lean();

        // loop through each active wonderspin.
        // if the user has no data in that wonderspin, then return the default values.
        for (const wonderspin of activeWonderspins) {
            const userWonderspinData = allUserWonderspinData.find(data => data.wonderspinId === wonderspin._id);

            if (!userWonderspinData) {
                wonderspinData.push({
                    wonderspin: wonderspin.name,
                    wonderspinId: wonderspin._id,
                    baseWonderspinData: {
                        fortuneCrestThreshold: wonderspin.fortuneCrestThreshold,
                        fortuneSurgeThreshold: wonderspin.fortuneSurgeThreshold,
                        fortuneBlessingThreshold: wonderspin.fortuneBlessingThreshold,
                        fortunePeakThreshold: wonderspin.fortunePeakThreshold
                    },
                    userWonderspinData: {
                        assetProbability: wonderspin.assetData.map(asset => ({
                            assetType: asset.assetType,
                            assetTier: asset.tier,
                            asset: asset.asset,
                            currentProbability: asset.probabilityWeight,
                            amount: asset.amount
                        })),
                        totalRolls: 0,
                        rollsUntilFortuneCrest: wonderspin.fortuneCrestThreshold,
                        rollsUntilFortuneSurge: wonderspin.fortuneSurgeThreshold,
                        currentFortuneSurgeRoll: 1,
                        rollsUntilFortuneBlessing: wonderspin.fortuneBlessingThreshold,
                        rollsUntilFortunePeak: wonderspin.fortunePeakThreshold
                    }
                });

                continue;
            } else {
                // if the data exists, then we need to calculate the current probability of obtaining each asset.
                const assetProbability: Array<{
                    assetType: 'item' | 'resource' | 'food' | 'igc',
                    assetTier: WonderspinAssetTier,
                    asset: AssetType | 'xCookies' | 'diamonds',
                    amount: number,
                    currentProbability: number,
                    minProbabilityRange: number,
                    maxProbabilityRange: number
                }> = [];

                if (userWonderspinData.rollsUntilFortunePeak !== null && userWonderspinData.rollsUntilFortunePeak <= 1) {
                    // if the user is guaranteed a featured asset, then all featured assets will sum up to 100% probability, and the rest being 0%.
                    const featuredAssets = wonderspin.assetData.filter(asset => asset.featured);

                    // cumulative probability of obtaining featured assets.
                    const cumulativeProbability = featuredAssets.reduce((acc, asset) => acc + asset.probabilityWeight, 0);

                    if (featuredAssets.length === 1) {
                        assetProbability.push({
                            assetType: featuredAssets[0].assetType,
                            assetTier: featuredAssets[0].tier,
                            asset: featuredAssets[0].asset,
                            currentProbability: 100,
                            amount: featuredAssets[0].amount,
                            minProbabilityRange: 0,
                            maxProbabilityRange: featuredAssets[0].probabilityWeight - 1
                        });
                    } else {
                        let currentMinProbability = 0;

                        const filteredFeaturedAssetsData = featuredAssets.map((asset, index) => {
                            const minProbability = currentMinProbability;
                            const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                            currentMinProbability = maxProbability + 1;

                            return {
                                assetType: asset.assetType,
                                assetTier: asset.tier,
                                asset: asset.asset,
                                amount: asset.amount,
                                currentProbability: asset.probabilityWeight / cumulativeProbability * 100,
                                minProbabilityRange: minProbability,
                                maxProbabilityRange: maxProbability,
                            }
                        });

                        assetProbability.push(...filteredFeaturedAssetsData);
                    }

                    // add the rest of the non featured assets with 0% probability.
                    const nonFeaturedAssets = wonderspin.assetData.filter(asset => !asset.featured);

                    assetProbability.push(...nonFeaturedAssets.map(asset => {
                        return {
                            assetType: asset.assetType,
                            assetTier: asset.tier,
                            asset: asset.asset,
                            amount: asset.amount,
                            currentProbability: 0,
                            minProbabilityRange: null,
                            maxProbabilityRange: null
                        }
                    }));
                } else if (userWonderspinData.rollsUntilFortuneBlessing !== null && userWonderspinData.rollsUntilFortuneBlessing <= 1) {
                    // if the user is guaranteed an A tier asset, then all A tier assets will sum up to 100% probability, and the rest being 0%.
                    const aTierAssets = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.A);

                    // cumulative probability of obtaining A tier assets.
                    const cumulativeProbability = aTierAssets.reduce((acc, asset) => acc + asset.probabilityWeight, 0);

                    if (aTierAssets.length === 1) {
                        assetProbability.push({
                            assetType: aTierAssets[0].assetType,
                            assetTier: aTierAssets[0].tier,
                            asset: aTierAssets[0].asset,
                            amount: aTierAssets[0].amount,
                            currentProbability: 100,
                            minProbabilityRange: 0,
                            maxProbabilityRange: aTierAssets[0].probabilityWeight - 1
                        });
                    } else {
                        let currentMinProbability = 0;

                        const filteredATierAssetsData = aTierAssets.map((asset, index) => {
                            const minProbability = currentMinProbability;
                            const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                            currentMinProbability = maxProbability + 1;

                            return {
                                assetType: asset.assetType,
                                assetTier: asset.tier,
                                asset: asset.asset,
                                amount: asset.amount,
                                currentProbability: asset.probabilityWeight / cumulativeProbability * 100,
                                minProbabilityRange: minProbability,
                                maxProbabilityRange: maxProbability,
                            }
                        });

                        assetProbability.push(...filteredATierAssetsData);
                    }

                    // add the rest of the non A tier assets with 0% probability.
                    const nonATierAssets = wonderspin.assetData.filter(asset => asset.tier !== WonderspinAssetTier.A);

                    assetProbability.push(...nonATierAssets.map(asset => {
                        return {
                            assetType: asset.assetType,
                            assetTier: asset.tier,
                            asset: asset.asset,
                            amount: asset.amount,
                            currentProbability: 0,
                            minProbabilityRange: null,
                            maxProbabilityRange: null
                        }
                    }));
                } else if (userWonderspinData.rollsUntilFortuneCrest !== null && userWonderspinData.rollsUntilFortuneCrest <= 1) {
                    // if the user is guaranteed AT least a B tier asset, then all B and A tier assets will sum up to 100% probability, and the rest being 0%.
                    const atLeastBTierAssets = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.B || asset.tier === WonderspinAssetTier.A);

                    // we don't calculate cumulative probability here yet because there is a chance of fortune surge.
                    if (atLeastBTierAssets.length === 1) {
                        assetProbability.push({
                            assetType: atLeastBTierAssets[0].assetType,
                            assetTier: atLeastBTierAssets[0].tier,
                            asset: atLeastBTierAssets[0].asset,
                            amount: atLeastBTierAssets[0].amount,
                            currentProbability: 100,
                            minProbabilityRange: 0,
                            maxProbabilityRange: atLeastBTierAssets[0].probabilityWeight - 1
                        });
                    } else {
                        let currentMinProbability = 0;
                        const nonSurgedCumulativeProbability = atLeastBTierAssets.reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                        // if there are multiple B and A tier assets, we need to calculate the probability of obtaining each asset.
                        const filteredAtLeastBTierAssetsData = atLeastBTierAssets.map((asset, index) => {
                            const minProbability = currentMinProbability;
                            const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                            currentMinProbability = maxProbability + 1;

                            return {
                                assetType: asset.assetType,
                                assetTier: asset.tier,
                                asset: asset.asset,
                                amount: asset.amount,
                                currentProbability: asset.probabilityWeight / nonSurgedCumulativeProbability * 100,
                                minProbabilityRange: minProbability,
                                maxProbabilityRange: maxProbability,
                            }
                        });

                        // convert back to 0 to filter the assets further if the user is in a fortune surge.
                        currentMinProbability = 0;

                        // if the user is in a fortune surge, we need to calculate the increased probability of obtaining the A tier assets.
                        if (userWonderspinData.rollsUntilFortuneSurge !== null && userWonderspinData.rollsUntilFortuneSurge <= 1 && userWonderspinData.rollsUntilFortuneBlessing !== null) {
                            // get the current cumulative probability of obtaining ONLY an A tier asset.
                            // this is done by obtaining the sum of all A tier asset probability weights divided by the sum of all asset probability weights for both B and A tier assets.
                            // this will be used as the `BPa` of the formula.
                            const totalATierProbabilityWeight = atLeastBTierAssets.filter(asset => asset.tier === WonderspinAssetTier.A).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                            const BPa = totalATierProbabilityWeight / nonSurgedCumulativeProbability * 100;
                            // base probability of obtaining a B tier asset is 100 - BPa.
                            const BPb = 100 - BPa;

                            // calculate the new probability of obtaining an A tier asset (FPa, or fortune surge probability of obtaining an A tier asset).
                            const FPa = BPa  + ((100 - BPa) / (wonderspin.fortuneBlessingThreshold - wonderspin.fortuneSurgeThreshold) * userWonderspinData.currentFortuneSurgeRoll);
                            // the remaining probability % is now the probability of obtaining a B tier asset.
                            const FPb = 100 - FPa;

                            // update `filteredAtLeastBTierAssetsData` with the new probability values.
                            filteredAtLeastBTierAssetsData.forEach(asset => {
                                let updatedProbabilityWeight: number;

                                if (asset.assetTier === WonderspinAssetTier.A) {
                                    // scale the probability weight based on the new FPa.
                                    updatedProbabilityWeight = (FPa / BPa) * (asset.maxProbabilityRange + 1 - asset.minProbabilityRange);
                                } else {
                                    // scale the probability weight based on the new FPb.
                                    updatedProbabilityWeight = (FPb / BPb) * (asset.maxProbabilityRange + 1 - asset.minProbabilityRange);
                                }

                                // calculate min and max probability based on the updated probability weights.
                                const minProbability = currentMinProbability;
                                const maxProbability = currentMinProbability + updatedProbabilityWeight - 1;
                                currentMinProbability = maxProbability + 1;

                                // update asset's properties in the same array
                                asset.minProbabilityRange = minProbability;
                                asset.maxProbabilityRange = maxProbability;
                            });

                            // now that each asset is already updated with the new probabilities,
                            // we can also update the `currentProbability` field based on the new cumulative probability.
                            const newCumulativeProbability = filteredAtLeastBTierAssetsData.reduce((acc, asset) => acc + asset.maxProbabilityRange - asset.minProbabilityRange + 1, 0);

                            filteredAtLeastBTierAssetsData.forEach(asset => {
                                asset.currentProbability = (asset.maxProbabilityRange - asset.minProbabilityRange + 1) / newCumulativeProbability * 100;
                            });

                            // add the updated assets to the main array.
                            assetProbability.push(...filteredAtLeastBTierAssetsData);
                        }
                    }

                    // add the C tier assets with 0% probability.
                    const cTierAssets = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.C);

                    assetProbability.push(...cTierAssets.map(asset => {
                        return {
                            assetType: asset.assetType,
                            assetTier: asset.tier,
                            asset: asset.asset,
                            amount: asset.amount,
                            currentProbability: 0,
                            minProbabilityRange: null,
                            maxProbabilityRange: null
                        }
                    }));
                } else {
                    // if the user is not in any main fortune event (crest, blessing, peak), then we can calculate the probability normally.
                    // of course, the user can still be in a fortune surge, so we need to check for that as well.
                    if (wonderspin.assetData.length === 1) {
                        assetProbability.push({
                            assetType: wonderspin.assetData[0].assetType,
                            assetTier: wonderspin.assetData[0].tier,
                            asset: wonderspin.assetData[0].asset,
                            amount: wonderspin.assetData[0].amount,
                            currentProbability: 100,
                            minProbabilityRange: 0,
                            maxProbabilityRange: wonderspin.assetData[0].probabilityWeight - 1
                        });
                    } else {
                        let currentMinProbability = 0;
                        const currentCumulativeProbability = wonderspin.assetData.reduce((acc, asset) => acc + asset.probabilityWeight, 0);

                        const filteredAssetsData = wonderspin.assetData.map((asset, index) => {
                            const minProbability = currentMinProbability;
                            const maxProbability = currentMinProbability + asset.probabilityWeight - 1;

                            currentMinProbability = maxProbability + 1;

                            return {
                                assetType: asset.assetType,
                                assetTier: asset.tier,
                                asset: asset.asset,
                                amount: asset.amount,
                                currentProbability: asset.probabilityWeight / currentCumulativeProbability * 100,
                                minProbabilityRange: minProbability,
                                maxProbabilityRange: maxProbability,
                            }
                        });

                        // convert back to 0 to filter the assets further if the user is in a fortune surge.
                        currentMinProbability = 0;

                        // if the user is in a fortune surge, we need to calculate the increased probability of obtaining the A tier assets.
                        if (userWonderspinData.rollsUntilFortuneSurge !== null && userWonderspinData.rollsUntilFortuneSurge <= 1 && userWonderspinData.rollsUntilFortuneBlessing !== null) {
                            // get the current cumulative probability of obtaining ONLY an A tier asset.
                            // this is done by obtaining the sum of all A tier asset probability weights divided by the sum of all asset probability weights for all assets.
                            // this will be used as the `BPa` of the formula.
                            const totalATierProbabilityWeight = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.A).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                            const BPa = (totalATierProbabilityWeight / currentCumulativeProbability) * 100;
    
                            // get the current cumulative probability of obtaining ONLY a B tier asset.
                            // this is done by obtaining the sum of all B tier asset probability weights divided by the sum of all asset probability weights for all assets.
                            // this will be used as the `BPb` of the formula.
                            const totalBTierProbabilityWeight = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.B).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                            const BPb = (totalBTierProbabilityWeight / currentCumulativeProbability) * 100;
    
                            // get the current cumulative probability of obtaining ONLY a C tier asset.
                            // this is done by obtaining the sum of all C tier asset probability weights divided by the sum of all asset probability weights for all assets.
                            // this will be used as the `BPc` of the formula.
                            const totalCTierProbabilityWeight = wonderspin.assetData.filter(asset => asset.tier === WonderspinAssetTier.C).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                            // we can also use the reduce function to get BPc, but we can just calculate it this way:
                            const BPc = 100 - (BPa + BPb); 

                            // calculate the new probability of obtaining an A tier asset (FPa, or fortune surge probability of obtaining an A tier asset).
                            const FPa = BPa  + ((100 - BPa) / (wonderspin.fortuneBlessingThreshold - wonderspin.fortuneSurgeThreshold) * userWonderspinData.currentFortuneSurgeRoll);
                            // to calculate the proprtional decrease in probability of obtaining a B tier asset, we can use the formula:
                            const FPb = BPb - ((BPb / (BPb + BPc)) * (FPa - BPa));
                            // to calculate the proprtional decrease in probability of obtaining a C tier asset, we can use the formula:
                            const FPc = BPc - ((BPc / (BPb + BPc)) * (FPa - BPa));

                            // update `filteredAssetsData` with the new probability values.
                            filteredAssetsData.forEach(asset => {
                                let updatedProbabilityWeight: number;

                                if (asset.assetTier === WonderspinAssetTier.A) {
                                    // scale the probability weight based on the new FPa.
                                    updatedProbabilityWeight = (FPa / BPa) * (asset.maxProbabilityRange + 1 - asset.minProbabilityRange);
                                } else if (asset.assetTier === WonderspinAssetTier.B) {
                                    // scale the probability weight based on the new FPb.
                                    updatedProbabilityWeight = (FPb / BPb) * (asset.maxProbabilityRange + 1 - asset.minProbabilityRange);
                                } else {
                                    // scale the probability weight based on the new FPc.
                                    updatedProbabilityWeight = (FPc / BPc) * (asset.maxProbabilityRange + 1 - asset.minProbabilityRange);
                                }

                                // calculate min and max probability based on the updated probability weights.
                                const minProbability = currentMinProbability;
                                const maxProbability = currentMinProbability + updatedProbabilityWeight - 1;
                                currentMinProbability = maxProbability + 1;

                                // update asset's properties in the same array
                                asset.minProbabilityRange = minProbability;
                                asset.maxProbabilityRange = maxProbability;
                            });

                            // now that each asset is already updated with the new probabilities,
                            // we can also update the `currentProbability` field based on the new cumulative probability.
                            const newCumulativeProbability = filteredAssetsData.reduce((acc, asset) => acc + asset.maxProbabilityRange - asset.minProbabilityRange + 1, 0);
                            
                            filteredAssetsData.forEach(asset => {
                                asset.currentProbability = (asset.maxProbabilityRange - asset.minProbabilityRange + 1) / newCumulativeProbability * 100;
                            });

                            // add the updated assets to the main array.
                            assetProbability.push(...filteredAssetsData);
                        }
                    }
                }

                // add the data to the main array.
                wonderspinData.push({
                    wonderspin: wonderspin.name,
                    wonderspinId: wonderspin._id,
                    baseWonderspinData: {
                        fortuneCrestThreshold: wonderspin.fortuneCrestThreshold,
                        fortuneSurgeThreshold: wonderspin.fortuneSurgeThreshold,
                        fortuneBlessingThreshold: wonderspin.fortuneBlessingThreshold,
                        fortunePeakThreshold: wonderspin.fortunePeakThreshold
                    },
                    userWonderspinData: {
                        assetProbability,
                        totalRolls: userWonderspinData.totalRolls,
                        rollsUntilFortuneCrest: userWonderspinData.rollsUntilFortuneCrest,
                        rollsUntilFortuneSurge: userWonderspinData.rollsUntilFortuneSurge,
                        currentFortuneSurgeRoll: userWonderspinData.currentFortuneSurgeRoll,
                        rollsUntilFortuneBlessing: userWonderspinData.rollsUntilFortuneBlessing,
                        rollsUntilFortunePeak: userWonderspinData.rollsUntilFortunePeak
                    }
                });
            }
        }

        // for each wonderspin, calculate the total `currentProbability` to ensure they add up to ~100.
        for (const wonderspin of wonderspinData) {
            console.log(`(fetchCurrentWonderspinData) Wonderspin with name ${wonderspin.wonderspin} has a total cumulative probability percentage of ${wonderspin.userWonderspinData.assetProbability.reduce((acc, asset) => acc + asset.currentProbability, 0)}.`);
        }

        return {
            status: Status.SUCCESS,
            message: '(fetchCurrentWonderspinData) All data fetched successfully.',
            data: {
                wonderspinData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchCurrentWonderspinData) ${err.message}`
        }
    }
}

/**
 * Fetches all of a user's Wonderspin data.
 */
export const fetchUserWonderspinData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: '(fetchAllUserWonderspinData) User not found.'
            }
        }

        const userWonderspinData = await UserWonderspinDataModel.find({ userId: user._id }).lean();

        return {
            status: Status.SUCCESS,
            message: '(fetchUserWonderspinData) fetched successfully.',
            data: {
                userWonderspinData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchUserWonderspinData) ${err.message}`
        }
    }
}

/**
 * Adds a new Wonderspin type to the database.
 */
export const addWonderspin = async (
    name: string,
    ticketType: WonderspinTicketType,
    active: boolean = true,
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

        // if `fortuneSurgeThreshold` is not null, then `fortuneBlessingThreshold` must ALSO not be null.
        if (fortuneSurgeThreshold !== null && fortuneBlessingThreshold === null) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortuneSurgeThreshold` must also have a `fortuneBlessingThreshold`.'
            }
        }

        // if `fortuneBlessingThreshold` or `fortuneSurgeThreshold` is not null and there is no A tier asset, throw an error.
        if ((fortuneBlessingThreshold !== null || fortuneSurgeThreshold !== null) && assetData.every(asset => asset.tier !== WonderspinAssetTier.A)) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortuneBlessingThreshold` or `fortuneSurgeThreshold` must have at least one A tier asset.'
            }
        }

        // if `fortuneCrestThreshold` is not null and there is no B OR A tier asset, throw an error.
        if (fortuneCrestThreshold !== null && assetData.every(asset => asset.tier !== WonderspinAssetTier.B && asset.tier !== WonderspinAssetTier.A)) {
            return {
                status: Status.ERROR,
                message: '(addWonderspin) A Wonderspin with a `fortuneCrestThreshold` must have at least one B or A tier asset.'
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
            active,
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
    const lockKey = `rollWonderspin:${twitterId}`;
    // lock expiration time is 10 seconds (10000 ms)
    const lockTTL = 10000;

    // acquire the redis lock
    const lock = await redis.set(lockKey, 'locked', 'PX', lockTTL);

    if (!lock) {
        return {
            status: Status.ERROR,
            message: '(rollWonderspin) Another Wonderspin is currently being rolled. Please wait a moment and try again.'
        }
    }

    try {
        // add the user to the queue to roll the Wonderspin
        const job = await WONDERSPIN_QUEUE.add('rollWonderspin', {
            twitterId,
            ticket,
            wonderspin,
            amount
        });

        // wait until the job finishes processing to get the result
        const { status, message, data }= await job.finished();

        console.log(`(rollWonderspin) Job with ID ${job.id} has finished processing.`);

        return {
            status: Status.SUCCESS,
            message: `(rollWonderspin) Successfully rolled the wonderspin and updated the user's inventory.`,
            data: {
                obtainedAssets: data.obtainedAssets
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(rollWonderspin) ${err.message}`
        }
    } finally {
        await redis.del(lockKey);
    }
}