import { convertToBytes32 } from '../web3';

// a list of mixpanel events in bytes32 format to be tracked on-chain using a more economical bytes32 => uint256 mapping.
export const RENAME_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Rename Bit');
export const RELEASE_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Release Bit');
export const EVOLVE_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Evolve Bit');
export const FEED_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Feed Bit');
export const CONSUME_BIT_ORB_MIXPANEL_EVENT_HASH = convertToBytes32('Consume Bit Orb');
export const OPEN_CHEST_MIXPANEL_EVENT_HASH = convertToBytes32('Open Chest');
export const PLACE_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Place Bit');
export const UNPLACE_BIT_MIXPANEL_EVENT_HASH = convertToBytes32('Unplace Bit');
export const EVOLVE_ISLAND_MIXPANEL_EVENT_HASH = convertToBytes32('Evolve Island');
export const REMOVE_ISLAND_MIXPANEL_EVENT_HASH = convertToBytes32('Remove Island');
export const CLAIM_RESOURCES_MIXPANEL_EVENT_HASH = convertToBytes32('Claim Resources');
export const APPLY_GATHERING_BOOSTER_MIXPANEL_EVENT_HASH = convertToBytes32('Apply Gathering Booster');
export const REDEEM_POAP_MIXPANEL_EVENT_HASH = convertToBytes32('Redeem POAP');
export const TRAVEL_TO_POI_MIXPANEL_EVENT_HASH = convertToBytes32('Travel to POI');
export const APPLY_TRAVELLING_BOOSTER_MIXPANEL_EVENT_HASH = convertToBytes32('Apply Travelling Booster');
export const BUY_ITEMS_IN_POI_SHOP_MIXPANEL_EVENT_HASH = convertToBytes32('Buy Items in POI Shop');
export const SELL_ITEMS_IN_POI_SHOP_MIXPANEL_EVENT_HASH = convertToBytes32('Sell Items in POI Shop');
export const EVOLVE_RAFT_MIXPANEL_EVENT_HASH = convertToBytes32('Evolve Raft');
export const PURCHASE_SHOP_ASSET_MIXPANEL_EVENT_HASH = convertToBytes32('Purchase Shop Asset');
export const COMPLETE_QUEST_MIXPANEL_EVENT_HASH = convertToBytes32('Complete Quest');
export const RENAME_SQUAD_MIXPANEL_EVENT_HASH = convertToBytes32('Rename Squad');
export const JOIN_SQUAD_MIXPANEL_EVENT_HASH = convertToBytes32('Join Squad');
export const LEAVE_SQUAD_MIXPANEL_EVENT_HASH = convertToBytes32('Leave Squad');
export const KICK_SQUAD_MEMBER_MIXPANEL_EVENT_HASH = convertToBytes32('Kick Squad Member');
export const CREATE_SQUAD_MIXPANEL_EVENT_HASH = convertToBytes32('Create Squad');
export const GET_CURRENT_USER_SQUAD_MIXPANEL_EVENT_HASH = convertToBytes32('Get Current User Squad');
export const CONSUME_TERRA_CAPSULATOR_MIXPANEL_EVENT_HASH = convertToBytes32('Consume Terra Capsulator');
export const REMOVE_RESOURCES_MIXPANEL_EVENT_HASH = convertToBytes32('Remove Resources');
export const CLAIM_DAILY_REWARDS_MIXPANEL_EVENT_HASH = convertToBytes32('Claim Daily Rewards');
export const LINK_INVITE_CODE_MIXPANEL_EVENT_HASH = convertToBytes32('Link Invite Code');
export const CLAIM_BEGINNER_REWARDS_MIXPANEL_EVENT_HASH = convertToBytes32('Claim Beginner Rewards');
export const CONNECT_DISCORD_CALLBACK_MIXPANEL_EVENT_HASH = convertToBytes32('Connect Discord Callback');
export const DISCONNECT_DISCORD_MIXPANEL_EVENT_HASH = convertToBytes32('Disconnect Discord');
export const TWITTER_LOGIN_CALLBACK_MIXPANEL_EVENT_HASH = convertToBytes32('Twitter Login Callback');
export const TUTORIAL_COMPLETED_MIXPANEL_EVENT_HASH = convertToBytes32('Tutorial Completed');