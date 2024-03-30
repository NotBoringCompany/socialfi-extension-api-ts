import { FoodType } from '../../models/food';

/** gets the amount of energy replenished from a food */
export const FOOD_ENERGY_REPLENISHMENT = (food: FoodType) => {
    switch (food) {
        case FoodType.CANDY:
            return 10;
        case FoodType.CHOCOLATE:
            return 25;
        case FoodType.JUICE:
            return 50;
        case FoodType.BURGER:
            return 100;
    }
}