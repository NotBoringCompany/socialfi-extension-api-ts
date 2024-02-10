import { FoodType } from '../../models/food';

/** gets the corresponding food from completing a quest based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100 */
export const RANDOMIZE_FOOD_FROM_QUEST = (): FoodType => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 46:
            return FoodType.APPLE; // 45% chance
        case rand < 76:
            return FoodType.CHOCOLATE; // 30% chance
        case rand < 91:
            return FoodType.JUICE; // 15% chance
        default:
            return FoodType.BURGER; // 10% chance
    }
}