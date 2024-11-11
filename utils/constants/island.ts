import { BitRarity } from '../../models/bit';
import {
  IslandTappingData,
  IslandTrait,
  IslandType,
  RarityDeviationReduction,
  ResourceDropChance,
  ResourceDropChanceDiff,
  TappingMilestoneBonusReward,
  TappingMilestoneReward,
} from '../../models/island';
import { TerraCapsulatorType } from '../../models/item';

/** max level for any island type */
export const MAX_ISLAND_LEVEL = 20;

/** claim cooldown for claiming resources (in seconds) */
export const RESOURCES_CLAIM_COOLDOWN = 10;

/** claim cooldown for claiming xCookies [FROM THE ISLAND] (in seconds) */
export const X_COOKIE_CLAIM_COOLDOWN = 10;

/** reduction modifier for effective gathering rate for having multiple bits on an island */
export const GATHERING_RATE_REDUCTION_MODIFIER = 0.1;

/** exponential decay for gathering rate calculation (both bit and island) */
export const GATHERING_RATE_EXPONENTIAL_DECAY = 0.015;

/** the amount of bits that can be placed in an island */
export const BIT_PLACEMENT_CAP = 5;

/** the chance to drop a common resource for barren isles (in %) */
export const BARREN_ISLE_COMMON_DROP_CHANCE = 2;

/**
 * user's first received island during the tutorial
 */
export const DEFAULT_ISLAND_TYPE = IslandType['PRIMAL_ISLES'];

/**
 * the amount of islands the user can have at a time to farm resources.
 *
 * however, the user is of course still allowed to have more islands in their inventory.
 */
export const TOTAL_ACTIVE_ISLANDS_ALLOWED = 30;

/** base energy needed per one tapping */
export const BASE_ENERGY_PER_TAPPING = 5;

/** base caress energy meter gained per one tapping */
export const BASE_CARESS_PER_TAPPING = 5;

/** base caress enery meter */
export const BASE_CARESS_METER = 125;

/** caress exp base diff */
export const EXP_BASE_DIFF = 1.1;

/** caress exp multiplier */
export const EXP_MULTIPLIER = 0.006;

/** base additional exp multiplier for tapping */
export const BASE_ADDITIONAL_EXP_MULTIPLIER = 1.05;

export const BASE_BERRY_TO_POINT_MULTIPLIER = 5;

/**
 * gets the amount of bonus resources that can be gathered daily based on the island type.
 */
export const DAILY_BONUS_RESOURCES_GATHERABLE = (type: IslandType) => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 2;
    case IslandType.VERDANT_ISLES:
      return 3;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 4;
    case IslandType.CRYSTAL_ISLES:
      return 5;
    case IslandType.CELESTIAL_ISLES:
      return 6;
  }
};

/**
 * Randomizes 5 traits from the available island traits.
 */
export const randomizeIslandTraits = (): IslandTrait[] => {
  const traits = Object.values(IslandTrait);

  const randomTraits: IslandTrait[] = [];

  for (let i = 0; i < 5; i++) {
    const rand = Math.floor(Math.random() * traits.length);
    randomTraits.push(traits[rand]);
  }

  return randomTraits;
};

/**
 * Gets the default resource cap for an Island based on its type.
 */
export const DEFAULT_RESOURCE_CAP = (type: IslandType) => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 500;
    case IslandType.VERDANT_ISLES:
      return 1250;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 2500;
    case IslandType.CRYSTAL_ISLES:
      return 2500;
    case IslandType.CELESTIAL_ISLES:
      return 2500;
  }
};
/**
 * Gets the base resource drop chances for an Island based on its type.
 */
export const RESOURCE_DROP_CHANCES = (type: IslandType): ResourceDropChance => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return {
        common: 77.5,
        uncommon: 18.5,
        rare: 4,
        epic: 0,
        legendary: 0,
      };
    case IslandType.VERDANT_ISLES:
      return {
        common: 62.5,
        uncommon: 28.7,
        rare: 8.6,
        epic: 0.2,
        legendary: 0,
      };
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return {
        common: 50,
        uncommon: 33.745,
        rare: 15,
        epic: 1.25,
        legendary: 0.005,
      };
    case IslandType.CRYSTAL_ISLES:
      return {
        common: 35.5,
        uncommon: 34,
        rare: 25,
        epic: 5,
        legendary: 0.5,
      };
    case IslandType.CELESTIAL_ISLES:
      return {
        common: 15,
        uncommon: 20,
        rare: 40,
        epic: 20,
        legendary: 5,
      };
  }
};

