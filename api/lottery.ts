import CryptoJS from 'crypto-js';
import { areSetsEqual } from '../utils/lottery';

/**
 * Generates the winning numbers for a lottery draw given the `serverSeed` and `drawSeed`.
 */
export const generateWinningNumbers =  (serverSeed: string, drawSeed: string): Set<number> => {
    const combinedSeed = CryptoJS.SHA256(serverSeed + drawSeed).toString();

    let numbers: Set<number> = new Set();

    // generate 5 unique numbers each between 1 - 69 (cannot be repeated)
    while (numbers.size < 5) {
        const hash = CryptoJS.SHA256(combinedSeed + numbers.size).toString();
        const number = parseInt(hash, 16) % 69 + 1;

        numbers.add(number);
    }

    // since the special number can intersect with the other 5 numbers, we don't have to check for uniqueness
    const specialHash = CryptoJS.SHA256(combinedSeed + 5).toString();
    const specialNumber = parseInt(specialHash, 16) % 26 + 1;

    numbers.add(specialNumber);

    return numbers;
}

/**
 * Verifies if the winning numbers match the generated winning numbers from the server and draw seeds.
 * 
 * If this function returns true, then the draw is considered valid.
 */
export const verifyWinningNumbers = (serverSeed: string, drawSeed: string, winningNumbers: Set<number>): boolean => {
    const generatedNumbers = generateWinningNumbers(serverSeed, drawSeed);

    return areSetsEqual(generatedNumbers, winningNumbers);
}