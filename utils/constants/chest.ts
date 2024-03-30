import { FoodType } from '../../models/food';
import { BarrenResource, ResourceRarity, ResourceType } from '../../models/resource';
import { resources } from './resource';

/** 
 * Returns an item from a chest to be given when the chest is opened.
 */
export const RANDOMIZE_CHEST_ITEM = (): {
    item: FoodType | ResourceType | 'xCookies' | 'Terra Capsulator' | 'Bit Orb', 
    amount: number
} => {
    const rand = Math.floor(Math.random() * 10000) + 1;

    switch (true) {
        // 85% chance for food
        case rand < 8501:
            // randomize the food with probabilities
            // 65% chance for apple
            // 25% chance for chocolate
            // 9% chance for juice
            // 1% chance for burger
            const foodRand = Math.floor(Math.random() * 100) + 1;

            switch (true) {
                case foodRand < 66:
                    return { item: FoodType.CANDY, amount: 1}
                case foodRand < 91:
                    return { item: FoodType.CHOCOLATE, amount: 1}
                case foodRand < 100:
                    return { item: FoodType.JUICE, amount: 1}
                default:
                    return { item: FoodType.BURGER, amount: 1}
            }
        // 14% chance for resource
        case rand < 9985:
            // randomize the resource with probabilities
            // 45% chance of seaweed
            // 35% chance of a common resource of any type
            // 15% chance of an uncommon resource of any type
            // 5% chance of a rare resource of any type
            // 0% chance of epic or rare resource
            const resourceRand = Math.floor(Math.random() * 100) + 1;

            switch (true) {
                case resourceRand < 46:
                    return { item: BarrenResource.SEAWEED, amount: 3 }
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
        // 0.98% chance for xCookies
        case rand < 9999:
            return { item: 'xCookies', amount: 10 }
        // 0.01% chance for Terra Capsulator
        case rand < 10000:
            return { item: 'Terra Capsulator', amount: 1 }
        // 0.01% chance for Bit Orb
        default:
            return { item: 'Bit Orb', amount: 1 }
    }
}