/**
 * Gets the percentage modifier (diff) for the resource drop chances of an island every time it levels up.
 */
export const RESOURCE_DROP_CHANCES_LEVEL_DIFF = (
  type: IslandType
): ResourceDropChanceDiff => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return {
        common: -0.13,
        uncommon: 0.12,
        rare: 0.01,
        epic: 0,
        legendary: 0,
      };
    case IslandType.VERDANT_ISLES:
      return {
        common: -0.21001,
        uncommon: 0.155,
        rare: 0.05,
        epic: 0.005,
        legendary: 0,
      };
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return {
        common: -0.44825,
        uncommon: 0.175,
        rare: 0.25,
        epic: 0.0225,
        legendary: 0.00075,
      };
    case IslandType.CRYSTAL_ISLES:
      return {
        common: -0.429,
        uncommon: 0.02,
        rare: 0.3,
        epic: 0.1,
        legendary: 0.009,
      };
    case IslandType.CELESTIAL_ISLES:
      return {
        common: -0.55,
        uncommon: -0.175,
        rare: 0.3,
        epic: 0.25,
        legendary: 0.175,
      };
  }
};

/**
 * Returrns the minimum rarity the bit needs to be to be placed on an island based on its type.
 */
export const BIT_PLACEMENT_MIN_RARITY_REQUIREMENT = (
  type: IslandType
): BitRarity => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return BitRarity.COMMON;
    case IslandType.VERDANT_ISLES:
      return BitRarity.COMMON;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return BitRarity.COMMON;
    case IslandType.CRYSTAL_ISLES:
      return BitRarity.UNCOMMON;
    case IslandType.CELESTIAL_ISLES:
      return BitRarity.RARE;
  }
};

/**
 * Shows the different negative modifiers when the bit's rarity deviates from the island's type (in rarity format).
 *
 * For instance, if a common Bit is placed on Verdant Isles (in rarity format: uncommon), there will be a negative modifier for gathering rate and resource cap.
 */
export const RARITY_DEVIATION_REDUCTIONS = (
  type: IslandType,
  rarity: BitRarity
): RarityDeviationReduction => {
  switch (type) {
    // for primal isles, all bits from common to legendary will NOT receive any reductions
    case IslandType.PRIMAL_ISLES:
      return {
        gatheringRateReduction: 0,
      };
    // for verdant isles, only common bits will get reductions.
    case IslandType.VERDANT_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          return {
            gatheringRateReduction: 2,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for exotic isles, only common and uncommon bits will get reductions.
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          return {
            gatheringRateReduction: 5,
          };
        case BitRarity.UNCOMMON:
          return {
            gatheringRateReduction: 3,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for crystal isles, commons cannot be placed, so technically only uncommons and rares will get reductions.
    case IslandType.CRYSTAL_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Crystal Isles.`
          );
        case BitRarity.UNCOMMON:
          return {
            gatheringRateReduction: 5.75,
          };
        case BitRarity.RARE:
          return {
            gatheringRateReduction: 4,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
    // for celestial isles, commons and uncommons cannot be placed, so technically only rares and epics will get reductions.
    case IslandType.CELESTIAL_ISLES:
      switch (rarity) {
        case BitRarity.COMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Common bits are not allowed to be placed on Celestial Isles.`
          );
        case BitRarity.UNCOMMON:
          throw new Error(
            `(RARITY_DEVIATION_REDUCTIONS) Uncommon bits are not allowed to be placed on Celestial Isles.`
          );
        case BitRarity.RARE:
          return {
            gatheringRateReduction: 7.5,
          };
        case BitRarity.EPIC:
          return {
            gatheringRateReduction: 5.25,
          };
        case BitRarity.LEGENDARY:
          return {
            gatheringRateReduction: 0,
          };
        default:
          return {
            gatheringRateReduction: 0,
          };
      }
  }
};

/**
 * Increases the gathering rate by a multiplier of an island based on its type (for calculation balancing).
 */
