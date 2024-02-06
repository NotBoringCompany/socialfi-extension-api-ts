import { BitRarity } from '../models/bit';

/** max level for any island type */
export const MAX_ISLAND_LEVEL = 20;

/** claim cooldown for claiming resources (in seconds) */
export const RESOURCES_CLAIM_COOLDOWN = 86400;

/** claim cooldown for claiming cookies (in seconds) */
export const COOKIE_CLAIM_COOLDOWN = 86400;

/** gets the max level for a bit given their rarity */
export const MAX_BIT_LEVEL = (rarity: BitRarity) => {
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