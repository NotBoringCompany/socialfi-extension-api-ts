import { z } from 'zod';

export interface ListingsQuery {
    item?: string;
    currency?: string;
    startTimestamp?: number;
    endTimestamp?: number;
    limit?: number;
    /** the twitterId or _id of the person who listed the listing */
    user?: string;
}

export const listingsQuery = z.object({
    item: z.string().optional(),
    currency: z.string().optional(),
    startTimestamp: z.number().optional(),
    endTimestamp: z.number().optional(),
    limit: z.number().min(1).optional(),
    user: z.string().optional(),
});

export interface AddListingDTO {
    soldBy: string;
    item: string;
    amount: number;
    price: number;
    currency: string;
}

export const addListingDTO = z.object({
    soldBy: z.string(),
    item: z.string(),
    amount: z.number().min(1), // amount should be at least 1
    price: z.number().min(0), // price should be non-negative
    currency: z.string(),
});

export interface PurchaseListingDTO {
    /** the listing unique object id */
    listingId: string;
    /** the purchase amount, could be partial */
    purchaseAmount: number;
    /** the twitterId or _id of the person who purchase the listing */
    userId: string;
}

export const purchaseListingDTO = z.object({
    listingId: z.string(),
    purchaseAmount: z.number().min(1),
    userId: z.string(),
});

export interface ClaimListingDTO {
    /** the listing unique object id */
    listingId: string;
    /** the twitterId or _id of the person who listed the listing */
    userId: string;
}

export const claimListingDTO = z.object({
    listingId: z.string(),
    userId: z.string(),
});

export interface CancelListingDTO {
    /** the listing unique object id */
    listingId: string;
    /** the twitterId or _id of the person who listed the listing */
    userId: string;
}

export const cancelListingDTO = z.object({
    listingId: z.string(),
    userId: z.string(),
});
