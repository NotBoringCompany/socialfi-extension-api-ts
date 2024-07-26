import { SquadRank } from '../../models/squad'
import { SquadReward, SquadRewardType } from '../../models/squadLeaderboard';

/**
 * Gets a squad's new weekly ranking based on the points earned the previous week.
 */
export const GET_SQUAD_WEEKLY_RANKING = (points: number): SquadRank => {
    if (points >= 1 && points <= 1999) {
        return SquadRank.UNRANKED;
    } else if (points >= 2000 && points <= 4999) {
        return SquadRank.BRONZE;
    } else if (points >= 5000 && points <= 19999) {
        return SquadRank.SILVER;
    } else if (points >= 20000 && points <= 39999) {
        return SquadRank.GOLD;
    } else if (points >= 40000 && points <= 79999) {
        return SquadRank.PLATINUM;
    } else if (points >= 80000 && points <= 149999) {
        return SquadRank.DIAMOND;
    } else {
        return SquadRank.MASTER;
    }
}

/**
 * Gets the bonus in points a squad leader can get based on their squad's weekly ranking while selling items in the POI.
 * 
 * 1 means no boost, 1.05 means 5% boost, etc.
 */
export const GET_LEADER_SQUAD_WEEKLY_RANKING_POI_POINTS_BOOST = (rank: SquadRank): number => {
    switch (rank) {
        case SquadRank.UNRANKED:
            return 1;
        case SquadRank.BRONZE:
            return 1;
        case SquadRank.SILVER:
            return 1;
        case SquadRank.GOLD:
            return 1;
        case SquadRank.PLATINUM:
            return 1.01;
        case SquadRank.DIAMOND:
            return 1.015;
        case SquadRank.MASTER:
            return 1.02;
    }
}

/**
 * Shows the eligible rewards the leader and members can get based on their squad's weekly ranking.
 */
export const GET_SQUAD_WEEKLY_RANKING_REWARDS = (rank: SquadRank): {
    leader: SquadReward[],
    member: SquadReward[]
} => {
    switch (rank) {
        case SquadRank.UNRANKED:
            return {
                leader: [],
                member: []
            }
        case SquadRank.BRONZE:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 1
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 1
                    },
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 3
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 1
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 1
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 2
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 1
                    }
                ]
            }
        case SquadRank.SILVER:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 2
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 2
                    },
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 2
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 2
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 4
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 2
                    }
                ]
            }
        case SquadRank.GOLD:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 3
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 3
                    },
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 9
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 3
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 3
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 3
                    }
                ]
            }
        case SquadRank.PLATINUM:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 4
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 4
                    },
                    {
                        type: SquadRewardType.BIT_ORB_III,
                        amount: 1
                    }
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 12
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 4
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 4
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 8
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 4
                    }
                ]
            }
        case SquadRank.DIAMOND:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 5
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 5
                    },
                    {
                        type: SquadRewardType.BIT_ORB_III,
                        amount: 2
                    }
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 15
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 5
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 5
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 10
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 5
                    }
                ]
            }
        case SquadRank.MASTER:
            return {
                leader: [
                    {
                        type: SquadRewardType.BIT_ORB_II,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_II,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.BIT_ORB_III,
                        amount: 3
                    }
                ],
                member: [
                    {
                        type: SquadRewardType.BURGER,
                        amount: 21
                    },
                    {
                        type: SquadRewardType.BIT_ORB_I,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.TERRA_CAPSULATOR_I,
                        amount: 6
                    },
                    {
                        type: SquadRewardType.GATHERING_PROGRESS_BOOSTER_50,
                        amount: 12
                    },
                    {
                        type: SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN,
                        amount: 6
                    }
                ]
            }
        default:
            return {
                leader: [],
                member: []
            }
    }
}