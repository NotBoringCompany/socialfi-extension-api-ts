import { Bit, BitGender, BitRarity, BitStatsModifiers, BitTrait, BitTraitCategory, BitTraitData, BitTraitRarity, BitTraitSubCategory, EnergyThresholdReduction } from '../../models/bit';
import { Island, IslandStatsModifiers } from '../../models/island';
import { BitTraitModifier, Modifier } from '../../models/modifier';

/** gets the max level for a bit given their rarity */
export const MAX_BIT_LEVEL = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 20;
        case BitRarity.UNCOMMON:
            return 30;
        case BitRarity.RARE:
            return 40;
        case BitRarity.EPIC:
            return 50;
        case BitRarity.LEGENDARY:
            return 65;
    }
}

/** relocation cooldown for bits after relocating from a raft or island (1 day) */
export const RELOCATION_COOLDOWN = 86400;

/** gets the cost (in xCookies) of evolving a bit, based on its current level */
export const BIT_EVOLUTION_COST = (currentLevel: number): number => {
    // level once upgraded = 2 to 9
    if (currentLevel >= 1 && currentLevel <= 8) {
        return 30;
    // level once upgraded = 10 to 19
    } else if (currentLevel >= 9 && currentLevel <= 18) {
        return 60; // 2x of prev level range
    // level once upgraded = 20 to 29
    } else if (currentLevel >= 19 && currentLevel <= 28) {
        return 120; // 2x of prev level range
    // level once upgraded = 30 to 39
    } else if (currentLevel >= 29 && currentLevel <= 38) {
        return 360; // 3x of prev level range
    // level once upgraded = 40 to 49
    } else if (currentLevel >= 39 && currentLevel <= 48) {
        return 1080; // 3x of prev level range
    // level once upgraded = 50 to 59
    } else if (currentLevel >= 49 && currentLevel <= 58) {
        return 3240; // 3x of prev level range
    // level once upgraded = 60 to 65
    } else if (currentLevel >= 59 && currentLevel <= 64) {
        return 12960; // 4x of prev level range
    }
}

/**
 * Calculates the cost (in seaweed) to evolve a free bit.
 * 
 * Unlike premium bits, free bits evolve with seaweed.
 */
export const FREE_BIT_EVOLUTION_COST = (currentLevel: number): number => {
    // level 1 starts with 10 seaweed, and every level after is 1.125x the previous level
    return 10 * (1.125 ** (currentLevel - 1));
}

/**
 * Randomizes 2-5 traits (based on rarity) for a Bit.
 */
export const randomizeBitTraits = (rarity: BitRarity): BitTraitData[] => {
    // check how many traits the bit can have based on its rarity
    const maxTraits = 
        rarity === BitRarity.LEGENDARY ? 5 : 
        rarity === BitRarity.EPIC ? 4 : 
        rarity === BitRarity.RARE ? 3 : 
        2;
    
    const traits: BitTraitData[] = [];

    while (traits.length < maxTraits) {
        // following rules will apply:
        // 1. 80% common, 15% uncommon, 5% rare chance
        // 2. for each trait category, there can only be traits of 1 subcategory.
        // e.g. category 'Workrate A' has productive, enthusiastic, lazy, uninspired. productive and enthusiastic are positive, lazy and uninspired are negative (subcategory wise).
        // that means that if a bit already has the trait 'productive', it can only have 'enthusiastic' as the next trait if the rand number falls within this category
        // not lazy or uninspired.
        // 3. no duplicate traits
        const rand = Math.floor(Math.random() * 100) + 1;

        // randomize the traits from the `bitTraits` array
        // if rand is <= 80, get a common trait
        // if rand is <= 95, get an uncommon trait
        // if rand is <= 100, get a rare trait
        let randomTrait: BitTraitData;

        if (rand <= 80) {
            // filter through common traits
            const commonTraits = bitTraits.filter(trait => trait.rarity === BitTraitRarity.COMMON);

            // get a random trait from common traits
            const commonRand = Math.floor(Math.random() * commonTraits.length);
            randomTrait = commonTraits[commonRand];
        } else if (rand <= 95) {
            // filter through uncommon traits
            const uncommonTraits = bitTraits.filter(trait => trait.rarity === BitTraitRarity.UNCOMMON);

            // get a random trait from uncommon traits
            const uncommonRand = Math.floor(Math.random() * uncommonTraits.length);
            randomTrait = uncommonTraits[uncommonRand];
        } else {
            // filter through rare traits
            const rareTraits = bitTraits.filter(trait => trait.rarity === BitTraitRarity.RARE);

            // get a random trait from rare traits
            const rareRand = Math.floor(Math.random() * rareTraits.length);
            randomTrait = rareTraits[rareRand];
        }

        // check if the trait already exists in the traits array
        if (!traits.includes(randomTrait)) {
            // at this point, the trait is unique.
            // however, we need to check if an existing trait of the opposite subcategory within this category exists.
            // if it doesn't, add the trait.

            const traitCategory = randomTrait.category;
            const traitSubCategory = randomTrait.subcategory;

            // check if the trait's category is already in the traits array
            const categoryExists = traits.some(trait => {
                return trait.category === traitCategory;
            });

            // if the category exists, check which subcategory the existing trait(s) belong to
            // if the subcategory is the same as the randomTrait's subcategory, add the trait
            if (categoryExists) {
                const existingSubCategory = traits.find(trait => trait.category === traitCategory)?.subcategory;

                // if the existing subcategory is the same as the randomTrait's subcategory, add the trait
                if (existingSubCategory === traitSubCategory) {
                    traits.push(randomTrait);
                }
            } else {
                // if the category doesn't exist, add the trait
                traits.push(randomTrait);
            }
        }
    }

    return traits;
}

