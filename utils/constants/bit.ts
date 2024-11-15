import { Bit, BitGender, BitRarity, BitStatsModifiers, BitTrait, BitTraitCategory, BitTraitData, BitTraitEnum, BitTraitRarity, BitTraitSubCategory, BitType, EnergyThresholdReduction } from '../../models/bit';
import { Island, IslandStatsModifiers } from '../../models/island';
import { BitTraitModifier, Modifier } from '../../models/modifier';
import { generateObjectId } from '../crypto';
import { BitTraitDataModel } from './db';

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
            const commonTraits = BIT_TRAITS.filter(trait => trait.rarity === BitTraitRarity.COMMON);

            // get a random trait from common traits
            const commonRand = Math.floor(Math.random() * commonTraits.length);
            randomTrait = commonTraits[commonRand];
        } else if (rand <= 95) {
            // filter through uncommon traits
            const uncommonTraits = BIT_TRAITS.filter(trait => trait.rarity === BitTraitRarity.UNCOMMON);

            // get a random trait from uncommon traits
            const uncommonRand = Math.floor(Math.random() * uncommonTraits.length);
            randomTrait = uncommonTraits[uncommonRand];
        } else {
            // filter through rare traits
            const rareTraits = BIT_TRAITS.filter(trait => trait.rarity === BitTraitRarity.RARE);

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
 * Randomizes a type when summoning a Bit.
 */
export const randomizeBitType = (): BitType => {
    // randomize all bit types APART from BitType.XTERIO.
    const types = Object.values(BitType).filter(type => type !== BitType.XTERIO);
    const rand = Math.floor(Math.random() * types.length);

    return types[rand];
}

/**
 * Populates `BIT_TRAITS` and the `BitTrait` enum on runtime.
 */
export const populateBitTraitsData = async (): Promise<void> => {
    try {
        const bitTraits = await BitTraitDataModel.find().lean();

        if (!bitTraits) {
            return;
        }

        BIT_TRAITS = bitTraits;

        // populate the BitTrait enum with the trait's name
        bitTraits.forEach(trait => {
            // trait is in caps lock
            BitTraitEnum[trait.trait.toUpperCase()] = trait.trait;
        });

        console.log(`(populateBitTraitsData) Successfully populated the BitTrait enum and Bit traits.`);
    } catch (err: any) {
        console.error(`(populateBitTraitsData) ${err.message}`);
    }
}

/**
 * A list of all bit traits and their respective stats/details.
 * 
 * This will be populated on runtime.
 */
export let BIT_TRAITS: BitTraitData[] = [];

/**
 * Gets the modifier effect of a Bit's trait ONLY on itself.
 * 
 * NOTE: for traits that impact the modifiers of other bits, they will be available in the relevant functions (such as `placeBit`).
 */
export const BIT_TRAIT_EFFECT_ON_SELF = (trait: BitTrait): BitTraitModifier => {
    switch (trait) {
        case 'Productive':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Productive',
                    value: 1.05
                },
            }
        case 'Enthusiastic':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Enthusiastic',
                    value: 1.1
                },
            }
        case 'Fit':
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Fit',
                    value: 0.95
                }
            }
        // lucky trait only impacts bonus resource chance when claiming resources
        case 'Lucky':
            return {}
        case 'Lazy':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Lazy',
                    value: 0.95
                },
            }
        case 'Uninspired':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Uninspired',
                    value: 0.9
                }
            }
        case 'Obese':
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Obese',
                    value: 1.05
                }
            }
        // unlucky only impacts bonus resource chance when claiming resources
        case 'Unlucky':
            return {}
        case 'Strong':
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Strong',
                    value: 0.85
                }
            }
        // trickster only impacts bonus resource chance when claiming resources
        case 'Trickster':
            return {}
        case 'Teamworker':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Teamworker',
                    value: 1.05
                }
            }
        case 'Weak':
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Weak',
                    value: 1.15
                }
            }
        // hapless only impacts bonus resource chance when claiming resources
        case 'Hapless':
            return {}
        case 'Leader':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Leader',
                    value: 1.1
                },
            }
        // cute trait only impacts other bits within the same isle
        case 'Cute':
            return {}
        case 'Genius':
            return {
                islandGatheringRate: {
                    origin: 'Bit Trait: Genius',
                    value: 1.075
                }
            }
        // increases own working rate by 50% but reduces working rate of other bits in the same island by 5%
        case 'Lonewolf':
            return {
                bitGatheringRate: {
                    origin: 'Bit Trait: Lonewolf',
                    value: 1.5
                },
            }
        // influential only increases the working rate of all islands owned
        case 'Influential':
            return {}
        // antagonistic only reduces the working rate of all islands owned
        case 'Antagonistic':
            return {}
        // quick, slow, famous, mannerless, frugal, hungry
        // slow only reduces isle working rate
        case 'Slow':
            return {}
        // quick only increases isle working rate
        case 'Quick':
            return {}
        // famous only increases the working rate of all islands owned
        case 'Famous':
            return {}
        // mannerless only reduces the working rate of all islands owned
        case 'Mannerless':
            return {}
        case 'Frugal':
            return {
                foodConsumptionEfficiency: {
                    origin: 'Bit Trait: Frugal',
                    value: 1.1
                }
            }
        case 'Hungry':
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
        energyRateModifiers: [],
        foodConsumptionEfficiencyModifiers: []
    }

    for (const traitEffect of traitEffects) {
        if (traitEffect.bitGatheringRate) {
            bitStatsModifiers.gatheringRateModifiers.push(traitEffect.bitGatheringRate);
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
            return 0.04;
        case BitRarity.UNCOMMON:
            return 0.055;
        case BitRarity.RARE:
            return 0.075;
        case BitRarity.EPIC:
            return 0.1142;
        case BitRarity.LEGENDARY:
            return 0.2723;
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
            return 0.0006;
        case BitRarity.UNCOMMON:
            return 0.0075;
        case BitRarity.RARE:
            return 0.0099;
        case BitRarity.EPIC:
            return 0.0135;
        case BitRarity.LEGENDARY:
            return 0.018;
        default:
            throw new Error(`(BASE_GATHERING_RATE_GROWTH) Invalid rarity: ${rarity}`);
    }
}

/** base energy depletion rate of bits in % of energy bar/hour (regardless of rarity) */
export const DEFAULT_ENERGY_DEPLETION_RATE = (rarity: BitRarity): number => {
    switch (rarity) {
        case BitRarity.COMMON:
            return 5;
        case BitRarity.UNCOMMON:
            return 6;
        case BitRarity.RARE:
            return 7;
        case BitRarity.EPIC:
            return 8;
        case BitRarity.LEGENDARY:
            return 10;
        default:
            throw new Error(`(ENERGY_DEPLETION_RATE) Invalid rarity: ${rarity}`);
    }
};

/** returns the reductions in gathering rate (by a fixed %) if the bit's energy goes below a certain threshold */
export const ENERGY_THRESHOLD_REDUCTIONS = (energy: number): EnergyThresholdReduction => {
    switch (true) {
        case energy <= 0:
            return {
                gatheringRateReduction: 100,
            }
        case energy < 25:
            return {
                gatheringRateReduction: 50,
            }
        case energy < 50:
            return {
                gatheringRateReduction: 20,
            }
        default: {
            return {
                gatheringRateReduction: 0,
            }
        }
    }
}