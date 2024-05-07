import { SquadRank } from '../../models/squad'

/**
 * Gets a squad's new weekly ranking based on the points earned the previous week.
 */
export const GET_SQUAD_WEEKLY_RANKING = (points: number): SquadRank => {
    if (points >= 1 && points <= 4999) {
        return SquadRank.BRONZE;
    } else if (points >= 5000 && points <= 9999) {
        return SquadRank.SILVER;
    } else if (points >= 10000 && points <= 14999) {
        return SquadRank.GOLD;
    } else if (points >= 15000 && points <= 19999) {
        return SquadRank.PLATINUM;
    } else if (points >= 20000 && points <= 24999) {
        return SquadRank.DIAMOND;
    } else if (points >= 25000) {
        return SquadRank.MASTER;
    // if the squad has no points, they are unranked
    } else {
        return SquadRank.UNRANKED;
    }
}