/**
 * A list of all bit traits and their respective stats/details.
 */
export const bitTraits: BitTraitData[] = [
    {
        trait: BitTrait.PRODUCTIVE,
        effect: `+5% working rate to self`,
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_A,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.ENTHUSIASTIC,
        effect: '+10% working rate to self',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_A,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.FIT,
        effect: '-5% energy depletion rate to self',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.ENERGY,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.LUCKY,
        effect: '+2.5% bonus resource chance when resource is dropped',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.BONUS_RESOURCE,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.LAZY,
        effect: '-5% working rate to self',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_A,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.UNINSPIRED,
        effect: '-10% working rate to self',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_A,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.OBESE,
        effect: '+5% energy depletion rate to self',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.ENERGY,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.UNLUCKY,
        effect: '-2.5% bonus resource chance when resource is dropped',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.BONUS_RESOURCE,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.STRONG,
        effect: '-15% energy depletion rate to self',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.ENERGY,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.TRICKSTER,
        effect: '+5% bonus resource chance when resource is dropped',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.BONUS_RESOURCE,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.TEAMWORKER,
        effect: '+5% working rate to all bits with same or lesser rarity in the same island',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.WORKRATE_B,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.WEAK,
        effect: '+15% energy depletion rate to self',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.ENERGY,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.HAPLESS,
        effect: '-5% bonus resource chance when resource is dropped',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.BONUS_RESOURCE,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.LEADER,
        effect: '+10% working rate to all bits in the same island',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_B,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.CUTE,
        effect: '+12.5% working rate to all other bits in the same island',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_B,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.GENIUS,
        effect: '+7.5% island working rate',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_C,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.LONEWOLF,
        effect: '+50% working rate to self, -5% working rate to all bits in the same island',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_B,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.INFLUENTIAL,
        effect: '+1% working rate to all islands owned',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_D,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.ANTAGONISTIC,
        effect: '-1% working rate to all islands owned',
        rarity: BitTraitRarity.RARE,
        category: BitTraitCategory.WORKRATE_D,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.QUICK,
        effect: '+1% island working rate',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_C,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.SLOW,
        effect: '-1% island working rate',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.WORKRATE_C,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.FAMOUS,
        effect: '+0.5% working rate to all islands owned',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.WORKRATE_D,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.MANNERLESS,
        effect: '-0.5% working rate to all islands owned',
        rarity: BitTraitRarity.UNCOMMON,
        category: BitTraitCategory.WORKRATE_D,
        subcategory: BitTraitSubCategory.NEGATIVE
    },
    {
        trait: BitTrait.FRUGAL,
        effect: '+10% more energy when consuming food',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.FOOD_CONSUMPTION,
        subcategory: BitTraitSubCategory.POSITIVE
    },
    {
        trait: BitTrait.HUNGRY,
        effect: '-10% less energy when consuming food',
        rarity: BitTraitRarity.COMMON,
        category: BitTraitCategory.FOOD_CONSUMPTION,
        subcategory: BitTraitSubCategory.NEGATIVE
    }
]

/**
 * Gets the modifier effect of a Bit's trait ONLY on itself.
 * 
 * NOTE: for traits that impact the modifiers of other bits, they will be available in the relevant functions (such as `placeBit`).
 */
