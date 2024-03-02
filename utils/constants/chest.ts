import { ChestItem } from '../../models/chest';

// /** 
//  * Returns an item from a chest based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
//  */
// export const RANDOMIZE_CHEST_ITEM = (): {item: ChestItem, amount: number} => {
//     const rand = Math.floor(Math.random() * 10000) + 1;

//     switch (true) {
//         // 85% chance for food
//         case rand < 8501:
//             // randomize the food with probabilities
//             // 65% chance for apple
//             // 25% chance for chocolate
//             // 9% chance for juice
//             // 1% chance for burger
//             const foodRand = Math.floor(Math.random() * 100) + 1;

//             switch (true) {
//                 case foodRand < 66:
//                     return { item: ChestItem.APPLE, amount: 1}
//                 case foodRand < 91:
//                     return { item: ChestItem.CHOCOLATE, amount: 1}
//                 case foodRand < 100:
//                     return { item: ChestItem.JUICE, amount: 1}
//                 default:
//                     return { item: ChestItem.BURGER, amount: 1}
//             }
//         // 14% chance for resource
//         case rand < 9985:
//             // randomize the resource with probabilities
//             // 45% chance of seaweed
//             // 35% chance of stone
//             // 15% chance of keratin
//             // 5% chance of silver
//             // 0% chance of diamond and relic
//             const resourceRand = Math.floor(Math.random() * 100) + 1;

//             switch (true) {
//                 case resourceRand < 46:
//                     return ChestItem.SEAWEED;
//                 case resourceRand < 81:
//                     return ChestItem.STONE;
//                 case resourceRand < 96:
//                     return ChestItem.KERATIN;
//                 default:
//                     return ChestItem.SILVER;
//             }
//         // 0.98% chance for xCookies
//         case rand < 9999:
//             item = ChestItem.X_COOKIES;
//         // 0.01% chance for Terra Capsulator
//         case rand < 10000:
//             item = ChestItem.TERRA_CAPSULATOR;
//         // 0.01% chance for Bit Orb
//         default:
//             item = ChestItem.BIT_ORB;
//     }

//     // if item 
// }

// export const 