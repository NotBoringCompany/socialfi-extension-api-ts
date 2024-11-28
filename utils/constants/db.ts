import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

import { UserSchema } from '../../schemas/User';
import { BitSchema, BitTraitDataSchema } from '../../schemas/Bit';
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
import { ChatroomSchema, ChatSchema } from '../../schemas/Chat';
import { CraftingQueueSchema, CraftingRecipeSchema } from '../../schemas/Craft';
import { BanSchema } from '../../schemas/Ban';
import { MailReceiverDataSchema, MailSchema } from '../../schemas/Mail';
import { ConsumedSynthesizingItemSchema } from '../../schemas/Asset';
import { UserWonderspinDataSchema, WonderspinSchema } from '../../schemas/Gacha';
import { BitCosmeticSchema, UserBitCosmeticSchema } from '../../schemas/Cosmetic';
import { UserWonderpassDataSchema, WonderpassSchema } from '../../schemas/Wonderpass';
import { FriendSchema } from '../../schemas/Friend';
import { ReportSchema } from '../../schemas/Report';
import { TradeListingSchema } from '../../schemas/Trade';


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

// ALL WONDERBITS DATABASE MODELS
export const WonderbitsUserModel = WONDERBITS_CONNECTION.model('Users', UserSchema, 'Users');
export const WonderbitsBitModel = WONDERBITS_CONNECTION.model('Bits', BitSchema, 'Bits');
export const WonderbitsIslandModel = WONDERBITS_CONNECTION.model('Islands', IslandSchema, 'Islands');
export const WonderbitsRaftModel = WONDERBITS_CONNECTION.model('Rafts', RaftSchema, 'Rafts');
export const WonderbitsQuestModel = WONDERBITS_CONNECTION.model('Quests', QuestSchema, 'Quests');
export const WonderbitsPOIModel = WONDERBITS_CONNECTION.model('POI', POISchema, 'POI');
export const WonderbitsLeaderboardModel = WONDERBITS_CONNECTION.model('Leaderboards', LeaderboardSchema, 'Leaderboards');
export const WonderbitsStarterCodeModel = WONDERBITS_CONNECTION.model('StarterCodes', StarterCodeSchema, 'StarterCodes');
export const WonderbitsTutorialModel = WONDERBITS_CONNECTION.model('Tutorials', TutorialSchema, 'Tutorials');
export const WonderbitsSquadModel = WONDERBITS_CONNECTION.model('Squads', SquadSchema, 'Squads');
export const WonderbitsSquadLeaderboardModel = WONDERBITS_CONNECTION.model('SquadLeaderboards', SquadLeaderboardSchema, 'SquadLeaderboards');
export const WonderbitsSettingModel = WONDERBITS_CONNECTION.model('Settings', SettingSchema, 'Settings');
export const WonderbitsPOAPModel = WONDERBITS_CONNECTION.model('POAP', POAPSchema, 'POAP');
export const WonderbitsKOSClaimableDailyRewardsModel = WONDERBITS_CONNECTION.model('KOSClaimableDailyRewards', KOSClaimableDailyRewardsSchema, 'KOSClaimableDailyRewards');
export const WonderbitsKOSClaimableWeeklyRewardsModel = WONDERBITS_CONNECTION.model('KOSClaimableWeeklyRewards', KOSClaimableWeeklyRewardsSchema, 'KOSClaimableWeeklyRewards');
export const WonderbitsWeeklyMVPClaimableRewardsModel = WONDERBITS_CONNECTION.model('WeeklyMVPClaimableRewards', WeeklyMVPClaimableRewardSchema, 'WeeklyMVPClaimableRewards');
export const WonderbitsSquadMemberClaimableWeeklyRewardModel = WONDERBITS_CONNECTION.model('SquadMemberClaimableWeeklyRewards', SquadMemberClaimableWeeklyRewardSchema, 'SquadMemberClaimableWeeklyRewards');
export const WonderbitsCollabParticipantModel = WONDERBITS_CONNECTION.model('CollabParticipants', CollabParticipantSchema, 'CollabParticipants');
export const WonderbitsCollabBasketModel = WONDERBITS_CONNECTION.model('CollabBaskets', CollabBasketSchema, 'CollabBaskets');
export const WonderbitsWeeklyMVPRankingLeaderboardModel = WONDERBITS_CONNECTION.model('WeeklyMVPRankingData', WeeklyMVPRankingLeaderboardSchema, 'WeeklyMVPRankingData');
export const WonderbitsSuccessfulIndirectReferralModel = WONDERBITS_CONNECTION.model('SuccessfulIndirectReferrals', SuccessfulIndirectReferralSchema, 'SuccessfulIndirectReferrals');
export const WonderbitsShopAssetModel = WONDERBITS_CONNECTION.model('ShopAssets', ShopAssetSchema, 'ShopAssets');
export const WonderbitsShopAssetPurchaseModel = WONDERBITS_CONNECTION.model('ShopAssetPurchases', ShopAssetPurchaseSchema, 'ShopAssetPurchases');

