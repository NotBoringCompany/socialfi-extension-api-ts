/**
 * Represents the full metadata of a Key Of Salvation.
 */
export interface KOSMetadata {
    /** the token id of the key */
    keyId: number;
    /** the key name */
    name: string;
    /** the key's image URL */
    image: string;
    /** the key's animation URL */
    animationUrl: string;
    /** the key's attributes */
    attributes: KOSMetadataAttribute[];
}

export interface KOSMetadataAttribute {
    /** the display type of this attribute in nft marketplaces */
    displayType: string | null;
    /** the trait type */
    traitType: string;
    /** the value of this trait */
    value: number | string;
}

/**
 * Represents the explicit ownership struct of a Key Of Salvation.
 */
export interface KOSExplicitOwnership {
    /** the owner of the key */
    owner: string;
    /** the start timestamp of the ownership */
    startTimestamp: number;
    /** if the key is burned */
    burned: boolean;
    /** extra data */
    extraData: number;
}

/**
 * Represents all available pillar types for KOS.
 */
export enum KOSPillarTypes {
    PILLAR_OF_ETERNITY = 'Pillar of Eternity',
    PILLAR_OF_DESTINY = 'Pillar of Destiny',
}

/**
 * Represents all available podium types for KOS.
 */
export enum KOSPodiumTypes {
    TIMELESS_TRIUNE = 'Timeless Triune',
    PRIMORDIAL_PRISM = 'Primordial Prism',
    STELLAR_SELENITE = 'Stellar Selenite',
}

/**
 * Represents all available house types for KOS.
 */
export enum KOSHouseTypes {
    TRADITION = 'Tradition',
    CHAOS = 'Chaos',
    GLORY = 'Glory',
}

/**
 * Represents all available aura types for KOS.
 */
export enum KOSAuraTypes {
    SNOW = 'Snow',
    LIGHTNING = 'Lightning',
    SMOKE = 'Smoke',
}