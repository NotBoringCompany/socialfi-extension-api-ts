import { BitRarity } from '../../models/bit';
import { BitOrbType } from '../../models/bitOrb';


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
<<<<<<< HEAD
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
=======
export const RANDOMIZE_RARITY_FROM_ORB = (type: BitOrbType): BitRarity => {
    const rand = Math.floor(Math.random() * 1000) + 1;

    if (type === BitOrbType.BIT_ORB_I) {
        if (rand <= 750) {
            return BitRarity.COMMON;
        } else if (rand <= 950) {
            return BitRarity.UNCOMMON;
        } else {
            return BitRarity.RARE;
        }
    } else if (type === BitOrbType.BIT_ORB_II) {
        if (rand <= 450) {
            return BitRarity.COMMON;
        } else if (rand <= 850) {
            return BitRarity.UNCOMMON;
        } else if (rand <= 985) {
            return BitRarity.RARE;
        } else {
            return BitRarity.EPIC;
        }
    } else if (type === BitOrbType.BIT_ORB_III) {
        if (rand <= 350) {
            return BitRarity.UNCOMMON;
        } else if (rand <= 850) {
            return BitRarity.RARE;
        } else if (rand <= 985) {
            return BitRarity.EPIC;
        } else {
            return BitRarity.LEGENDARY;
        }
    }
}
>>>>>>> 9fcd391b46ad3c8a7df871148f35b8eefb9de7ff
