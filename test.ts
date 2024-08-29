import { getDailyQuests, resetDailyQuest } from './api/quest';
import { POIName } from './models/poi';

const main = async () => {
    await resetDailyQuest('1271112690983813121', POIName.EVERGREEN_VILLAGE);
    const quests = await getDailyQuests('1271112690983813121', POIName.EVERGREEN_VILLAGE);

    console.log(quests);
};

main();
