/** the initial max members allowed for new squads */
export const INITIAL_MAX_MEMBERS = 10;
/** the max amount of max members a squad can have */
export const MAX_MEMBERS_LIMIT = 50;
/** the max number of leaders a squad can have */
export const MAX_LEADERS_LIMIT = 1;

/** the increase in max members count upon upgrading once */
export const MAX_MEMBERS_INCREASE_UPON_UPGRADE = 5;

/** the cooldown after leaving a squad before being able to join another squad (in seconds) */
export const SQUAD_LEAVE_COOLDOWN = 86400;
/** the cooldown to rename the squad again (in seconds) */
export const RENAME_SQUAD_COOLDOWN = 604800;

/**
 * Gets the cost (in xCookies) for upgrading the max members count of a squad.
 * 
 * Each upgrade increases the max members count by `MAX_MEMBERS_INCREASE_UPON_UPGRADE`.
 */
export const UPGRADE_SQUAD_MAX_MEMBERS_COST = (currentMaxMembers: number) => {
    if (currentMaxMembers < 25) {
        return 20;
    } else if (currentMaxMembers < 50) {
        return 40;
    } else if (currentMaxMembers < 100) {
        return 80;
    } else {
        throw new Error('Cannot upgrade max members count beyond 100.');
    }
}

/**
 * Gets the benefits for each member (or a specific member if applicable) of a squad depending on the accumulated owned KOS amount.
 */
export const SQUAD_KOS_BENEFITS = (totalKeys: number): {
    // boost in points when selling assets in POI (in ratio. 1 means no boost, 1.05 means 5% boost, etc.)
    sellAssetPointsBoost: number
} => {
    if (totalKeys < 5) {
        return {
            sellAssetPointsBoost: 1
        }
    } else if (totalKeys < 10) {
        return {
            sellAssetPointsBoost: 1.01
        }
    } else if (totalKeys < 20) {
        return {
            sellAssetPointsBoost: 1.02
        }
    } else if (totalKeys < 35) {
        return {
            sellAssetPointsBoost: 1.03
        }
    } else if (totalKeys < 50) {
        return {
            sellAssetPointsBoost: 1.04
        }
    } else if (totalKeys < 100) {
        return {
            sellAssetPointsBoost: 1.05
        }
    } else {
        return {
            sellAssetPointsBoost: 1.10
        }
    }
}

/** cost in xCookies for creating a squad */
export const CREATE_SQUAD_COST = 30;
/** cost in xCookies for renaming a squad */
export const RENAME_SQUAD_COST = 15;