export const ISLAND_RARITY_DEVIATION_MODIFIERS = (type: IslandType): number => {
  switch (type) {
    case IslandType.PRIMAL_ISLES:
      return 5;
    case IslandType.VERDANT_ISLES:
      return 2;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 1;
    case IslandType.CRYSTAL_ISLES:
      return 1;
    case IslandType.CELESTIAL_ISLES:
      return 1;
  }
};

/**
 * Calculates the caress energy meter required for a given milestone tier
 * and returns the associated IslandTappingData.
 */
export const ISLAND_TAPPING_REQUIREMENT = (milestoneTier: number, tappingLevel: number): IslandTappingData => {
  // calculate current milestone caress required based on milestonTier parameter.
  let caressEnergyRequired: number;

  if (milestoneTier === 1) {
    caressEnergyRequired = BASE_CARESS_METER;
  } else {
    caressEnergyRequired = Math.ceil(BASE_CARESS_METER * EXP_BASE_DIFF ** (milestoneTier * (1 + EXP_MULTIPLIER) - 1));
  }

  // return IslandTappingData after calculating caressEnergyMeter required for this milestoneTier
  return {
    currentMilestone: milestoneTier,
    milestoneReward: ISLAND_TAPPING_MILESTONE_REWARD(milestoneTier, tappingLevel),
    caressEnergyMeter: caressEnergyRequired,
    currentCaressEnergyMeter: 0,
  }
};

/**
 * Return island tapping milestone reward based on given milestone tier
 */
export const ISLAND_TAPPING_MILESTONE_REWARD = (milestoneTier: number, tappingLevel: number): TappingMilestoneReward => {
  let reward: TappingMilestoneReward = {
    boosterReward: 0,
    masteryExpReward: 0,
    bonusReward: ISLAND_TAPPING_MILESTONE_BONUS_REWARD(milestoneTier, tappingLevel),
  };
  reward.boosterReward = 10 * milestoneTier;

  if (milestoneTier >= 1 && milestoneTier <= 5) {
    reward.masteryExpReward = 5;
  } else if (milestoneTier >= 6 && milestoneTier <= 10) {
    reward.masteryExpReward = 10;
  } else if (milestoneTier >= 11 && milestoneTier <= 15) {
    reward.masteryExpReward = 15;
  } else if (milestoneTier >= 16 && milestoneTier <= 20) {
    reward.masteryExpReward = 20;
  } else {
    reward.masteryExpReward = 25;
  }

  return reward;
}

export const ISLAND_TAPPING_MILESTONE_BONUS_REWARD = (milestoneTier: number, tappingLevel: number): TappingMilestoneBonusReward => {
  const bonus: TappingMilestoneBonusReward = {
    firstOptionReward: 10 * milestoneTier,
    secondOptionReward: {},
  };

  // Option 2 randomize reward
  const rand = Math.floor(Math.random() * 10000) + 1;
  if (rand <= 3333) {
    // Additional Exp from firstOptionRewards * (1 + (0.05 *tappingLevel))
    bonus.secondOptionReward.additionalExp = bonus.firstOptionReward * (BASE_ADDITIONAL_EXP_MULTIPLIER + (0.05 * (tappingLevel - 1)));
  } else if (rand <= 6666) {
    // Berry Bonus
    const berryBonus = milestoneTier >= 21 ? 3 : 
                       milestoneTier >= 16 ? 2 :
                       milestoneTier >= 11 ? 1.5 : 1;
    bonus.secondOptionReward.berryDrop = berryBonus;
  } else {
    // Calculate Point Bonus based on milestone tier and tapping level
    const pointBonus = milestoneTier >= 21 ? 3 : 
                       milestoneTier >= 16 ? 2 :
                       milestoneTier >= 11 ? 1.5 : 1;
    bonus.secondOptionReward.pointDrop = pointBonus * (BASE_BERRY_TO_POINT_MULTIPLIER + (tappingLevel - 1));
  }

  return bonus;
};

/**
 * Determines the milestone limit for a given island type.
 */
export const ISLAND_TAPPING_MILESTONE_LIMIT = (type: IslandType): number => {
  switch(type){
    case IslandType.PRIMAL_ISLES:
      return 5;
    case IslandType.VERDANT_ISLES:
      return 10;
    case IslandType.EXOTIC_ISLES:
    case IslandType.XTERIO_ISLES:
      return 15;
    case IslandType.CRYSTAL_ISLES:
      return 20;
    case IslandType.CELESTIAL_ISLES:
      return 25;
  }
};