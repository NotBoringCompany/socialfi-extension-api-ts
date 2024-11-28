import { getDailyQuests, resetDailyQuest } from './api/quest';
import { POIName } from './models/poi';
import { generateObjectId } from './utils/crypto';

const main = async () => {
    // await resetDailyQuest('1271112690983813121', POIName.EVERGREEN_VILLAGE);
    // const quests = await getDailyQuests('1271112690983813121', POIName.EVERGREEN_VILLAGE);

    for (let index = 0; index < 10; index++) {
        console.log(generateObjectId());
    }

    // console.log(quests);
};

main();
