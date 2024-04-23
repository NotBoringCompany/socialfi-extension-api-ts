/**
 * Represents the full metadata of a Key Of Salvation.
 */
export interface KOSMetadata {
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