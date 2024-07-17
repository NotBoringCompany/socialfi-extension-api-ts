import { POIModel, WonderbitsPOIModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';

/**
 * Transfers POI data from the test database to the wonderbits database.
 */
export const transferPOIData = async (): Promise<void> => {
    try {
        const poi = await POIModel.find().lean();

        if (poi.length === 0) {
            console.log('(transferPOIData) No POI data found.');
            return;
        }

        // copy paste each POI data, but/except the following:
        // 1. `currentBuyableAmount` for each shop global item will be set to `buyableAmount`
        // 2. `currentSellableAmount` for each shop global item will be set to `sellableAmount`
        // 3. `userTransactionData` for each shop player item will be set to an empty array
        for (const poiData of poi) {
            const globalItems = poiData.shop.globalItems.map(globalItem => {
                return {
                    name: globalItem.name,
                    buyableAmount: globalItem.buyableAmount,
                    sellableAmount: globalItem.sellableAmount,
                    currentBuyableAmount: globalItem.buyableAmount,
                    currentSellableAmount: globalItem.sellableAmount,
                    buyingPrice: globalItem.buyingPrice,
                    sellingPrice: globalItem.sellingPrice
                }
            });

            const playerItems = poiData.shop.playerItems.map(playerItem => {
                return {
                    name: playerItem.name,
                    buyableAmount: playerItem.buyableAmount,
                    sellableAmount: playerItem.sellableAmount,
                    buyingPrice: playerItem.buyingPrice,
                    sellingPrice: playerItem.sellingPrice,
                    userTransactionData: [],
                }
            });


            const newPOI = new WonderbitsPOIModel({
                _id: generateObjectId(),
                name: poiData.name,
                distanceTo: poiData.distanceTo,
                shop: {
                    globalItems,
                    playerItems
                }
            });

            await newPOI.save();
        }
    } catch (err: any) {
        console.error(`(transferPOIData) Error: ${err.message}`);
    }
}