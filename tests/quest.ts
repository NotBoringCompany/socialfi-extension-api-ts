import { getDailyQuests } from '../api/quest';
import { POIName } from '../models/poi';
import { QuestDailyModel, UserModel } from '../utils/constants/db';

// the daily quests between the POI should be unique
export const dailyQuestUnique = async () => {
    console.time('dailyQuestUnique');
    console.log('(dailyQuestUnique) Starting...');

    const twitterId = '1271112690983813121';

    const user = await UserModel.findOne({ twitterId });
    if (!user) {
        console.log('(dailyQuestUnique) Failed. User not found');
        return console.timeEnd('dailyQuestUnique');
    }

    await QuestDailyModel.deleteMany({
        user: user._id,
    });

    const quests = [
        ...(await getDailyQuests(twitterId, POIName.EVERGREEN_VILLAGE)).data.quests,
        ...(await getDailyQuests(twitterId, POIName.PALMSHADE_VILLAGE)).data.quests,
        ...(await getDailyQuests(twitterId, POIName.SEABREEZE_HARBOR)).data.quests,
        ...(await getDailyQuests(twitterId, POIName.STARFALL_SANCTUARY)).data.quests,
    ];

    const uniqueIds = [...new Set(quests.map((quest) => quest.quest))];

    if (quests.length !== uniqueIds.length) {
        console.log(`(dailyQuestUnique) Failed. Duplicate detected`);
        return console.timeEnd('dailyQuestUnique');
    }

    console.log('(dailyQuestUnique) successful');
    console.timeEnd('dailyQuestUnique');
};

dailyQuestUnique();
