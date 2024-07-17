import { CollabModel, LeaderboardModel, POIModel, QuestModel, SettingModel, StarterCodeModel, TutorialModel, WonderbitsCollabModel, WonderbitsLeaderboardModel, WonderbitsPOIModel, WonderbitsQuestModel, WonderbitsSettingModel, WonderbitsStarterCodeModel, WonderbitsTutorialModel } from '../utils/constants/db';
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
            const globalItems = poiData?.shop?.globalItems.map(globalItem => {
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

            const playerItems = poiData?.shop?.playerItems.map(playerItem => {
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

/**
 * Transfers tutorial data from the test database to the wonderbits database.
 */
export const transferTutorialData = async (): Promise<void> => {
    try {
        const tutorial = await TutorialModel.find().lean();

        if (tutorial.length === 0) {
            console.log('(transferTutorialData) No tutorial data found.');
            return;
        }

        for (const tutorialData of tutorial) {
            const newTutorial = new WonderbitsTutorialModel({
                _id: generateObjectId(),
                id: tutorialData.id,
                name: tutorialData.name,
                rewards: tutorialData.rewards,
            });

            await newTutorial.save();
        }
    } catch (err: any) {
        console.error(`(transferTutorialData) Error: ${err.message}`);
    }
}

/**
 * Transfers starter code data from the test database to the wonderbits database.
 */
export const transferStarterCodeData = async (): Promise<void> => {
    try {
        const starterCodeData = await StarterCodeModel.find().lean();

        if (starterCodeData.length === 0) {
            console.log('(transferStarterCodeData) No starter code data found.');
            return;
        }

        for (const starterCode of starterCodeData) {
            const newStarterCode = new WonderbitsStarterCodeModel({
                _id: generateObjectId(),
                code: starterCode.code,
                maxUses: starterCode.maxUses,
                usedBy: []
            });

            await newStarterCode.save();
        }
    } catch (err: any) {
        console.error(`(transferStarterCodeData) Error: ${err.message}`);   
    }
}

/**
 * Transfers quest data from the test database to the wonderbits database.
 */
export const transferQuestData = async (): Promise<void> => {
    try {
        const questData = await QuestModel.find().lean();

        if (questData.length === 0) {
            console.log('(transferQuestData) No quest data found.');
            return;
        }

        for (const quest of questData) {
            const newQuest = new WonderbitsQuestModel({
                _id: generateObjectId(),
                questId: quest.questId,
                name: quest.name,
                description: quest.description,
                type: quest.type,
                limit: quest.limit,
                category: quest.category,
                imageUrl: quest.imageUrl,
                bannerUrl: quest.bannerUrl,
                poi: quest.poi,
                start: quest.start,
                end: quest.end,
                rewards: quest.rewards,
                completedBy: [],
                requirements: quest.requirements
            });

            await newQuest.save();
        }
    } catch (err: any) {
        console.error(`(transferQuestData) Error: ${err.message}`);
    }
}

/**
 * Transfers leaderboard data from the test database to the wonderbits database.
 */
export const transferLeaderboardData = async (): Promise<void> => {
    try {
        const leaderboardData = await LeaderboardModel.find().lean();

        if (leaderboardData.length === 0) {
            console.log('(transferLeaderboardData) No leaderboard data found.');
            return;
        }

        for (const leaderboard of leaderboardData) {
            const newLeaderboard = new WonderbitsLeaderboardModel({
                _id: generateObjectId(),
                name: leaderboard.name,
                startTimestamp: leaderboard.startTimestamp,
                userData: [],
            });

            await newLeaderboard.save();
        }
    } catch (err: any) {
        console.error(`(transferLeaderboardData) Error: ${err.message}`);
    }
}

/**
 * Transfer settings data from the test database to the wonderbits database.
 */
export const transferSettingData = async (): Promise<void> => {
    try {
        const settings = await SettingModel.find().lean();

        if (settings.length === 0) {
            console.log('(transferSettingData) No setting data found.');
            return;
        }

        for (const setting of settings) {
            const newSetting = new WonderbitsSettingModel({
                _id: generateObjectId(),
                key: setting.key,
                name: setting.name,
                description: setting.description,
                value: setting.value
            });

            await newSetting.save();
        }
    } catch (err: any) {
        console.error(`(transferSettingData) Error: ${err.message}`);
    }
}

/**
 * Transfers all collab data from the test database to the wonderbits database.
 */
export const transferCollabData = async (): Promise<void> => {
    try {
        const collabData = await CollabModel.find().lean();

        if (collabData.length === 0) {
            console.log('(transferCollabData) No collab data found.');
            return;
        }

        for (const collab of collabData) {
            const newCollab = new WonderbitsCollabModel({
                _id: generateObjectId(),
                tier: collab.tier,
                type: collab.type,
                leaderRewards: collab.leaderRewards,
                memberRewards: collab.memberRewards,
                participants: null,
                groups: collab.groups ? collab.groups.map(group => {
                    return {
                        _id: group._id,
                        name: group.name,
                        code: group.code,
                        participants: []
                    }
                }) : null,
            });

            await newCollab.save();
        }
    } catch (err: any) {
        console.error(`(transferCollabData) Error: ${err.message}`);
    }
}