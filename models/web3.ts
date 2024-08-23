/**
 * The parsed message body from a transaction made in TON (in the future, this will be branched to support other blockchains).
 * 
 * Some fields are shortened to reduce the amount of bytes in the payload to reduce TX costs.
 * 
 * Used for verifying transactions.
 */
export interface TxParsedMessage {
    // the asset name
    asset: string;
    // the amount of the asset purchased
    amt: number;
    // the total cost of the transaction
    cost: number;
    // the currency of the transaction
    curr: string;
}