// ALL TEST DATABASE MODELS
export const UserModel = TEST_CONNECTION.model('Users', UserSchema, 'Users');
export const BitModel = TEST_CONNECTION.model('Bits', BitSchema, 'Bits');
export const IslandModel = TEST_CONNECTION.model('Islands', IslandSchema, 'Islands');
export const RaftModel = TEST_CONNECTION.model('Rafts', RaftSchema, 'Rafts');
export const CookieDepositModel = TEST_CONNECTION.model('CookieDeposits', CookieDepositSchema, 'CookieDeposits');
export const CookieWithdrawalModel = TEST_CONNECTION.model('CookieWithdrawals', CookieWithdrawalSchema, 'CookieWithdrawals');
export const QuestModel = TEST_CONNECTION.model('Quests', QuestSchema, 'Quests_V2');
export const QuestDailyModel = TEST_CONNECTION.model('QuestDaily', QuestDailySchema, 'QuestDaily');
export const QuestProgressionModel = TEST_CONNECTION.model('QuestProgressions', QuestProgressionSchema, 'QuestProgressions');
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
export const CollabParticipantModel = TEST_CONNECTION.model('CollabParticipants', CollabParticipantSchema, 'CollabParticipants');
export const CollabBasketModel = TEST_CONNECTION.model('CollabBaskets', CollabBasketSchema, 'CollabBaskets');
export const WeeklyMVPRankingLeaderboardModel = TEST_CONNECTION.model('WeeklyMVPRankingData', WeeklyMVPRankingLeaderboardSchema, 'WeeklyMVPRankingData');
export const SuccessfulIndirectReferralModel = TEST_CONNECTION.model('SuccessfulIndirectReferrals', SuccessfulIndirectReferralSchema, 'SuccessfulIndirectReferrals');
export const ShopAssetModel = TEST_CONNECTION.model('ShopAssets', ShopAssetSchema, 'ShopAssets');
export const ShopAssetPurchaseModel = TEST_CONNECTION.model('ShopAssetPurchases', ShopAssetPurchaseSchema, 'ShopAssetPurchases');
export const CraftingQueueModel = TEST_CONNECTION.model('CraftingQueues', CraftingQueueSchema, 'CraftingQueues');
export const BanModel = TEST_CONNECTION.model('Bans', BanSchema, 'Bans');
export const MailModel = TEST_CONNECTION.model('Mails', MailSchema, 'Mails');
export const MailReceiverDataModel = TEST_CONNECTION.model('MailReceiverData', MailReceiverDataSchema, 'MailReceiverData');
export const ConsumedSynthesizingItemModel = TEST_CONNECTION.model('ConsumedSynthesizingItems', ConsumedSynthesizingItemSchema, 'ConsumedSynthesizingItems');
export const UserWonderspinDataModel = TEST_CONNECTION.model('UserWonderspinData', UserWonderspinDataSchema, 'UserWonderspinData');
export const WonderspinModel = TEST_CONNECTION.model('Wonderspins', WonderspinSchema, 'Wonderspins');
export const BitCosmeticModel = TEST_CONNECTION.model('BitCosmetics', BitCosmeticSchema, 'BitCosmetics');
export const WonderpassModel = TEST_CONNECTION.model('Wonderpasses', WonderpassSchema, 'Wonderpasses');
export const UserWonderpassDataModel = TEST_CONNECTION.model('UserWonderpassData', UserWonderpassDataSchema, 'UserWonderpassData');
export const ChatModel = TEST_CONNECTION.model('Chats', ChatSchema, 'Chats');
export const ChatroomModel = TEST_CONNECTION.model('Chatrooms', ChatroomSchema, 'Chatrooms');
export const FriendModel = TEST_CONNECTION.model('Friends', FriendSchema, 'Friends');
export const ReportModel = TEST_CONNECTION.model('Reports', ReportSchema, 'Reports');
export const CraftingRecipeModel = TEST_CONNECTION.model('CraftingRecipes', CraftingRecipeSchema, 'CraftingRecipes');
export const BitTraitDataModel = TEST_CONNECTION.model('BitTraitData', BitTraitDataSchema, 'BitTraitData');
export const UserBitCosmeticModel = TEST_CONNECTION.model('UserBitCosmetics', UserBitCosmeticSchema, 'UserBitCosmetics');
export const TradeListingModel = TEST_CONNECTION.model('TradeListings', TradeListingSchema, 'TradeListings');
