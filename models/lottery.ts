import { SimplifiedResource } from './resource';

/**
 * Represents a lottery draw.
 */
export interface Lottery {
    /** unique ID for the draw, increments by 1 on every new draw */
    drawId: number;
    /** if ticket purchases are still allowed (draw is still open) */
    open: boolean;
    /** the timestamp of the draw was created */
    createdTimestamp: number;
    /** the timestamp of when the draw will be/was finalized (where winners will be chosen) */
    finalizationTimestamp: number;
    /** the tickets that are purchased for this draw by users */
    tickets: Ticket[];
    /** the winning numbers for the current draw; 1st to 5th number is 1-69, 6th number is 1-26 */
    winningNumbers: Set<number>;
    /** the merkle root representing the winners and their equivalent prizes */
    merkleRoot: string;
    /** the server seed used to determine the winning numbers (IMPORTANT TO NOT SHOW UNTIL DRAW IS FINALIZED) */
    serverSeed: string;
    /** the hashed server seed used to determine the winning numbers (this one can be shown to the public) */
    hashedServerSeed: string;
    /** draw seed obtained by various blockchain data during creation of the draw */
    drawSeed: string;
    /** the winners of the current draw; added once draw is finalized */
    winners: Winner[];
}

/**
 * Represents a lottery ticket.
 */
export interface Ticket {
    /** unique ID for the ticket, increments by 1 on every new purchase */
    ticketId: number;
    /** the draw ID that the ticket is valid for */
    drawId: number;
    /** the owner/purchaser of the ticket; uses the user's database ID */
    owner: string;
    /** the picked numbers for the draw; 1st to 5th number is 1-69, 6th number is 1-26 */
    pickedNumbers: number[];
    /** the timestamp of when the ticket was purchased */
    purchaseTimestamp: number;
    // the resource used to purchase the ticket
    resourcesSpent: SimplifiedResource;
}

/**
 * Represents a lottery winner.
 * 
 * This is technically available from the `merkleRoot` field in `Lottery`, but this is used to simplify backend operations.
 */
export interface Winner {
    /** the database ID of the winner */
    winner: string;
    /** the wallet address of the winner */
    winnerAddress: string;
    /** the IDs of the tickets that won at least the lowest prize */
    ticketsWon: number[];
    /** the total prize won (final prize amount will be calculated from this) */
    totalPrizeWon: Prize;
    /** the final prize won by the winner; either the fixed amount or via points after calculation */
    finalPrize: number;
    /** if the prize is already claimed by the winner */
    claimedPrize: boolean;
}

/**
 * Represents a lottery prize.
 */
export interface Prize {
    // fixed amount of the prize in ETH
    fixedAmount: number;
    // the total points earned from this prize
    points: number;
}