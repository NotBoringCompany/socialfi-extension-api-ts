/**
 * Checks if two sets are equal. Used mainly for lottery draw verification.
 */
export const areSetsEqual = (setA: Set<number>, setB: Set<number>): boolean => {
    if (setA.size !== setB.size) return false;
    for (let a of setA) if (!setB.has(a)) return false;

    return true;
}

/**
 * For a ticket's `pickedNumbers`, calculate how many of it matches the `winningNumbers` in any order.
 */
export const countMatchingNormalNumbers = (pickedNumbers: number[], winningNumbers: Set<number>): number => {
    let count = 0;

    for (let number of pickedNumbers) {
        // if the winning numbers set has this number from the `pickedNumbers`, increment the count
        if (winningNumbers.has(number)) count++;
    }

    return count;
}

/**
 * Checks if the special number (6th number) matches the winning numbers.
 */
export const isSpecialNumberCorrect = (pickedNumbers: number[], winningNumbers: Set<number>): boolean => {
    // we assume that the 6th number (i.e. 5th index) of both `pickedNumbers` and `winningNumbers` is the special number between 1 - 26
    // the parent function will check this condition, thus we don't check it here
    return winningNumbers.has(pickedNumbers[5]);
}