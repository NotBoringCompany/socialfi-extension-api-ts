import { Asset } from '../../models/asset';
import { BitRarity } from '../../models/bit';
import { SynthesizingItemGroup } from '../../models/craft';
import { IslandType } from '../../models/island';
import { AugmentationItem, BitOrbType, ContinuumRelicItem, EnergyTotemItem, Item, PotionItem, SynthesizingItem, SynthesizingItemData, TerraCapsulatorType, TransmutationItem } from '../../models/item';
import { BarrenResource, FruitResource, LiquidResource, OreResource } from '../../models/resource';

/**
 * Represents the list of assets available in our game.
 */
export const assets: Asset[] = [
    {
        type: BarrenResource.SEAWEED,
        description: 'Underwater foliage with various uses, but watch out for its clingy tendencies!'
    },
    {
        type: OreResource.STONE,
        description: 'A solid and sturdy rock.'
    },
    {
        type: FruitResource.TOMATO,
        description: 'Little bursts of blue sweetness in every bite.'
    },
    {
        type: LiquidResource.WATER,
        description: 'An essential clear and refreshing liquid.'
    },
    {
        type: OreResource.COPPER,
        description: 'A soft and malleable metal.'
    },
    {
        type: FruitResource.APPLE,
        description: 'Crunchy, crispy and juicy.'
    },
    {
        type: LiquidResource.MAPLE_SYRUP,
        description: 'Golden and sweet, perfect for pancakes.'
    },
    {
        type: OreResource.IRON,
        description: 'A strong and durable metal.'
    },
    {
        type: FruitResource.STAR_FRUIT,
        description: 'A tropical fruit with a unique shape.'
    },
    {
        type: LiquidResource.HONEY,
        description: 'Thank the bees for crafting this sweet treat.'
    },
    {
        type: OreResource.SILVER,
        description: 'Shiny and precious.'
    },
    {
        type: FruitResource.MELON,
        description: 'Juicy and refreshing for sunny days.'
    },
    {
        type: LiquidResource.MOONLIGHT_DEW,
        description: 'Sparkly drops from the night sky.'
    },
    {
        type: OreResource.GOLD,
        description: 'A shiny metal for a shiny dream.'
    },
    {
        type: FruitResource.DRAGON_FRUIT,
        description: 'Vibrant, exotic and most importantly yummy.'
    },
    {
        type: LiquidResource.PHOENIX_TEAR,
        description: 'Heals like a warm hug from a mythical bird.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
        description: 'This mysterious capsule summons a mysterious island at your disposal.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_II,
        description: 'This mysterious capsule summons a mysterious island at your disposal. Higher chances of getting higher rarity islands.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
        description: 'This mysterious capsule summons a mysterious island at your disposal. Highest chances of getting higher rarity islands.'
    },
    {
        type: BitOrbType.BIT_ORB_I,
        description: 'A shiny orb that holds the power of your own companion.'
    },
    {
        type: BitOrbType.BIT_ORB_II,
        description: 'A shiny orb that holds the power of your own companion. Higher chances of getting higher rarity Bits.'
    },
    {
        type: BitOrbType.BIT_ORB_III,
        description: 'A shiny orb that holds the power of your own companion. Highest chances of getting higher rarity Bits.'
    }
]

/**
 * Gets the enum type of `item`. For example, if inputted `Parchment of Restoration`, it will return `Restoration Item`.
 */
export const GET_SYNTHESIZING_ITEM_TYPE = (item: string): SynthesizingItemGroup | undefined => {
    if (Object.values(AugmentationItem).includes(item as AugmentationItem)) {
        return SynthesizingItemGroup.AUGMENTATION_ITEM;
    }

    if (Object.values(TransmutationItem).includes(item as TransmutationItem)) {
        return SynthesizingItemGroup.TRANSMUTATION_ITEM;
    }

    if (Object.values(EnergyTotemItem).includes(item as EnergyTotemItem)) {
        return SynthesizingItemGroup.ENERGY_TOTEM_ITEM;
    }

    if (Object.values(ContinuumRelicItem).includes(item as ContinuumRelicItem)) {
        return SynthesizingItemGroup.CONTINUUM_RELIC_ITEM;
    }

    if (Object.values(PotionItem).includes(item as PotionItem)) {
        return SynthesizingItemGroup.POTION_ITEM;
    }

    return undefined;
}

/**
 * Returns the data for all synthesizing items, including their effects, limitations and so on.
 */
