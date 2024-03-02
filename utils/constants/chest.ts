import { FoodType } from '../../models/food';
import { ResourceType } from '../../models/resource';

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
                    return { item: FoodType.APPLE, amount: 1}
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
            // 35% chance of stone
            // 15% chance of keratin
            // 5% chance of silver
            // 0% chance of diamond and relic
            const resourceRand = Math.floor(Math.random() * 100) + 1;

            switch (true) {
                case resourceRand < 46:
                    return { item: ResourceType.SEAWEED, amount: 3 }
                case resourceRand < 81:
                    return { item: ResourceType.STONE, amount: 1 }
                case resourceRand < 96:
                    return { item: ResourceType.KERATIN, amount: 1 }
                default:
                    return { item: ResourceType.SILVER, amount: 1 }
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