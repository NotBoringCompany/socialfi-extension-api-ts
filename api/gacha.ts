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
    const lockKey = `rollWonderspinLock:${twitterId}`;
    const lockTTL = 5000; // lock expiration time in milliseconds;

    // acquire the redis lock
    const lock = await redis.set(lockKey, 'locked', 'PX', lockTTL);
    if (!lock) {
        return {
            status: Status.ERROR,
            message: '(rollWonderspin) Another spin is currently in progress. Please wait a moment and try again.'
        }
    }

    try {
        // used to store the assets obtained from the roll.
        const obtainedAssets: Array<{
            assetType: 'item' | 'resource' | 'food' | 'igc',
            assetTier: WonderspinAssetTier,
            isFeatured: boolean,
            asset: AssetType | 'xCookies' | 'diamonds',
            normalProbability: number,
            surgedProbability: number | null,
            amount: number
        }> = [];

        const job = await WONDERSPIN_QUEUE.add('rollWonderspin', { twitterId, ticket, wonderspin, amount });
        const result = await WONDERSPIN_QUEUE.getJob(job.id).then(async (job) => {
            if (job) {
                if (![1, 5, 10].includes(amount)) {
                    return {
                        status: Status.ERROR,
                        message: '(rollWonderspin) Invalid amount.'
                    }
                }
        
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
        
                // check if the `active` field is true.
                if (!wonderspinData.active) {
                    return {
                        status: Status.ERROR,
                        message: '(rollWonderspin) Wonderspin is currently inactive.'
                    }
                }
        
        
                // check if the ticket inputted matches the ticket type of the Wonderspin.
                if (wonderspinData.ticketType !== ticket) {
                    return {
                        status: Status.ERROR,
                        message: `(rollWonderspin) Ticket type does not match the Wonderspin's required ticket type.`
                    }
                }
        
                // consume the ticket.
                userUpdateOperations.$inc[`inventory.items.${ticketIndex}.amount`] = -amount;
                // increase the `weeklyAmountConsumed` and `totalAmountConsumed` fields.
                userUpdateOperations.$inc[`inventory.items.${ticketIndex}.weeklyAmountConsumed`] = amount;
                userUpdateOperations.$inc[`inventory.items.${ticketIndex}.totalAmountConsumed`] = amount;
        
                // the user might not have the data yet, so no need to check for null/undefined.
                const userWonderspinData = await UserWonderspinDataModel.findOne({ userId: user._id, wonderspinId: wonderspinData._id }).lean();
                
                // get the `rollsUntilFortuneCrest`, `rollsUntilFortuneSurge`, `currentFortuneSurgeRoll`, `rollsUntilFortuneBlessing`, and `rollsUntilFortunePeak` values.
                // for each instance, apart from `currentFortuneSurgeRoll`:
                // 1. check the wonderspin data (not the user data). if the value is null, set each value to null as well.
                // 2. if the value is not null, check the user wonderspin data. if the user wonderspin data is undefined, set the value to the threshold value.
                // 3. if the user wonderspin data is defined, fetch the value from there.
                let rollsUntilFortuneCrest: number | null = null;
                let rollsUntilFortuneSurge: number | null = null;
                let currentFortuneSurgeRoll: number = 1;
                let rollsUntilFortuneBlessing: number | null = null;
                let rollsUntilFortunePeak: number | null = null;
                let totalRolls: number = 0;
        
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
        
                if (userWonderspinData) {
                    currentFortuneSurgeRoll = userWonderspinData.currentFortuneSurgeRoll;
                    totalRolls = userWonderspinData.totalRolls;
                }
        
                while (obtainedAssets.length < amount) {
                    console.log(`(rollWonderspin) Roll ${obtainedAssets.length + 1}...`);
                    
                    // the order of priority is:
                    // 1. featured asset (if rollsUntilFortunePeak is NOT null AND is 0)
                    // 2. A tier asset (if rollsUntilFortuneBlessing is NOT null AND is 0)
                    // 3. B tier asset (if rollsUntilFortuneCrest is NOT null AND is 0)
                    // otherwise, the asset is randomly rolled based on the probability weights of each asset.
                    // NOTE: once `rollsUntilFortuneSurge` reaches 0, the `currentFortuneSurgeRoll` will increase by 1 until an A tier asset is obtained.
                    // this will also increase the cumulative probability of obtaining an A tier asset on the next roll based on the formula found in `UserWonderspinData.currentFortuneSurgeRoll`:
                    // BPa + ((100 - BPa) / (fortuneBlessingThreshold - fortuneSurgeThreshold) * currentFortuneSurgeRoll)
        
                    // check if `rollsUntilFortunePeak` is NOT null AND is 1 (we put <=1 just in case) (meaning a guaranteed featured asset).
                    if (rollsUntilFortunePeak !== null && rollsUntilFortunePeak <= 1) {
                        // obtain a featured asset.
                        const featuredAssets = wonderspinData.assetData.filter(asset => asset.featured);
        
                        console.log(`(rollWonderspin) Obtaining a featured asset...`);
        
                        // we don't need to check for null or 0 featuredAssets because this is taken care of in `addWonderspin`.
                        // if there is only 1 featured asset, then we can just push that asset to the obtainedAssets array.
                        if (featuredAssets.length === 1) {
                            console.log(`(rollWonderspin) Obtained featured asset from guaranteed featured roll: ${JSON.stringify(featuredAssets[0])}`);
        
                            obtainedAssets.push({
                                assetType: featuredAssets[0].assetType,
                                assetTier: featuredAssets[0].tier,
                                isFeatured: true,
                                asset: featuredAssets[0].asset,
                                normalProbability: 100,
                                surgedProbability: null,
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
                                    probabilityWeight: asset.probabilityWeight,
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
        
                            console.log(`(rollWonderspin) Roll ${obtainedAssets.length + 1} guaranteed featured asset obtained: ${JSON.stringify(obtainedAsset)}`);
        
                            obtainedAssets.push({
                                assetType: obtainedAsset.assetType,
                                assetTier: WonderspinAssetTier.A,
                                isFeatured: true,
                                asset: obtainedAsset.asset,
                                normalProbability: obtainedAsset.probabilityWeight / maxRange * 100,
                                surgedProbability: null,
                                amount: obtainedAsset.amount
                            });
                        }
        
                        // reset the `rollsUntilFortunePeak` counter back to `fortunePeakThreshold`.
                        rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                        // reset the `rollsUntilFortuneBlessing` counter back to `fortuneBlessingThreshold`, because featured assets are considered as A tier assets.
                        rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                        // reset the `rollsUntilFortuneSurge` counter back to `fortuneSurgeThreshold`, because obtaining a featured asset is also considered as obtaining an A tier asset.
                        rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                        // reset the `currentFortuneSurgeRoll` counter back to 1.
                        currentFortuneSurgeRoll = 1;
                        // increase the `totalRolls` counter by 1.
                        totalRolls++;
        
                        // continue to the next iteration.
                        continue;
                    // 2nd priority: check if `rollsUntilFortuneBlessing` is NOT null AND is 1 (we put <=1 just in case) (meaning a guaranteed A tier asset).
                    } else if (rollsUntilFortuneBlessing !== null && rollsUntilFortuneBlessing <= 1) {
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
                                assetTier: aTierAssets[0].tier,
                                isFeatured: aTierAssets[0].featured,
                                asset: aTierAssets[0].asset,
                                normalProbability: 100,
                                surgedProbability: null,
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
                                    probabilityWeight: asset.probabilityWeight,
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
                                assetTier: WonderspinAssetTier.A,
                                isFeatured: aTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false,
                                asset: obtainedAsset.asset,
                                normalProbability: obtainedAsset.probabilityWeight / maxRange * 100,
                                surgedProbability: null,
                                amount: obtainedAsset.amount
                            });
        
                            // check if the asset obtained is a featured asset.
                            obtainedAssetIsFeatured = aTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false;
                        }
        
                        // if `obtainedAssetIsFeatured` is true, reset the `rollsUntilFortunePeak` counter back to `fortunePeakThreshold`.
                        if (obtainedAssetIsFeatured) {
                            rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                        } else {
                            // if not, reduce the `rollsUntilFortunePeak` counter by 1. if already 1, then it will remain as 1.
                            // well, it shouldn't be `1` anyways because the first `if` condition should be true.
                            // however, we will add this just in case.
                            if (rollsUntilFortunePeak !== null && rollsUntilFortunePeak > 1) {
                                rollsUntilFortunePeak--;
                            }
                        }
        
                        // reset the `rollsUntilFortuneBlessing` counter back to `fortuneBlessingThreshold`.
                        rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                        // reset the `rollsUntilFortuneSurge` counter back to `fortuneSurgeThreshold`.
                        rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                        // reset the `currentFortuneSurgeRoll` counter back to 1.
                        currentFortuneSurgeRoll = 1;
                        // increase the `totalRolls` counter by 1.
                        totalRolls++;
        
                        // continue to the next iteration.
                        continue;
                    // 3rd priority: check if `rollsUntilFortuneCrest` is NOT null AND is 1 (we put <=1 just in case) (meaning guaranteed AT least a B tier asset).
                    } else if (rollsUntilFortuneCrest !== null && rollsUntilFortuneCrest <= 1) {
                        // obtain AT least a B tier asset (so we will filter for B and A tier assets).
                        const atLeastBTierAssets = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.B || asset.tier === WonderspinAssetTier.A);
        
                        console.log(`(rollWonderspin) Obtaining AT LEAST a B tier asset from guaranteed B tier roll.`);
        
                        // a checker to check if the asset obtained is a featured asset.
                        // if yes, `rollsUntilFortunePeak` will also be reset back to `fortunePeakThreshold`.
                        let obtainedAssetIsFeatured: boolean = false;
                        // a checker to check if the asset obtained is an A tier asset.
                        let obtainedAssetIsATier: boolean = false;
        
                        // we don't need to check for null or 0 atLeastBTierAssets because this is taken care of in `addWonderspin`.
                        // if somehow there is only 1 B or A tier asset, then we can just push that asset to the obtainedAssets array.
                        if (atLeastBTierAssets.length === 1) {
                            obtainedAssets.push({
                                assetType: atLeastBTierAssets[0].assetType,
                                assetTier: atLeastBTierAssets[0].tier,
                                isFeatured: atLeastBTierAssets[0].featured,
                                asset: atLeastBTierAssets[0].asset,
                                normalProbability: 100,
                                surgedProbability: null,
                                amount: atLeastBTierAssets[0].amount
                            });
        
                            // check if the asset obtained is a featured asset.
                            obtainedAssetIsFeatured = atLeastBTierAssets[0].featured;
                            // check if the asset obtained is an A tier asset.
                            // featured assets are technically A tier, but for the sake of the roll counter updates, it won't count as an A tier asset.
                            obtainedAssetIsATier = atLeastBTierAssets[0].tier === WonderspinAssetTier.A && !obtainedAssetIsFeatured;
        
                            console.log(`(rollWonderspin) Obtained AT LEAST a B tier asset from guaranteed B tier roll: ${JSON.stringify(atLeastBTierAssets[0])}`);
                        } else {
                            // otherwise, if there are multiple B or A tier assets, we need to roll one of them based on their probability weights.
                            let currentMinProbability = 0;
        
                            // filter the assets with their min and max probability ranges.
                            // however, because an A tier asset is not guaranteed (B can also be obtained), we will need to fetch the `rollsUntilFortuneSurge` value as well as the `currentFortuneSurgeRoll` value.
                            // if `rollsUntilFortuneSurge` is 0, then the probability of obtaining an A tier asset will increase with each roll until it reaches `fortuneBlessingThreshold` rolls.
                            // the increase in probability is calculated by the formula: BPa + ((100 - BPa) / (fortuneBlessingThreshold - fortuneSurgeThreshold) * currentFortuneSurgeRoll)
        
                            // first, we filter the assets.
                            const filteredAtLeastBTierAssetsData = atLeastBTierAssets.map((asset, index) => {
                                const minProbability = currentMinProbability;
                                const maxProbability = currentMinProbability + asset.probabilityWeight - 1;
        
                                currentMinProbability = maxProbability + 1;
        
                                return {
                                    assetType: asset.assetType,
                                    assetTier: asset.tier,
                                    asset: asset.asset,
                                    amount: asset.amount,
                                    probabilityWeight: asset.probabilityWeight,
                                    minProbability: minProbability,
                                    maxProbability: maxProbability,
                                }
                            });
        
                            // let currentMinProbability back to 0 to filter the assets further later.
                            currentMinProbability = 0;
        
                            console.log(`(rollWonderspin) Filtered AT LEAST B tier assets data: ${JSON.stringify(filteredAtLeastBTierAssetsData)}`);
        
                            // we will need to calculate the increased probability of obtaining an A tier asset IF:
                            // 1. `rollsUntilFortuneSurge` is NOT null AND is 1 (we put <=1 just in case)
                            // AND
                            // 2. `rollsUntilFortuneBlessing` is NOT null
                            if (rollsUntilFortuneSurge !== null && rollsUntilFortuneSurge <= 1 && rollsUntilFortuneBlessing !== null) {
                                console.log(`(rollWonderspin) Guaranteed at least B tier asset, and rolls until fortune surge is 0. Calculating increased probability of obtaining an A tier asset...`);
        
                                // get the current cumulative probability of obtaining ONLY an A tier asset.
                                // this is done by obtaining the sum of all A tier asset probability weights divided by the sum of all asset probability weights for both B and A tier assets.
                                // this will be used as the `BPa` of the formula.
                                const totalATierProbabilityWeight = atLeastBTierAssets.filter(asset => asset.tier === WonderspinAssetTier.A).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                                const BPa = (totalATierProbabilityWeight / atLeastBTierAssets.reduce((acc, asset) => acc + asset.probabilityWeight, 0)) * 100;
                                // base probability of obtaining a B tier asset is 100 - BPa.
                                const BPb = 100 - BPa;
        
                                console.log(`(rollWonderspin) Current cumulative probability of obtaining an A tier asset: ${BPa}%`);
                                console.log(`(rollWonderspin) Current cumulative probability of obtaining a B tier asset: ${100 - BPa}%`);
        
                                // calculate the new probability of obtaining an A tier asset (FPa, or fortune surge probability of obtaining an A tier asset).
                                const FPa = BPa  + ((100 - BPa) / (wonderspinData.fortuneBlessingThreshold - wonderspinData.fortuneSurgeThreshold) * currentFortuneSurgeRoll);
        
                                console.log(`(rollWonderspin) Calculated fortune surge probability of obtaining an A tier asset: ${FPa}%`);
                                console.log(`(rollWonderspin) Calculated fortune surge probability of obtaining a B tier asset: ${100 - FPa}%`);
        
                                // the remaining probability % is now the cumulative probability of obtaining a B tier asset (FPb).
                                const FPb = 100 - FPa;
        
                                // update `filteredAtLeastBTierAssetsData` with the new probability weight for the B and A tier assets.
                                filteredAtLeastBTierAssetsData.forEach(asset => {
                                    let updatedProbabilityWeight: number;
        
                                    if (asset.assetTier === WonderspinAssetTier.A) {
                                        // scale the probability weight based on the new FPa.
                                        updatedProbabilityWeight = (FPa / BPa) * asset.probabilityWeight;
                                    } else {
                                        // scale the probability weight based on the new FPb.
                                        updatedProbabilityWeight = (FPb / BPb) * asset.probabilityWeight;
                                    }
        
                                    // calculate min and max probability based on the updated probability weights.
                                    const minProbability = currentMinProbability;
                                    const maxProbability = currentMinProbability + updatedProbabilityWeight - 1;
                                    currentMinProbability = maxProbability + 1;
        
                                    // update asset's properties in the same array
                                    asset.minProbability = minProbability;
                                    asset.maxProbability = maxProbability;
                                    asset.probabilityWeight = updatedProbabilityWeight;
                                });
        
                                console.log(`(rollWonderspin) Updated AT LEAST B tier assets data with new probability weights from fortune surge: ${JSON.stringify(filteredAtLeastBTierAssetsData)}`);
                            }
                            // if `rollsUntilFortuneSurge` is NOT null AND is NOT 0, then we can just roll the assets normally.
                            // this is because the probability of obtaining an A tier asset is not increased yet, so the probabilities for B and A tier assets are the same.
        
                            // get the last asset's max probability, and this is used as the max range for the random number.
                            const maxRange = filteredAtLeastBTierAssetsData[filteredAtLeastBTierAssetsData.length - 1].maxProbability;
        
                            // roll a random number between 0 and the max range.
                            const randomNumber = Math.floor(Math.random() * (maxRange + 1));
        
                            console.log(`(rollWonderspin) Random number for roll ${obtainedAssets.length}: ${randomNumber}`);
        
                            // find the asset that corresponds to the random number.
                            const obtainedAsset = filteredAtLeastBTierAssetsData.find(asset => randomNumber >= asset.minProbability && randomNumber <= asset.maxProbability);
        
                            console.log(`(rollWonderspin) Roll ${obtainedAssets.length} guaranteed AT LEAST B tier asset obtained: ${JSON.stringify(obtainedAsset)}`);
        
                            obtainedAssets.push({
                                assetType: obtainedAsset.assetType,
                                assetTier: obtainedAsset.assetTier,
                                isFeatured: atLeastBTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false,
                                asset: obtainedAsset.asset,
                                // to get the normal probability, we need the base filtered data, not the updated one with updated probabilities.
                                // max range will also need to be manually calculated, because `maxRange` is based on the updated probabilities.
                                normalProbability: atLeastBTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.probabilityWeight / atLeastBTierAssets.reduce((acc, asset) => acc + asset.probabilityWeight, 0) * 100,
                                surgedProbability: obtainedAsset.probabilityWeight / maxRange * 100,
                                amount: obtainedAsset.amount
                            });
        
                            // check if the asset obtained is a featured asset.
                            obtainedAssetIsFeatured = atLeastBTierAssets.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false;
                            // check if the asset obtained is an A tier asset.
                            // featured assets are technically A tier, but for the sake of the roll counter updates, it won't count as an A tier asset.
                            obtainedAssetIsATier = obtainedAsset.assetTier === WonderspinAssetTier.A && !obtainedAssetIsFeatured;
                        }
        
                        // if `obtainedAssetIsFeatured` is true:
                        // 1. `rollsUntilFortunePeak` will be reset to `fortunePeakThreshold`.
                        // 2. `rollsUntilFortuneBlessing` will be reset to `fortuneBlessingThreshold`.
                        // 3. `rollsUntilFortuneSurge` will be reset to `fortuneSurgeThreshold`.
                        // 4. `currentFortuneSurgeRoll` will be reset to 1.
                        if (obtainedAssetIsFeatured) {
                            rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                            rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                            rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                            currentFortuneSurgeRoll = 1;
                        }
        
                        // if `obtainedAssetIsATier` is true:
                        // 1. `rollsUntilFortunePeak` will be decremented by 1 if not null, because the user didn't get a featured asset.
                        // 2. `rollsUntilFortuneBlessing` will be reset to `fortuneBlessingThreshold`.
                        // 3. `rollsUntilFortuneSurge` will be reset to `fortuneSurgeThreshold`.
                        // 4. `currentFortuneSurgeRoll` will be reset to 1.
                        if (obtainedAssetIsATier) {
                            if (rollsUntilFortunePeak !== null) {
                                rollsUntilFortunePeak--;
                            }
        
                            rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                            rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                            currentFortuneSurgeRoll = 1;
                        }
        
                        // if BOTH `obtainedAssetIsFeatured` and `obtainedAssetIsATier` are false, then the user has obtained a B tier asset, meaning:
                        // 1. `rollsUntilFortunePeak` will be decremented by 1 if not null, because the user didn't get a featured asset.
                        // 2. `rollsUntilFortuneBlessing` will be decremented by 1 if not null, because the user didn't get an A tier asset.
                        // 3. `rollsUntilFortuneSurge` will be decremented if not 1 (we put <=1 just in case). if 1, then the `currentFortuneSurgeRoll` will increase by 1.
                        // 4. `rollsUntilFortuneCrest` will be reset to `fortuneCrestThreshold`.
                        if (!obtainedAssetIsFeatured && !obtainedAssetIsATier) {
                            if (rollsUntilFortunePeak !== null) {
                                rollsUntilFortunePeak--;
                            }
        
                            if (rollsUntilFortuneBlessing !== null) {
                                rollsUntilFortuneBlessing--;
                            }
        
                            if (rollsUntilFortuneSurge !== null) {
                                if (rollsUntilFortuneSurge <= 1) {
                                    currentFortuneSurgeRoll++;
                                } else {
                                    rollsUntilFortuneSurge--;
                                }
                            }
        
                            rollsUntilFortuneCrest = wonderspinData.fortuneCrestThreshold;
                        }
        
                        // increase the `totalRolls` counter by 1.
                        totalRolls++;
                        // continue to the next iteration.
                        continue;
                    // 4th priority: asset is randomly rolled based on the probability weights of each asset.
                    } else {
                        console.log(`(rollWonderspin) Rolling asset normally based on probability weights...`);
        
                        let obtainedAssetIsFeatured: boolean = false;
                        let obtainedAssetIsATier: boolean = false;
                        let obtainedAssetIsBTier: boolean = false;
        
                        // if there is only 1 asset, then we can just push that asset to the obtainedAssets array.
                        if (wonderspinData.assetData.length === 1) {
                            obtainedAssets.push({
                                assetType: wonderspinData.assetData[0].assetType,
                                assetTier: wonderspinData.assetData[0].tier,
                                isFeatured: wonderspinData.assetData[0].featured,
                                asset: wonderspinData.assetData[0].asset,
                                normalProbability: 100,
                                surgedProbability: null,
                                amount: wonderspinData.assetData[0].amount
                            });
        
                            // check if the asset obtained is a featured asset.
                            obtainedAssetIsFeatured = wonderspinData.assetData[0].featured;
                            // check if the asset obtained is an A tier asset.
                            // featured assets are technically A tier, but for the sake of the roll counter updates, it won't count as an A tier asset.
                            obtainedAssetIsATier = wonderspinData.assetData[0].tier === WonderspinAssetTier.A && !obtainedAssetIsFeatured;
                            // check if the asset obtained is a B tier asset.
                            obtainedAssetIsBTier = wonderspinData.assetData[0].tier === WonderspinAssetTier.B;
        
                            console.log(`(rollWonderspin) Obtained asset from normal roll: ${JSON.stringify(wonderspinData.assetData[0])}`);
                        } else {
                            // otherwise, if there are multiple assets, we need to roll one of them based on their probability weights.
                            let currentMinProbability = 0;
        
                            // filter the assets with their min and max probability ranges.
                            const filteredAssetsData = wonderspinData.assetData.map((asset, index) => {
                                const minProbability = currentMinProbability;
                                const maxProbability = currentMinProbability + asset.probabilityWeight - 1;
        
                                currentMinProbability = maxProbability + 1;
        
                                return {
                                    assetType: asset.assetType,
                                    assetTier: asset.tier,
                                    asset: asset.asset,
                                    amount: asset.amount,
                                    probabilityWeight: asset.probabilityWeight,
                                    minProbability: minProbability,
                                    maxProbability: maxProbability,
                                }
                            });
        
                            // let currentMinProbability back to 0 to filter the assets further later.
                            currentMinProbability = 0;
        
                            console.log(`(rollWonderspin) Filtered assets data: ${JSON.stringify(filteredAssetsData)}`);
        
                            // we will need to calculate the increased probability of obtaining an A tier asset IF:
                            // 1. `rollsUntilFortuneSurge` is NOT null AND is 1 (we put <=1 just in case)
                            // AND
                            // 2. `rollsUntilFortuneBlessing` is NOT null
                            if (rollsUntilFortuneSurge !== null && rollsUntilFortuneSurge <= 1 && rollsUntilFortuneBlessing !== null) {
                                console.log(`(rollWonderspin) Normal roll, and rolls until fortune surge is 1. Calculating increased probability of obtaining an A tier asset...`);
        
                                // get the current cumulative probability of obtaining ONLY an A tier asset.
                                // this is done by obtaining the sum of all A tier asset probability weights divided by the sum of all asset probability weights for all assets.
                                // this will be used as the `BPa` of the formula.
                                const totalATierProbabilityWeight = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.A).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                                const BPa = (totalATierProbabilityWeight / wonderspinData.assetData.reduce((acc, asset) => acc + asset.probabilityWeight, 0)) * 100;
        
                                // get the current cumulative probability of obtaining ONLY a B tier asset.
                                // this is done by obtaining the sum of all B tier asset probability weights divided by the sum of all asset probability weights for all assets.
                                // this will be used as the `BPb` of the formula.
                                const totalBTierProbabilityWeight = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.B).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                                const BPb = (totalBTierProbabilityWeight / wonderspinData.assetData.reduce((acc, asset) => acc + asset.probabilityWeight, 0)) * 100;
        
                                // get the current cumulative probability of obtaining ONLY a C tier asset.
                                // this is done by obtaining the sum of all C tier asset probability weights divided by the sum of all asset probability weights for all assets.
                                // this will be used as the `BPc` of the formula.
                                const totalCTierProbabilityWeight = wonderspinData.assetData.filter(asset => asset.tier === WonderspinAssetTier.C).reduce((acc, asset) => acc + asset.probabilityWeight, 0);
                                // we can also use the reduce function to get BPc, but we can just calculate it this way:
                                const BPc = 100 - (BPa + BPb);
        
                                console.log(`(rollWonderspin) Current cumulative probability of obtaining an A tier asset: ${BPa}%`);
                                console.log(`(rollWonderspin) Current cumulative probability of obtaining a B tier asset: ${BPb}%`);
                                console.log(`(rollWonderspin) Current cumulative probability of obtaining a C tier asset: ${BPc}%`);
        
                                // calculate the new probability of obtaining an A tier asset (FPa, or fortune surge probability of obtaining an A tier asset).
                                const FPa = BPa  + ((100 - BPa) / (wonderspinData.fortuneBlessingThreshold - wonderspinData.fortuneSurgeThreshold) * currentFortuneSurgeRoll);
        
                                console.log(`(rollWonderspin) Calculated fortune surge probability of obtaining an A tier asset: ${FPa}%`);
        
                                // to calculate the proprtional decrease in probability of obtaining a B tier asset, we can use the formula:
                                const FPb = BPb - ((BPb / (BPb + BPc)) * (FPa - BPa));
                                // to calculate the proprtional decrease in probability of obtaining a C tier asset, we can use the formula:
                                const FPc = BPc - ((BPc / (BPb + BPc)) * (FPa - BPa));
        
                                console.log(`(rollWonderspin) Calculated fortune surge probability of obtaining a B tier asset: ${FPb}%`);
                                console.log(`(rollWonderspin) Calculated fortune surge probability of obtaining a C tier asset: ${FPc}%`);
        
                                // update `filteredAssetsData` with the new probability weight for the C, B, and A tier assets.
                                filteredAssetsData.forEach(asset => {
                                    let updatedProbabilityWeight: number;
        
                                    if (asset.assetTier === WonderspinAssetTier.A) {
                                        // scale the probability weight based on the new FPa.
                                        updatedProbabilityWeight = (FPa / BPa) * asset.probabilityWeight;
                                    } else if (asset.assetTier === WonderspinAssetTier.B) {
                                        // scale the probability weight based on the new FPb.
                                        updatedProbabilityWeight = (FPb / BPb) * asset.probabilityWeight;
                                    } else {
                                        // scale the probability weight based on the new FPc.
                                        updatedProbabilityWeight = (FPc / BPc) * asset.probabilityWeight;
                                    }
        
                                    // calculate min and max probability based on the updated probability weights.
                                    const minProbability = currentMinProbability;
                                    const maxProbability = currentMinProbability + updatedProbabilityWeight - 1;
                                    currentMinProbability = maxProbability + 1;
        
                                    // update asset's properties in the same array
                                    asset.minProbability = minProbability;
                                    asset.maxProbability = maxProbability;
                                    asset.probabilityWeight = updatedProbabilityWeight;
                                });
        
                                console.log(`(rollWonderspin) Updated assets data with new probability weights from fortune surge: ${JSON.stringify(filteredAssetsData)}`);
                            } 
                            // if `rollsUntilFortuneSurge` is NOT null AND is NOT 0, then we can just roll the assets normally.
                            // this is because the probability of obtaining an A tier asset is not increased yet, so the probabilities for all assets are the same as it was.
        
                            // get the last asset's max probability, and this is used as the max range for the random number.
                            const maxRange = filteredAssetsData[filteredAssetsData.length - 1].maxProbability;
        
                            // roll a random number between 0 and the max range.
                            const randomNumber = Math.floor(Math.random() * (maxRange + 1));
        
                            console.log(`(rollWonderspin) Random number for roll ${obtainedAssets.length}: ${randomNumber}`);
        
                            // find the asset that corresponds to the random number.
                            const obtainedAsset = filteredAssetsData.find(asset => randomNumber >= asset.minProbability && randomNumber <= asset.maxProbability);
        
                            console.log(`(rollWonderspin) Roll ${obtainedAssets.length} asset obtained: ${JSON.stringify(obtainedAsset)}`);
        
                            obtainedAssets.push({
                                assetType: obtainedAsset.assetType,
                                assetTier: obtainedAsset.assetTier,
                                isFeatured: wonderspinData.assetData.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false,
                                asset: obtainedAsset.asset,
                                // to get the normal probability, we need the base filtered data, not the updated one with updated probabilities.
                                // max range will also need to be manually calculated, because `maxRange` is based on the updated probabilities.
                                normalProbability: wonderspinData.assetData.find(asset => asset.asset === obtainedAsset.asset)?.probabilityWeight / wonderspinData.assetData.reduce((acc, asset) => acc + asset.probabilityWeight, 0) * 100,
                                surgedProbability: obtainedAsset.probabilityWeight / maxRange * 100,
                                amount: obtainedAsset.amount
                            });
        
                            // check if the asset obtained is a featured asset.
                            obtainedAssetIsFeatured = wonderspinData.assetData.find(asset => asset.asset === obtainedAsset.asset)?.featured ?? false;
                            // check if the asset obtained is an A tier asset.
                            // featured assets are technically A tier, but for the sake of the roll counter updates, it won't count as an A tier asset.
                            obtainedAssetIsATier = obtainedAsset.assetTier === WonderspinAssetTier.A && !obtainedAssetIsFeatured;
                            // check if the asset obtained is a B tier asset.
                            obtainedAssetIsBTier = obtainedAsset.assetTier === WonderspinAssetTier.B;
                        }
        
                        // if `obtainedAssetIsFeatured` is true:
                        // 1. `rollsUntilFortunePeak` will be reset to `fortunePeakThreshold`.
                        // 2. `rollsUntilFortuneBlessing` will be reset to `fortuneBlessingThreshold`.
                        // 3. `rollsUntilFortuneSurge` will be reset to `fortuneSurgeThreshold`.
                        // 4. `currentFortuneSurgeRoll` will be reset to 1.
                        if (obtainedAssetIsFeatured) {
                            rollsUntilFortunePeak = wonderspinData.fortunePeakThreshold;
                            rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                            rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                            currentFortuneSurgeRoll = 1;
                        }
        
                        // if `obtainedAssetIsATier` is true:
                        // 1. `rollsUntilFortunePeak` will be decremented by 1 if not null, because the user didn't get a featured asset.
                        // 2. `rollsUntilFortuneBlessing` will be reset to `fortuneBlessingThreshold`.
                        // 3. `rollsUntilFortuneSurge` will be reset to `fortuneSurgeThreshold`.
                        // 4. `currentFortuneSurgeRoll` will be reset to 1.
                        if (obtainedAssetIsATier) {
                            if (rollsUntilFortunePeak !== null) {
                                rollsUntilFortunePeak--;
                            }
        
                            rollsUntilFortuneBlessing = wonderspinData.fortuneBlessingThreshold;
                            rollsUntilFortuneSurge = wonderspinData.fortuneSurgeThreshold;
                            currentFortuneSurgeRoll = 1;
                        }
        
                        // if `obtainedAssetIsBTier` is true:
                        // 1. `rollsUntilFortunePeak` will be decremented by 1 if not null, because the user didn't get a featured asset.
                        // 2. `rollsUntilFortuneBlessing` will be decremented by 1 if not null, because the user didn't get an A tier asset.
                        // 3. `rollsUntilFortuneSurge` will be decremented if not 1 (we put <=1 just in case). if 1, then the `currentFortuneSurgeRoll` will increase by 1.
                        // 4. `rollsUntilFortuneCrest` will be reset to `fortuneCrestThreshold`.
                        if (obtainedAssetIsBTier) {
                            if (rollsUntilFortunePeak !== null) {
                                rollsUntilFortunePeak--;
                            }
        
                            if (rollsUntilFortuneBlessing !== null) {
                                rollsUntilFortuneBlessing--;
                            }
        
                            if (rollsUntilFortuneSurge !== null) {
                                if (rollsUntilFortuneSurge <= 1) {
                                    currentFortuneSurgeRoll++;
                                } else {
                                    rollsUntilFortuneSurge--;
                                }
                            }
        
                            rollsUntilFortuneCrest = wonderspinData.fortuneCrestThreshold;
                        }
        
                        // if `obtainedAssetIsFeatured`, `obtainedAssetIsATier`, and `obtainedAssetIsBTier` are false, then the user has obtained a C tier asset, meaning:
                        // 1. `rollsUntilFortunePeak` will be decremented by 1 if not null, because the user didn't get a featured asset.
                        // 2. `rollsUntilFortuneBlessing` will be decremented by 1 if not null, because the user didn't get an A tier asset.
                        // 3. `rollsUntilFortuneSurge` will be decremented if not 1 (we put <=1 just in case). if 1, then the `currentFortuneSurgeRoll` will increase by 1.
                        // 4. `rollsUntilFortuneCrest` will be decremented by 1 if not null, because the user didn't get a B tier asset.
                        if (!obtainedAssetIsFeatured && !obtainedAssetIsATier && !obtainedAssetIsBTier) {
        
                            if (rollsUntilFortunePeak !== null) {
                                rollsUntilFortunePeak--;
                            }
        
                            if (rollsUntilFortuneBlessing !== null) {
                                rollsUntilFortuneBlessing--;
                            }
        
                            if (rollsUntilFortuneSurge !== null) {
                                if (rollsUntilFortuneSurge <= 1) {
                                    currentFortuneSurgeRoll++;
                                } else {
                                    rollsUntilFortuneSurge--;
                                }
                            }
        
                            if (rollsUntilFortuneCrest !== null) {
                                rollsUntilFortuneCrest--;
                            }
                        }
        
                        // increase the `totalRolls` counter by 1.
                        totalRolls++;
                        // continue to the next iteration.
                        continue;
                    }
                }
        
                // initialize $each on the user's inventory items, foods and/or resources.
                if (!userUpdateOperations.$push['inventory.items']) {
                    userUpdateOperations.$push['inventory.items'] = { $each: [] }
                }
        
                if (!userUpdateOperations.$push['inventory.foods']) {
                    userUpdateOperations.$push['inventory.foods'] = { $each: [] }
                }
        
                if (!userUpdateOperations.$push['inventory.resources']) {
                    userUpdateOperations.$push['inventory.resources'] = { $each: [] }
                }
        
                console.log(`(rollWonderspin) Obtained assets after all rolls: ${JSON.stringify(obtainedAssets, null, 2)}`);
        
                // check if `obtainedAssets` contains duplicates. we will just combine the amounts of the duplicates.
                const combinedObtainedAssets: Array<{
                    assetType: "item" | "resource" | "food" | "igc";
                    asset: AssetType | "xCookies" | "diamonds";
                    amount: number;
                }>  = obtainedAssets.reduce((acc, curr) => {
                    const existingAsset = acc.find(asset => asset.asset === curr.asset);
        
                    if (existingAsset) {
                        existingAsset.amount += curr.amount;
                    } else {
                        acc.push({
                            assetType: curr.assetType,
                            asset: curr.asset,
                            amount: curr.amount
                        });
                    }
        
                    return acc;
                }, []);
        
                // loop through each obtained asset and push them to the user's inventory.
                for (const obtainedAsset of combinedObtainedAssets) {
                    // get the asset type
                    const assetType = obtainedAsset.assetType;
        
                    // if asset is item
                    if (assetType === 'item') {
                        // check if the user owns this asset in their inventory
                        const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === obtainedAsset.asset);
        
                        // if not found, add the item to the user's inventory (along with the amount). if found, increment the amount.
                        if (itemIndex === -1) {
                            userUpdateOperations.$push['inventory.items'].$each.push({
                                type: obtainedAsset.asset,
                                amount: obtainedAsset.amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = obtainedAsset.amount;
                        }
                    } else if (assetType === 'food') {
                        // check if the user owns the food in their inventory
                        const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === obtainedAsset.asset);
        
                        // if not found, add the food to the user's inventory (along with the amount). if found, increment the amount.
                        if (foodIndex === -1) {
                            userUpdateOperations.$push['inventory.foods'].$each.push({
                                type: obtainedAsset.asset,
                                amount: obtainedAsset.amount
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = obtainedAsset.amount;
                        }
                    } else if (assetType === 'resource') {
                        // get the resource data.
                        const resourceData = resources.find(resource => resource.type === obtainedAsset.asset);
        
                        if (!resourceData) {
                            return {
                                status: Status.ERROR,
                                message: `(rollWonderspin) Resource data not found for ${obtainedAsset.asset}.`
                            }
                        }
        
                        // check if the user owns the resource in their inventory
                        const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === obtainedAsset.asset);
        
                        // if not found, add the resource to the user's inventory (along with the amount). if found, increment the amount.
                        if (resourceIndex === -1) {
                            userUpdateOperations.$push['inventory.resources'].$each.push({
                                ...resourceData,
                                amount: obtainedAsset.amount,
                                origin: ExtendedResourceOrigin.NORMAL
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = obtainedAsset.amount;
                        }
                    } else if (assetType === 'igc') {
                        // check if asset is xCookies or diamonds
                        if (obtainedAsset.asset === 'xCookies') {
                            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = obtainedAsset.amount;
                        } else if (obtainedAsset.asset === 'diamonds') {
                            userUpdateOperations.$inc['inventory.diamonds'] = obtainedAsset.amount;
                        }
                    }
                }
        
                // if the user wonderspin data doesn't exist, create a new one.
                if (!userWonderspinData) {
                    console.log(`(rollWonderspin) User wonderspin data doesn't exist. Creating a new one...`);
                    const newWonderspinData = new UserWonderspinDataModel({
                        _id: generateObjectId(),
                        userId: user._id,
                        wonderspinId: wonderspinData._id,
                        totalRolls,
                        rollsUntilFortuneCrest,
                        rollsUntilFortuneSurge,
                        currentFortuneSurgeRoll,
                        rollsUntilFortuneBlessing,
                        rollsUntilFortunePeak
                    });
        
                    await newWonderspinData.save();
                } else {
                    // update the user's wonderspin data.
                    await UserWonderspinDataModel.updateOne({ _id: userWonderspinData._id }, {
                        $set: {
                            totalRolls,
                            rollsUntilFortuneCrest,
                            rollsUntilFortuneSurge,
                            currentFortuneSurgeRoll,
                            rollsUntilFortuneBlessing,
                            rollsUntilFortunePeak
                        }
                    });
                }
        
                // update the user's inventory with the obtained assets.
                await UserModel.updateOne({ twitterId }, {
                    $set: userUpdateOperations.$set,
                    $inc: userUpdateOperations.$inc,
                });
        
                await UserModel.updateOne({ twitterId }, {
                    $push: userUpdateOperations.$push,
                    $pull: userUpdateOperations.$pull
                });
        
                console.log(`(rollWonderspin) Rolls until fortune crest: ${rollsUntilFortuneCrest}`);
                console.log(`(rollWonderspin) Rolls until fortune surge: ${rollsUntilFortuneSurge}`);
                console.log(`(rollWonderspin) Current fortune surge roll: ${currentFortuneSurgeRoll}`);
                console.log(`(rollWonderspin) Rolls until fortune blessing: ${rollsUntilFortuneBlessing}`);
                console.log(`(rollWonderspin) Rolls until fortune peak: ${rollsUntilFortunePeak}`);
                console.log(`(rollWonderspin) Total rolls: ${totalRolls}`);

                await job.moveToCompleted('done', true);

                return {
                    status: Status.SUCCESS,
                    message: `(rollWonderspin) Successfully rolled the wonderspin and updated the user's inventory.`,
                    data: {
                        obtainedAssets
                    }
                }
            } else {
                return {
                    status: Status.ERROR,
                    message: `(rollWonderspin) Wonderspin roll not found or already processed.`
                }
            }
        });

        return result;
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(rollWonderspin) ${err.message}`
        }
    } finally {
        await redis.del(lockKey);
    }
}