export const SYNTHESIZING_ITEM_DATA: SynthesizingItemData[] = [
    {
        name: AugmentationItem.PARCHMENT_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 1%.`,
        minimumRarity: null,
        maximumRarity: IslandType.EXOTIC_ISLES,
        limitations: {
            singleIslandUsage: {
                active: true,
                limit: 1
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: true,
                type: 'percentage',
                value: 1
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: AugmentationItem.SCROLL_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 3%.`,
        minimumRarity: null,
        maximumRarity: IslandType.EXOTIC_ISLES,
        limitations: {
            singleIslandUsage: {
                active: true,
                limit: 1
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: true,
                type: 'percentage',
                value: 3
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: AugmentationItem.TOME_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 7%.`,
        minimumRarity: null,
        maximumRarity: IslandType.EXOTIC_ISLES,
        limitations: {
            singleIslandUsage: {
                active: true,
                limit: 1
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: true,
                type: 'percentage',
                value: 7
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: AugmentationItem.ANCIENT_SCROLL_OF_AUGMENTATION,
        description: `Select an Isle (any rarity) and increase its resource cap by 10%.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: true,
                limit: 1
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: true,
                type: 'percentage',
                value: 10
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: AugmentationItem.ANCIENT_SCROLL_OF_AUGMENTATION,
        description: `Select an Isle (any rarity) and increase its resource cap by 20%.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: true,
                limit: 1
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: true,
                type: 'percentage',
                value: 20
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: TransmutationItem.WAND_OF_TRANSMUTATION,
        description: `Select an Isle (Verdant rarity or below) and transmute the Isle's current resource line into another line.`,
        minimumRarity: null,
        maximumRarity: IslandType.VERDANT_ISLES,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: true,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: TransmutationItem.STAFF_OF_TRANSMUTATION,
        description: `Select an Isle (Exotic rarity or below) and transmute the Isle's current resource line into another line.`,
        minimumRarity: null,
        maximumRarity: IslandType.EXOTIC_ISLES,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: true,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: TransmutationItem.ROYAL_SCEPTER_OF_TRANSMUTATION,
        description: `Select an Isle (any rarity) and transmute the Isle's current resource line into another line.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'island',
            effectDuration: 'oneTime',
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: true,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: EnergyTotemItem.SMALL_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +2.5% Isle farming rate & -12.5% energy consumption for all bits there.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: true,
                limit: 5
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: true
        },
        effectValues: {
            affectedAsset: 'island',
            // 1 day
            effectDuration: 86400, 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: true,
                value: 2.5
            },
            earningRateModifier: {
                active: true,
                value: 2.5
            },
            placedBitsEnergyDepletionRateModifier: {
                active: true,
                value: -12.5
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: EnergyTotemItem.BIG_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +5% Isle farming rate & -25% energy consumption for all bits there.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: true,
                limit: 5
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: true
        },
        effectValues: {
            affectedAsset: 'island',
            // 1 day
            effectDuration: 86400, 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: true,
                value: 5
            },
            earningRateModifier: {
                active: true,
                value: 5
            },
            placedBitsEnergyDepletionRateModifier: {
                active: true,
                value: -25
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: EnergyTotemItem.GRAND_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +7.5% Isle farming rate & -50% energy consumption for all bits there.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: true,
                limit: 5
            },
            singleBitUsage: {
                active: false,
                limit: null
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: true
        },
        effectValues: {
            affectedAsset: 'island',
            // 2 days
            effectDuration: 172800, 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: true,
                value: 7.5
            },
            earningRateModifier: {
                active: true,
                value: 7.5
            },
            placedBitsEnergyDepletionRateModifier: {
                active: true,
                value: -50
            },
            bitTransferrableBetweenSeasons: {
                active: false,
                value: null
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: ContinuumRelicItem.FADED_CONTINUUM_RELIC,
        description: `Select a Bit (rare rarity or below) and allow transfer to Season 1.`,
        minimumRarity: null,
        maximumRarity: BitRarity.RARE,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null,
            },
            singleBitUsage: {
                active: true,
                limit: 1
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'bit',
            effectDuration: 'oneTime', 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null,
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null,
            },
            bitTransferrableBetweenSeasons: {
                active: true,
                value: 1
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: ContinuumRelicItem.GLEAMING_CONTINUUM_RELIC,
        description: `Select a Bit (epic rarity or below) and allow transfer to Season 1.`,
        minimumRarity: null,
        maximumRarity: BitRarity.EPIC,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null,
            },
            singleBitUsage: {
                active: true,
                limit: 1
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'bit',
            effectDuration: 'oneTime', 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null,
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null,
            },
            bitTransferrableBetweenSeasons: {
                active: true,
                value: 1
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    {
        name: ContinuumRelicItem.MYTHIC_CONTINUUM_RELIC,
        description: `Select a Bit (any rarity) and allow transfer to Season 1.`,
        minimumRarity: null,
        maximumRarity: null,
        limitations: {
            singleIslandUsage: {
                active: false,
                limit: null
            },
            concurrentIslandsUsage: {
                active: false,
                limit: null,
            },
            singleBitUsage: {
                active: true,
                limit: 1
            },
            concurrentBitsUsage: {
                active: false,
                limit: null
            },
            notUsableWhenAnotherSameItemActive: false
        },
        effectValues: {
            affectedAsset: 'bit',
            effectDuration: 'oneTime', 
            resourceCapModifier: {
                active: false,
                type: null,
                value: null
            },
            resourceLineTransmutation: false,
            gatheringRateModifier: {
                active: false,
                value: null
            },
            earningRateModifier: {
                active: false,
                value: null,
            },
            placedBitsEnergyDepletionRateModifier: {
                active: false,
                value: null,
            },
            bitTransferrableBetweenSeasons: {
                active: true,
                value: 1
            },
            rerollBitTraits: {
                active: false,
                type: null,
                result: null,
                value: null
            }
        }
    },
    
]