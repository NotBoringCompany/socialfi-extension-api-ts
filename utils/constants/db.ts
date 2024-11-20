import mongoose from 'mongoose';
import { UserSchema } from '../../schemas/User';
import { BitSchema } from '../../schemas/Bit';
import { IslandSchema } from '../../schemas/Island';
import { RaftSchema } from '../../schemas/Raft';
import { CookieDepositSchema, CookieWithdrawalSchema } from '../../schemas/Cookie';
import { QuestDailySchema, QuestProgressionSchema, QuestSchema } from '../../schemas/Quest';
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
import { CollabBasketSchema, CollabParticipantSchema } from '../../schemas/Collab';
import { ShopAssetPurchaseSchema, ShopAssetSchema } from '../../schemas/Shop';

import * as dotenv from 'dotenv';
dotenv.config({});

export const WONDERBITS_DATABASE = process.env.WONDERBITS_MONGODB_URI!;
// create a connection to the wonderbits database
export const WONDERBITS_CONNECTION = mongoose.createConnection(WONDERBITS_DATABASE);

WONDERBITS_CONNECTION.on('connected', () => {
    console.log('connected to: ', WONDERBITS_DATABASE);
    console.log(`Connected to the wonderbits database.`);
})

export const UserModel = WONDERBITS_CONNECTION.model('Users', UserSchema, 'Users');
export const BitModel = WONDERBITS_CONNECTION.model('Bits', BitSchema, 'Bits');
export const IslandModel = WONDERBITS_CONNECTION.model('Islands', IslandSchema, 'Islands');
export const RaftModel = WONDERBITS_CONNECTION.model('Rafts', RaftSchema, 'Rafts');
export const CookieDepositModel = WONDERBITS_CONNECTION.model('CookieDeposits', CookieDepositSchema, 'CookieDeposits');
export const CookieWithdrawalModel = WONDERBITS_CONNECTION.model('CookieWithdrawals', CookieWithdrawalSchema, 'CookieWithdrawals');
export const QuestModel = WONDERBITS_CONNECTION.model('Quests', QuestSchema, 'Quests_V2');
export const QuestDailyModel = WONDERBITS_CONNECTION.model('QuestDaily', QuestDailySchema, 'QuestDaily');
export const QuestProgressionModel = WONDERBITS_CONNECTION.model('QuestProgressions', QuestProgressionSchema, 'QuestProgressions');
export const POIModel = WONDERBITS_CONNECTION.model('POI', POISchema, 'POI');
export const LeaderboardModel = WONDERBITS_CONNECTION.model('Leaderboards', LeaderboardSchema, 'Leaderboards');
export const StarterCodeModel = WONDERBITS_CONNECTION.model('StarterCodes', StarterCodeSchema, 'StarterCodes');
export const TutorialModel = WONDERBITS_CONNECTION.model('Tutorials', TutorialSchema, 'Tutorials');
export const SquadModel = WONDERBITS_CONNECTION.model('Squads', SquadSchema, 'Squads');
export const SquadLeaderboardModel = WONDERBITS_CONNECTION.model('SquadLeaderboards', SquadLeaderboardSchema, 'SquadLeaderboards');
export const SettingModel = WONDERBITS_CONNECTION.model('Settings', SettingSchema, 'Settings');
export const POAPModel = WONDERBITS_CONNECTION.model('POAP', POAPSchema, 'POAP');
export const KOSClaimableDailyRewardsModel = WONDERBITS_CONNECTION.model('KOSClaimableDailyRewards', KOSClaimableDailyRewardsSchema, 'KOSClaimableDailyRewards');
export const KOSClaimableWeeklyRewardsModel = WONDERBITS_CONNECTION.model('KOSClaimableWeeklyRewards', KOSClaimableWeeklyRewardsSchema, 'KOSClaimableWeeklyRewards');
export const WeeklyMVPClaimableRewardsModel = WONDERBITS_CONNECTION.model('WeeklyMVPClaimableRewards', WeeklyMVPClaimableRewardSchema, 'WeeklyMVPClaimableRewards');
export const SquadMemberClaimableWeeklyRewardModel = WONDERBITS_CONNECTION.model('SquadMemberClaimableWeeklyRewards', SquadMemberClaimableWeeklyRewardSchema, 'SquadMemberClaimableWeeklyRewards');
export const CollabParticipantModel = WONDERBITS_CONNECTION.model('CollabParticipants', CollabParticipantSchema, 'CollabParticipants');
export const CollabBasketModel = WONDERBITS_CONNECTION.model('CollabBaskets', CollabBasketSchema, 'CollabBaskets');
export const WeeklyMVPRankingLeaderboardModel = WONDERBITS_CONNECTION.model('WeeklyMVPRankingData', WeeklyMVPRankingLeaderboardSchema, 'WeeklyMVPRankingData');
export const SuccessfulIndirectReferralModel = WONDERBITS_CONNECTION.model('SuccessfulIndirectReferrals', SuccessfulIndirectReferralSchema, 'SuccessfulIndirectReferrals');
export const ShopAssetModel = WONDERBITS_CONNECTION.model('ShopAssets', ShopAssetSchema, 'ShopAssets');
export const ShopAssetPurchaseModel = WONDERBITS_CONNECTION.model('ShopAssetPurchases', ShopAssetPurchaseSchema, 'ShopAssetPurchases');