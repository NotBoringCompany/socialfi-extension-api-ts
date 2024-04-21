import { IslandType } from '../../models/island';
import { TerraCapsulatorType } from '../../models/terraCapsulator';

// /**
//  * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
//  */
// export const randomizeTypeFromCapsulator = (): IslandType => {
//     const rand = Math.floor(Math.random() * 100) + 1;

//     switch (true) {
//         case rand < 76:
//             return IslandType.PRIMAL_ISLES; // 75% chance
//         case rand < 96:
//             return IslandType.VERDANT_ISLES; // 20% chance
//         default:
//             return IslandType.EXOTIC_ISLES; // 5% chance
//     }
// }

/**
 * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 * and the Terra Capsulator type.
 */
<<<<<<< HEAD
export const randomizeTypeFromCapsulator = (
  capsuleType: string = ""
): IslandType => {
  const rand = Math.floor(Math.random() * 100) + 1;

  switch (capsuleType) {
    case "Terra Capsule":
      return rand < 31
        ? IslandType.PRIMAL_ISLES
        : rand < 81
        ? IslandType.VERDANT_ISLES
        : rand < 96
        ? IslandType.EXOTIC_ISLES
        : IslandType.CRYSTAL_ISLES;
    case "Terra Capsule (II)":
      return rand < 31
        ? IslandType.PRIMAL_ISLES
        : rand < 81
        ? IslandType.VERDANT_ISLES
        : rand < 96
        ? IslandType.EXOTIC_ISLES
        : rand < 101
        ? IslandType.CRYSTAL_ISLES
        : IslandType.CRYSTAL_ISLES;
    default:
      return IslandType.PRIMAL_ISLES; // Default to Primal Isles when no or empty capsule type is provided
  }
};

=======
export const randomizeTypeFromCapsulator = (type: TerraCapsulatorType): IslandType => {
    const rand = Math.floor(Math.random() * 1000) + 1;

    if (type === TerraCapsulatorType.TERRA_CAPSULATOR_I) {
        if (rand <= 300) {
            return IslandType.PRIMAL_ISLES;
        } else if (rand <= 800) {
            return IslandType.VERDANT_ISLES;
        } else if (rand <= 950) {
            return IslandType.EXOTIC_ISLES;
        } else if (rand <= 996) {
            return IslandType.CRYSTAL_ISLES;
        } else {
            return IslandType.CELESTIAL_ISLES;
        }
    } else if (type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
        if (rand <= 300) {
            return IslandType.VERDANT_ISLES;
        } else if (rand <= 800) {
            return IslandType.EXOTIC_ISLES;
        } else if (rand <= 950) {
            return IslandType.CRYSTAL_ISLES;
        } else {
            return IslandType.CELESTIAL_ISLES;
        }
    } else {
        throw new Error('Invalid Terra Capsulator type');
    }
}
>>>>>>> 9fcd391b46ad3c8a7df871148f35b8eefb9de7ff
