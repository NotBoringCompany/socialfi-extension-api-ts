import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

import { UserSchema } from '../../schemas/User';
import { BitSchema } from '../../schemas/Bit';
import { IslandSchema } from '../../schemas/Island';
import { RaftSchema } from '../../schemas/Raft';
import { CookieDepositSchema, CookieWithdrawalSchema } from '../../schemas/Cookie';
import { QuestSchema } from '../../schemas/Quest';
import { POISchema } from '../../schemas/POI';
import { LeaderboardSchema } from '../../schemas/Leaderboard';
import { StarterCodeSchema, SuccessfulIndirectReferralSchema } from '../../schemas/Invite';
import { TutorialSchema } from '../../schemas/Tutorial';
import { SquadSchema } from '../../schemas/Squad';
import { SquadLeaderboardSchema, SquadMemberClaimableWeeklyRewardSchema } from '../../schemas/SquadLeaderboard';
import { SettingSchema } from '../../schemas/Setting';
import { POAPSchema } from '../../schemas/POAP';
import { KOSClaimableDailyRewardsSchema, KOSClaimableWeeklyRewardsSchema } from '../../schemas/KOSRewards';
import { WeeklyMVPClaimableRewardSchema, WeeklyMVPRankingLeaderboardSchema } from '../../schemas/WeeklyMVPReward';
import { CollabSchema } from '../../schemas/Collab';
import { CollabBasketSchema, CollabParticipantSchema } from '../../schemas/CollabV2';

const TEST_DATABASE = process.env.MONGODB_URI!;
const WONDERBITS_DATABASE = process.env.WONDERBITS_MONGODB_URI!;

// connects to the test database
export const TEST_CONNECTION = mongoose.createConnection(TEST_DATABASE);
// connects to the wonderbits database
export const WONDERBITS_CONNECTION = mongoose.createConnection(WONDERBITS_DATABASE);

TEST_CONNECTION.on('connected', () => {
    console.log('Connected to test database');
})

WONDERBITS_CONNECTION.on('connected', () => {
    console.log('Connected to wonderbits database');
})

export const UserModel = TEST_CONNECTION.model('Users', UserSchema, 'Users');
export const BitModel = TEST_CONNECTION.model('Bits', BitSchema, 'Bits');
export const IslandModel = TEST_CONNECTION.model('Islands', IslandSchema, 'Islands');
export const RaftModel = TEST_CONNECTION.model('Rafts', RaftSchema, 'Rafts');
export const CookieDepositModel = TEST_CONNECTION.model('CookieDeposits', CookieDepositSchema, 'CookieDeposits');
export const CookieWithdrawalModel = TEST_CONNECTION.model('CookieWithdrawals', CookieWithdrawalSchema, 'CookieWithdrawals');
export const QuestModel = TEST_CONNECTION.model('Quests', QuestSchema, 'Quests');
export const POIModel = TEST_CONNECTION.model('POI', POISchema, 'POI');
export const LeaderboardModel = TEST_CONNECTION.model('Leaderboards', LeaderboardSchema, 'Leaderboards');
export const StarterCodeModel = TEST_CONNECTION.model('StarterCodes', StarterCodeSchema, 'StarterCodes');
export const TutorialModel = TEST_CONNECTION.model('Tutorials', TutorialSchema, 'Tutorials');
export const SquadModel = TEST_CONNECTION.model('Squads', SquadSchema, 'Squads');
export const SquadLeaderboardModel = TEST_CONNECTION.model('SquadLeaderboards', SquadLeaderboardSchema, 'SquadLeaderboards');
export const SettingModel = TEST_CONNECTION.model('Settings', SettingSchema, 'Settings');
export const POAPModel = TEST_CONNECTION.model('POAP', POAPSchema, 'POAP');
export const KOSClaimableDailyRewardsModel = TEST_CONNECTION.model('KOSClaimableDailyRewards', KOSClaimableDailyRewardsSchema, 'KOSClaimableDailyRewards');
export const KOSClaimableWeeklyRewardsModel = TEST_CONNECTION.model('KOSClaimableWeeklyRewards', KOSClaimableWeeklyRewardsSchema, 'KOSClaimableWeeklyRewards');
export const WeeklyMVPClaimableRewardsModel = TEST_CONNECTION.model('WeeklyMVPClaimableRewards', WeeklyMVPClaimableRewardSchema, 'WeeklyMVPClaimableRewards');
export const SquadMemberClaimableWeeklyRewardModel = TEST_CONNECTION.model('SquadMemberClaimableWeeklyRewards', SquadMemberClaimableWeeklyRewardSchema, 'SquadMemberClaimableWeeklyRewards');
export const CollabModel = TEST_CONNECTION.model('Collabs', CollabSchema, 'Collabs');
export const CollabParticipantModel = TEST_CONNECTION.model('CollabParticipants', CollabParticipantSchema, 'CollabParticipants');
export const CollabBasketModel = TEST_CONNECTION.model('CollabBaskets', CollabBasketSchema, 'CollabBaskets');
export const WeeklyMVPRankingLeaderboardModel = TEST_CONNECTION.model('WeeklyMVPRankingData', WeeklyMVPRankingLeaderboardSchema, 'WeeklyMVPRankingData');
export const SuccessfulIndirectReferralModel = TEST_CONNECTION.model('SuccessfulIndirectReferrals', SuccessfulIndirectReferralSchema, 'SuccessfulIndirectReferrals');
