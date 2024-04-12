import { Item } from '../../models/item';
import { BarrenResource, FruitResource, LiquidResource, OreResource } from '../../models/resource';

/**
 * Represents the list of items available in our game.
 */
export const items: Item[] = [
    {
        type: BarrenResource.SEAWEED,
        description: 'Underwater foliage with various uses, but watch out for its clingy tendencies!'
    },
    {
        type: OreResource.STONE,
        description: 'A solid and sturdy rock.'
    },
    {
        type: FruitResource.BLUEBERRY,
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
        type: 'Terra Capsulator',
        description: 'This mysterious capsule summons a mysterious island at your disposal.'
    },
    {
        type: 'Bit Orb',
        description: 'A shiny orb that holds the power of your own companion.'
    }
]