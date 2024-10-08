import { FoodType } from '../../models/food';
import { BitOrbType, TerraCapsulatorType } from '../../models/item';
import { BarrenResource, ResourceRarity, ResourceType } from '../../models/resource';
import { resources } from './resource';

/** the max amount of chest an user can open each day */
export const MAXIMUM_DAILY_CHEST_LIMIT = 2;

/** 
 * Returns an item from a chest to be given when the chest is opened.
 */
export const RANDOMIZE_CHEST_ITEM = (): {
    item: FoodType | ResourceType | 'xCookies' | TerraCapsulatorType.TERRA_CAPSULATOR_I | BitOrbType.BIT_ORB_I 
    amount: number
} => {
    const rand = Math.floor(Math.random() * 10000) + 1;

    switch (true) {
        // 95% chance for food (Season 0)
        case rand <= 9500:
            // Randomize the food with updated probabilities
            // 5% chance for candy
            // 10% chance for chocolate
            // 25% chance for juice
            // 60% chance for burger
            const foodRand = Math.floor(Math.random() * 100) + 1;

            switch (true) {
                case foodRand < 6:
                    return { item: FoodType.CANDY, amount: 1}
                case foodRand < 16:
                    return { item: FoodType.CHOCOLATE, amount: 1}
                case foodRand < 41:
                    return { item: FoodType.JUICE, amount: 1}
                default:
                    return { item: FoodType.BURGER, amount: 1}
            }
        // 0% chance for resource (Season 0)
        case rand <= 0:
            // randomize the resource with probabilities
            // 80% chance of a common resource of any type
            // 15% chance of an uncommon resource of any type
            // 5% chance of a rare resource of any type
            // 0% chance of epic or rare resource
            const resourceRand = Math.floor(Math.random() * 100) + 1;

            switch (true) {
                case resourceRand < 81:
                    // randomize a common resource from `resources` (there are 3)
                    const commonResources = resources.filter(resource => resource.rarity === ResourceRarity.COMMON);
                    const commonResource = commonResources[Math.floor(Math.random() * commonResources.length)];

                    return { item: commonResource.type, amount: 1 }
                case resourceRand < 96:
                    // randomize an uncommon resource from `resources` (there are 2)
                    const uncommonResources = resources.filter(resource => resource.rarity === ResourceRarity.UNCOMMON);
                    const uncommonResource = uncommonResources[Math.floor(Math.random() * uncommonResources.length)];

                    return { item: uncommonResource.type, amount: 1 }
                default:
                    // randomize a rare resource from `resources` (there are 2)
                    const rareResources = resources.filter(resource => resource.rarity === ResourceRarity.RARE);
                    const rareResource = rareResources[Math.floor(Math.random() * rareResources.length)];

                    return { item: rareResource.type, amount: 1 }
            }
        // 5% chance for xCookies (Season 0)
        case rand <= 10000:
            return { item: 'xCookies', amount: 1 }
        // 0% chance for Terra Capsulator (Season 0)
        case rand <= 0:
            return { item: TerraCapsulatorType.TERRA_CAPSULATOR_I, amount: 1 }
        // 0% chance for Bit Orb (Season 0)
        default:
            return { item: BitOrbType.BIT_ORB_I, amount: 1 }
    }
}