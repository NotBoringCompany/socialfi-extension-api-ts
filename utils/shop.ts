import { BitOrbType } from '../models/bitOrb';
import { BoosterItem } from '../models/booster';
import { FoodType } from '../models/food';
import { Shop } from '../models/shop';
import { TerraCapsulatorType } from '../models/terraCapsulator';

/**
 * Since we don't require the shop to be dynamic for now (i.e. not requiring the database), we can just hardcode the shop.
 */
export const shop: Shop = {
    items: [
        {
            type: BitOrbType.BIT_ORB_I,
            price: {
                xCookies: 30
            }
        },
        {
            type: BitOrbType.BIT_ORB_II,
            price: {
                xCookies: 150
            }
        },
        {
            type: BitOrbType.BIT_ORB_III,
            price: {
                xCookies: 1000
            }
        },
        {
            type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
            price: {
                xCookies: 20
            }
        },
        {
            type: TerraCapsulatorType.TERRA_CAPSULATOR_II,
            price: {
                xCookies: 200
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_10,
            price: {
                xCookies: 0.1
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
            price: {
                xCookies: 0.2
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
            price: {
                xCookies: 0.5
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_100,
            price: {
                xCookies: 1
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_200,
            price: {
                xCookies: 2
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_300,
            price: {
                xCookies: 3
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_500,
            price: {
                xCookies: 5
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_1000,
            price: {
                xCookies: 10
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_2000,
            price: {
                xCookies: 20
            }
        },
        {
            type: BoosterItem.GATHERING_PROGRESS_BOOSTER_3000,
            price: {
                xCookies: 30
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_1_MIN,
            price: {
                xCookies: 1
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_2_MIN,
            price: {
                xCookies: 2
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_3_MIN,
            price: {
                xCookies: 3
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_5_MIN,
            price: {
                xCookies: 5
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_10_MIN,
            price: {
                xCookies: 10
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_15_MIN,
            price: {
                xCookies: 15
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_30_MIN,
            price: {
                xCookies: 35
            }
        },
        {
            type: BoosterItem.RAFT_SPEED_BOOSTER_60_MIN,
            price: {
                xCookies: 60
            }
        }
    ],
    foods: [
        {
            type: FoodType.CANDY,
            price: {
                xCookies: 0.1
            }
        },
        {
            type: FoodType.CHOCOLATE,
            price: {
                xCookies: 0.2
            }
        },
        {
            type: FoodType.JUICE,
            price: {
                xCookies: 0.35
            }
        },
        {
            type: FoodType.BURGER,
            price: {
                xCookies: 0.6
            }
        }
    ]
}