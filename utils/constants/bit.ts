import { Bit, BitGender, BitRarity, BitStatsModifiers, BitTrait, EnergyThresholdReduction } from '../../models/bit';
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
export const RELOCATION_COOLDOWN = 86400000;

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
 * Randomizes 2-5 traits (based on rarity) for a Bit.
 */
export const randomizeBitTraits = (rarity: BitRarity): BitTrait[] => {
    const commonTraits = [
        BitTrait.PRODUCTIVE,
        BitTrait.ENTHUSIASTIC,
        BitTrait.FIT,
        BitTrait.LAZY,
        BitTrait.UNINSPIRED,
        BitTrait.OBESE
    ];

    const uncommonTraits = [
        BitTrait.STRONG,
        BitTrait.NIBBLER,
        BitTrait.TEAMWORKER,
        BitTrait.WEAK,
    ];

    const rareTraits = [
        BitTrait.LEADER,
        BitTrait.CUTE,
        BitTrait.GENIUS
    ];

    const traits: BitTrait[] = [];

    // if rarity is common or uncommon, 2 traits.
    // if rarity is rare, 3 traits.
    // if rarity is epic, 4 traits.
    // if rarity is legendary, 5 traits.
    const maxTraits = 
        rarity === BitRarity.LEGENDARY ? 5 : 
        rarity === BitRarity.EPIC ? 4 : 
        rarity === BitRarity.RARE ? 3 : 
        2;

    for (let i = 0; i < maxTraits; i++) {
        const rand = Math.floor(Math.random() * 100) + 1;

        // randomize a trait based on the traits available for the rarity
        switch (true) {
            case rand <= 50:
                traits.push(commonTraits[Math.floor(Math.random() * commonTraits.length)]);
                break;
            case rand <= 85:
                traits.push(uncommonTraits[Math.floor(Math.random() * uncommonTraits.length)]);
                break;
            default:
                traits.push(rareTraits[Math.floor(Math.random() * rareTraits.length)]);
                break;
        }
    }

    return traits;
}

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
        case BitTrait.STRONG:
            return {
                energyDepletionRate: {
                    origin: 'Bit Trait: Strong',
                    value: 0.85
                }
            }
        case BitTrait.NIBBLER:
            return {
                islandGatheringRate: {
                    origin: 'Bit Trait: Nibbler',
                    value: 1.02
                },
                islandEarningRate: {
                    origin: 'Bit Trait: Nibbler',
                    value: 1.02
                }
            }
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
        energyRateModifiers: []
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