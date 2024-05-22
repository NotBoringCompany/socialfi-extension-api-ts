/**
 * Gets the benefits (in xCookies) for holding a certain amount of keys daily.
 */
export const KOS_DAILY_BENEFITS = (keysOwned: number): number => {
    if (keysOwned < 1) {
        return 0;
    } else if (keysOwned === 1) {
        return 50;
    } else if (keysOwned === 2) {
        return 60;
    } else if (keysOwned >= 3 && keysOwned < 5) {
        return 90;
    } else if (keysOwned >= 5 && keysOwned < 7) {
        return 150;
    } else if (keysOwned >= 7 && keysOwned < 15) {
        return 210;
    } else if (keysOwned >= 15 && keysOwned < 25) {
        return 450;
    } else if (keysOwned >= 25 && keysOwned < 50) {
        return 750;
    } else if (keysOwned >= 50 && keysOwned < 100) {
        return 1500;
    } else if (keysOwned >= 100 && keysOwned < 200) {
        return 3000;
    } else {
        return 6000;
    }
}

/**
 * Gets the benefits (in leaderboard points) for holding a certain amount of keys weekly.
 */
export const KOS_WEEKLY_BENEFITS = (keysOwned: number): number => {
    if (keysOwned < 1) {
        return 0;
    } else if (keysOwned === 1) {
        return 1500;
    } else if (keysOwned === 2) {
        return 3000;
    } else if (keysOwned >= 3 && keysOwned < 5) {
        return 4500;
    } else if (keysOwned >= 5 && keysOwned < 7) {
        return 7500;
    } else if (keysOwned >= 7 && keysOwned < 15) {
        return 10500;
    } else if (keysOwned >= 15 && keysOwned < 25) {
        return 22500;
    } else if (keysOwned >= 25 && keysOwned < 50) {
        return 37500;
    } else if (keysOwned >= 50 && keysOwned < 100) {
        return 75000;
    } else if (keysOwned >= 100 && keysOwned < 200) {
        return 150000;
    } else {
        return 300000;
    }
}