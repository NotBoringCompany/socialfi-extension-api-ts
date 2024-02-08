/****************
 * RESOURCE-RELATED MODELS
 ****************/

/**
 * Represents a resource.
 * 
 * Since this is not an SFT/NFT yet, we don't associate a single resource with an ID, but rather treat it as a quantitative asset.
 */
export interface Resource {
    /** the type of resource */
    type: ResourceType;
    /** the amount of resource */
    amount: number;
}

/**
 * Represents the type of resource.
 */
export enum ResourceType {
    SEAWEED = 'Seaweed', // only available for raft, not islands
    SILVER = 'Silver',
    EMERALD = 'Emerald',
    DIAMOND = 'Diamond',
    TANZANITE = 'Tanzanite',
    RELIC = 'Relic',
}