import { Resource } from './resource';

/**
 * Represents a lottery draw.
 */
export interface Lottery {
    /** unique ID for the draw, increments by 1 on every new draw */
    drawId: number;
    /** the timestamp of the draw was created */
    createdTimestamp: number;
    /** the timestamp of when the draw will be/was finalized (where winners will be chosen) */
    finalizationTimestamp: number;
    /** the tickets that are purchased for this draw by users */
    tickets: Ticket[];
    /** the winning numbers for the current draw; 1st to 5th number is 1-69, 6th number is 1-26 */
    winningNumbers: number[];
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
    resourceSpent: Resource;
}

/**
 * Represents a lottery winner.
 * 
 * This is technically available from the `merkleRoot` field in `LotteryDraw`, but this is used to simplify backend operations.
 */
export interface Winner {
    /** the database ID of the winner */
    winner: string;
    /** the wallet address of the winner */
    winnerAddress: string;
    /** the IDs of the tickets that won at least the lowest prize */
    ticketsWon: number[];
    /** the total prize won (in wei; will be converted to eth later) */
    totalPrizeWon: number;
}

/**
 * Represents a prize tier for the lottery.
 */
export enum PrizeTier {
    NO_PRIZE = 'No Prize',
    MATCH_SPECIAL_ONLY = 'Match Special Only',
    MATCH_1_PLUS_SPECIAL = 'Match 1 + Special',
    MATCH_2_PLUS_SPECIAL = 'Match 2 + Special',
    MATCH_3_ONLY = 'Match 3 Only',
    MATCH_3_PLUS_SPECIAL = 'Match 3 + Special',
    MATCH_4_ONLY = 'Match 4 Only',
    MATCH_4_PLUS_SPECIAL = 'Match 4 + Special',
    MATCH_5_ONLY = 'Match 5 Only',
    // match 5 + special
    JACKPOT = 'Jackpot'
}