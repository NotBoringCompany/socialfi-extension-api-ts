import { BitRarity } from '../../models/bit';


export const RANDOMIZE_RARITY_FROM_ORB = (itemName: string = ""): BitRarity => {
  const rand = Math.floor(Math.random() * 100) + 1;

  switch (itemName) {
    case "Bit Orb":
      return rand < 76
        ? BitRarity.COMMON
        : rand < 96
        ? BitRarity.UNCOMMON
        : BitRarity.RARE;
    case "Bit Orb (II)":
      return rand < 46
        ? BitRarity.COMMON
        : rand < 86
        ? BitRarity.UNCOMMON
        : rand < 98.5
        ? BitRarity.RARE
        : BitRarity.EPIC;
    case "Bit Orb (III)":
      return rand < 1
        ? BitRarity.COMMON
        : rand < 36
        ? BitRarity.UNCOMMON
        : rand < 86
        ? BitRarity.RARE
        : rand < 98.5
        ? BitRarity.EPIC
        : BitRarity.LEGENDARY;
    default:
      return BitRarity.COMMON; // Default to common if the item name is not recognized
  }
};

/**
 * Gets the Bit's rarity based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
// export const RANDOMIZE_RARITY_FROM_ORB = (): BitRarity => {
//     const rand = Math.floor(Math.random() * 100) + 1;

//     switch (true) {
//         case rand < 76:
//             return BitRarity.COMMON; // 75% chance
//         case rand < 96:
//             return BitRarity.UNCOMMON; // 20% chance
//         default:
//             return BitRarity.RARE; // 5% chance
//     }
// }