export const BIT_TRAIT_EFFECT_ON_SELF = (trait: BitTrait): BitTraitModifier => {
    switch (trait) {
        case BitTrait.PRODUCTIVE:
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Productive',
                    value: 1.05
                },
                bitEarningRate: {
                    origin: 'Bit Trait: Productive',
                    value: 1.05
                }
            }
        case BitTrait.ENTHUSIASTIC:
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Enthusiastic',
                    value: 1.1
                },
                bitEarningRate: {
                    origin: 'Bit Trait: Enthusiastic',
                    value: 1.1
                }
            }
        case BitTrait.FIT:
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Fit',
                    value: 0.95
                }
            }
        // lucky trait only impacts bonus resource chance when claiming resources
        case BitTrait.LUCKY:
            return {}
        case BitTrait.LAZY:
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Lazy',
                    value: 0.95
                },
                bitEarningRate: {
                    origin: 'Bit Trait: Lazy',
                    value: 0.95
                }
            }
        case BitTrait.UNINSPIRED:
            return {
                bitEarningRate: {
                    origin: 'Bit Trait: Uninspired',
                    value: 0.9
                },
                bitGatheringRate: {
                    origin: 'Bit Trait: Uninspired',
                    value: 0.9
                }
            }
        case BitTrait.OBESE:
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Obese',
                    value: 1.05
                }
            }
        // unlucky only impacts bonus resource chance when claiming resources
        case BitTrait.UNLUCKY:
            return {}
        case BitTrait.STRONG:
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Strong',
                    value: 0.85
                }
            }
        // trickster only impacts bonus resource chance when claiming resources
        case BitTrait.TRICKSTER:
            return {}
        case BitTrait.TEAMWORKER:
            return {
                bitEarningRate: {
                    origin: 'Bit Trait: Teamworker',
                    value: 1.05
                },
                bitGatheringRate: {
                    origin: 'Bit Trait: Teamworker',
                    value: 1.05
                }
            }
        case BitTrait.WEAK:
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Weak',
                    value: 1.15
                }
            }
        // hapless only impacts bonus resource chance when claiming resources
        case BitTrait.HAPLESS:
            return {}
        case BitTrait.LEADER:
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Leader',
                    value: 1.1
                },
                bitEarningRate: {
                    origin: 'Bit Trait: Leader',
                    value: 1.1
                }
            }
        // cute trait only impacts other bits within the same isle
        case BitTrait.CUTE:
            return {}
        case BitTrait.GENIUS:
            return {
                islandEarningRate: {
                    origin: 'Bit Trait: Genius',
                    value: 1.075
                },
                islandGatheringRate: {
                    origin: 'Bit Trait: Genius',
                    value: 1.075
                }
            }
        // increases own working rate by 50% but reduces working rate of other bits in the same island by 5%
        case BitTrait.LONEWOLF:
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Lonewolf',
                    value: 1.5
                },
                bitEarningRate: {
                    origin: 'Bit Trait: Lonewolf',
                    value: 1.5
                }
            }
        // influential only increases the working rate of all islands owned
        case BitTrait.INFLUENTIAL:
            return {}
        // antagonistic only reduces the working rate of all islands owned
        case BitTrait.ANTAGONISTIC:
            return {}
        // quick, slow, famous, mannerless, frugal, hungry
        // slow only reduces isle working rate
        case BitTrait.SLOW:
            return {}
        // quick only increases isle working rate
        case BitTrait.QUICK:
            return {}
        // famous only increases the working rate of all islands owned
        case BitTrait.FAMOUS:
            return {}
        // mannerless only reduces the working rate of all islands owned
        case BitTrait.MANNERLESS:
            return {}
        case BitTrait.FRUGAL:
            return {
                foodConsumptionEfficiency: {
                    origin: 'Bit Trait: Frugal',
                    value: 1.1
                }
            }
        case BitTrait.HUNGRY:
            return {
                foodConsumptionEfficiency: {
                    origin: 'Bit Trait: Hungry',
                    value: 0.9
                }
            }
    }
}

/**
 * Return a `bitStatsModifiers` instance for a Bit based on all effects of the Bit's traits.
 * 
 * NOTE: This only involves traits that impact a bit's own modifiers. Traits that impact an island's stats will be added when placing the bit on the island.
 */
