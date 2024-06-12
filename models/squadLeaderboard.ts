import { BitOrbType } from './bitOrb';
import { BoosterItem } from './booster';
import { FoodType } from './food';
import { TerraCapsulatorType } from './terraCapsulator';

/**
 * Represents a weekly leaderboard for squads.
 */
export interface SquadWeeklyLeaderboard {
    /** the week number */
    week: number;
    /** the squad points data */
    pointsData: SquadWeeklyPointsData[];
}

/**
 * Represents the squad points earned by members over a week.
 */
export interface SquadWeeklyPointsData {
    /** the squad id */
    squadId: string;
    /** the squad name */
    squadName: string;
    /** points data for each member */
    memberPoints: SquadMemberWeeklyPoints[];
}

/**
 * Represents the squad points earned by a member over a week.
 */
export interface SquadMemberWeeklyPoints {
    /** the members's database ID */
    userId: string;
    /** the member's username */
    username: string;
    /** the member's points */
    points: number;
}

/**
 * Represents the claimable weekly rewards for an eligible squad member.
 */
export interface SquadMemberClaimableWeeklyReward {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the claimable weekly rewards the user can claim */
    claimableRewards: SquadReward[];
}

/**
 * Represents a squad reward instance.
 */
export interface SquadReward {
    /** the reward type */
    type: SquadRewardType;
    /** the amount of the reward to give */
    amount: number;
}

/**
 * Represents all available squad reward types.
 */
export enum SquadRewardType {
    BIT_ORB_I = BitOrbType.BIT_ORB_I,
    BIT_ORB_II = BitOrbType.BIT_ORB_II,
    BIT_ORB_III = BitOrbType.BIT_ORB_III,
    TERRA_CAPSULATOR_I = TerraCapsulatorType.TERRA_CAPSULATOR_I,
    TERRA_CAPSULATOR_II = TerraCapsulatorType.TERRA_CAPSULATOR_II,
    BURGER = FoodType.BURGER,
    GATHERING_PROGRESS_BOOSTER_50 = BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
    RAFT_SPEED_BOOSTER_3_MIN = BoosterItem.RAFT_SPEED_BOOSTER_3_MIN,
}