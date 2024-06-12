import { SquadRank } from '../../models/squad'

/**
 * Gets a squad's new weekly ranking based on the points earned the previous week.
 */
export const GET_SQUAD_WEEKLY_RANKING = (points: number): SquadRank => {
    if (points >= 1 && points <= 99999) {
        return SquadRank.UNRANKED;
    } else if (points >= 100000 && points <= 999999) {
        return SquadRank.BRONZE;
    } else if (points >= 1000000 && points <= 4999999) {
        return SquadRank.SILVER;
    } else if (points >= 5000000 && points <= 19999999) {
        return SquadRank.GOLD;
    } else if (points >= 20000000 && points <= 49999999) {
        return SquadRank.PLATINUM;
    } else if (points >= 50000000 && points <= 99999999) {
        return SquadRank.DIAMOND;
    } else {
        return SquadRank.MASTER;
    }
}