export const getBitStatsModifiersFromTraits = (traits: BitTrait[]): BitStatsModifiers => {
    const traitEffects: BitTraitModifier[] = traits.map(trait => { 
        return BIT_TRAIT_EFFECT_ON_SELF(trait);
    });

    const bitStatsModifiers: BitStatsModifiers = {
        gatheringRateModifiers: [],
        earningRateModifiers: [],
        energyRateModifiers: [],
        foodConsumptionEfficiencyModifiers: []
    }

    for (const traitEffect of traitEffects) {
        if (traitEffect.bitGatheringRate) {
            bitStatsModifiers.gatheringRateModifiers.push(traitEffect.bitGatheringRate);
        }
        if (traitEffect.bitEarningRate) {
            bitStatsModifiers.earningRateModifiers.push(traitEffect.bitEarningRate);
        }
        if (traitEffect.energyDepletionRate) {
            bitStatsModifiers.energyRateModifiers.push(traitEffect.energyDepletionRate);
        }
        if (traitEffect.foodConsumptionEfficiency) {
            bitStatsModifiers.foodConsumptionEfficiencyModifiers.push(traitEffect.foodConsumptionEfficiency);
        }
    }

    return bitStatsModifiers;
}

/**
 * Randomizes a Bit's gender. 
 */
export const RANDOMIZE_GENDER = (): BitGender => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 51:
            return BitGender.MALE; // 50% chance
        default:
            return BitGender.FEMALE; // 50% chance
    }
}

/**
 * Gets the default gathering rate (excl. +-10%; in % of total resources/hour) for a Bit based on its rarity.
 */
export const DEFAULT_GATHERING_RATE = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.02;
        case BitRarity.UNCOMMON:
            return 0.025;
        case BitRarity.RARE:
            return 0.031;
        case BitRarity.EPIC:
            return 0.039;
        case BitRarity.LEGENDARY:
            return 0.05;
        default:
            throw new Error(`(BASE_GATHERING_RATE) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the default gathering rate growth (excl. +-10%; fixed increase in % of total resources/hour for every level increase) for a Bit based on its rarity.
 */
export const DEFAULT_GATHERING_RATE_GROWTH = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.0002;
        case BitRarity.UNCOMMON:
            return 0.00025;
        case BitRarity.RARE:
            return 0.00033;
        case BitRarity.EPIC:
            return 0.00045;
        case BitRarity.LEGENDARY:
            return 0.0006;
        default:
            throw new Error(`(BASE_GATHERING_RATE_GROWTH) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the default earning rate (excl. +-10%; in % of total xCookies spent/hour) for a Bit based on its rarity.
 */
export const DEFAULT_EARNING_RATE = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.03;
        case BitRarity.UNCOMMON:
            return 0.036;
        case BitRarity.RARE:
            return 0.044;
        case BitRarity.EPIC:
            return 0.055;
        case BitRarity.LEGENDARY:
            return 0.07;
        default:
            throw new Error(`(BASE_EARNING_RATE) Invalid rarity: ${rarity}`);
    }
}

/**
 * Gets the default earning rate growth (excl. +-10%; fixed increase in % of total xCookies spent/hour for every level increase) for a Bit based on its rarity.
 */
export const DEFAULT_EARNING_RATE_GROWTH = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 0.00025;
        case BitRarity.UNCOMMON:
            return 0.00032;
        case BitRarity.RARE:
            return 0.0004;
        case BitRarity.EPIC:
            return 0.0005;
        case BitRarity.LEGENDARY:
            return 0.00065;
        default:
            throw new Error(`(EARNING_RATE_GROWTH) Invalid rarity: ${rarity}`);
    }
}

/** base energy depletion rate of bits in % of energy bar/hour (regardless of rarity). actual depletion rate will include +-25% */
export const BASE_ENERGY_DEPLETION_RATE: number = 5;

/** returns the reductions in earning and gathering rate (by a fixed %) if the bit's energy goes below a certain threshold */
export const ENERGY_THRESHOLD_REDUCTIONS = (energy: number): EnergyThresholdReduction => {
    switch (true) {
        case energy <= 0:
            return {
                gatheringRateReduction: 100,
                earningRateReduction: 100
            }
        case energy < 25:
            return {
                gatheringRateReduction: 50,
                earningRateReduction: 50
            }
        case energy < 50:
            return {
                gatheringRateReduction: 20,
                earningRateReduction: 20,
            }
        default: {
            return {
                gatheringRateReduction: 0,
                earningRateReduction: 0
            }
        }
    }
}