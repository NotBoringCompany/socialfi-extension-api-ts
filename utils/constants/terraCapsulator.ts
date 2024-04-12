import { IslandType } from "../../models/island";

/**
 * Gets the Island's type based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100
 */
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

// export const randomizeTypeFromCapsulator = (): IslandType => {
//   const rand = Math.floor(Math.random() * 100) + 1;

//   switch (true) {
//     case rand < 76:
//       return IslandType.PRIMAL_ISLES; // 75% chance
//     case rand < 96:
//       return IslandType.VERDANT_ISLES; // 20% chance
//     default:
//       return IslandType.EXOTIC_ISLES; // 5% chance
//   }
// };
