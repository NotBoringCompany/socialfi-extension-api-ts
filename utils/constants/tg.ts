/**
 * Converts USD into the equivalent amount of Telegram Stars.
 * 
 * Used for purchases in the shop with Telegram Stars.
 */
export const USD_TO_STARS_CONVERSION = (usd: number): number => {
    // divide by 0.02 and round up.
    return Math.ceil(usd / 0.02);
}