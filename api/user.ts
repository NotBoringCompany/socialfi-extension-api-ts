
import { ReturnValue, Status } from '../utils/retVal';
import { createUserWallet } from '../utils/wallet';
import { createRaft } from './raft';
import { generateHashSalt, generateObjectId, generateReferralCode } from '../utils/crypto';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits } from '../utils/constants/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { LeaderboardModel, StarterCodeModel, UserModel } from '../utils/constants/db';
import { generateBarrenIsland } from './island';
import { POIName } from '../models/poi';
import { solidityKeccak256 } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import { ExtendedResource, ResourceType, SimplifiedResource } from '../models/resource';
import { resources } from '../utils/constants/resource';
import { BeginnerRewardData, BeginnerRewardType, DailyLoginRewardData, DailyLoginRewardType } from '../models/user';
import { GET_BEGINNER_REWARDS, GET_DAILY_LOGIN_REWARDS, MAX_BEGINNER_REWARD_DAY } from '../utils/constants/user';
import { InviteCodeData } from '../models/invite';

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 * 
 * If users sign up, they are required to input an invite code (either from a starter code or a referral code).
 * Otherwise, they can't sign up.
 */
export const handleTwitterLogin = async (
    twitterId: string,
    // the user's twitter profile picture
    twitterProfilePicture: string,
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        // if user doesn't exist, create a new user
        if (!user) {
            // generates a new object id for the user
            const userObjectId = generateObjectId();

            // creates a new raft for the user with the generated user object id
            const { status, message, data } = await createRaft(userObjectId);

            if (status !== Status.SUCCESS) {
                return {
                    status,
                    message: `(handleTwitterLogin) Error from createRaft: ${message}`
                }
            }

            // get the latest bit ID from the database
            const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();

            if (bitIdStatus !== Status.SUCCESS) {
                return {
                    status: bitIdStatus,
                    message: `(handleTwitterLogin) Error from getLatestBitId: ${bitIdMessage}`
                }
            }

            // randomize bit rarity; follows the same rarity as when obtaining a bit from a bit orb
            const rarity = RANDOMIZE_RARITY_FROM_ORB();

            const traits = randomizeBitTraits(rarity);

            const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map(trait => trait.trait));

            // add a free bit to the user's inventory (users get 1 for free when they sign up)
            const { status: bitStatus, message: bitMessage, data: bitData } = await addBitToDatabase({
                bitId: bitIdData?.latestBitId + 1,
                rarity,
                gender: RANDOMIZE_GENDER(),
                premium: false, // free bit, so not premium
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                placedIslandId: 0,
                lastRelocationTimestamp: 0,
                currentFarmingLevel: 1, // starts at level 1
                traits,
                farmingStats: randomizeFarmingStats(rarity), // although free bits don't use farming stats, we still need to randomize it just in case for future events
                bitStatsModifiers
            });

            if (bitStatus !== Status.SUCCESS) {
                return {
                    status: bitStatus,
                    message: `(handleTwitterLogin) Error from addBitToDatabase: ${bitMessage}`
                }
            }

            // creates a new barren island for the user for free as well
            const { status: islandStatus, message: islandMessage, data: islandData } = await generateBarrenIsland(userObjectId, ObtainMethod.SIGN_UP);

            if (islandStatus !== Status.SUCCESS) {
                return {
                    status: islandStatus,
                    message: `(handleTwitterLogin) Error from createBarrenIsland: ${islandMessage}`
                }
            }

            // creates the wallet for the user
            const { privateKey, publicKey } = createUserWallet();

            const newUser = new UserModel({
                _id: userObjectId,
                twitterId,
                twitterProfilePicture,
                createdTimestamp: Math.floor(Date.now() / 1000),
                // invite code data will be null until users input their invite code.
                inviteCodeData: {
                    usedStarterCode: null,
                    usedReferralCode: null,
                    referrerId: null
                },
                referralData: {
                    referralCode: generateReferralCode(),
                    referredUsers: []
                },
                wallet: {
                    privateKey,
                    publicKey
                },
                secondaryWallets: [],
                openedTweetIdsToday: [],
                inventory: {
                    weight: 0,
                    maxWeight: 200,
                    xCookies: 0,
                    cookieCrumbs: 0,
                    resources: [],
                    items: [],
                    foods: [],
                    raftId: data.raft.raftId,
                    // add the free barren island to the `islandIds` array
                    islandIds: [islandData.island.islandId],
                    bitIds: [bitIdData?.latestBitId + 1],
                    totalBitOrbs: 0,
                    totalTerraCapsulators: 0
                },
                inGameData: {
                    level: 1,
                    beginnerRewardData: {
                        lastClaimedTimestamp: 0,
                        isClaimable: true,
                        daysClaimed: [],
                        daysMissed: []
                    },
                    dailyLoginRewardData: {
                        lastClaimedTimestamp: 0,
                        isDailyClaimable: true,
                        consecutiveDaysClaimed: 0
                    },
                    location: POIName.HOME,
                    travellingTo: null,
                    destinationArrival: 0
                }
            });

            await newUser.save();

            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) New user created and free Rafting Bit added to raft.`,
                data: {
                    userId: newUser._id,
                    twitterId,
                }
            }
        } else {
            console.log('user found. user id: ', user._id);

            // user exists, return
            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) User found. Logging in.`,
                data: {
                    userId: user._id,
                    twitterId
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handleTwitterLogin) ${err.message}`
        }
    }
}

/**
 * Fetches the user's inventory.
 */
export const getInventory = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getInventory) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getInventory) Inventory fetched.`,
            data: {
                inventory: user.inventory
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getInventory) ${err.message}`
        }
    }
}

/**
 * Fetches the user's wallet private and public keys.
 */
export const getWalletDetails = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getWalletDetails) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getWalletDetails) Wallet details fetched.`,
            data: {
                privateKey: user.wallet.privateKey,
                publicKey: user.wallet.publicKey
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getWalletDetails) ${err.message}`
        }
    }
}

/**
 * Gets the user's in-game data.
 */
export const getInGameData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getInGameData) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getInGameData) In-game data fetched.`,
            data: {
                inGameData: user.inGameData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getInGameData) ${err.message}`
        }
    }
}

/**
 * Generates a message when users want to link a secondary wallet to their account.
 * 
 * The message will follow this format:
 * `Please sign the following message to link this wallet as a secondary wallet to your account.
 * 
 * Wallet address: <walletAddress>
 * 
 * Timestamp: <timestamp>
 * 
 * Hash salt: <hashSalt>`
 * 
 * The message will then be sent to the frontend for the user to sign with their secondary wallet.
 */
export const generateSignatureMessage = (walletAddress: string): string => {
    const timestamp = Math.floor(Date.now() / 1000);
    const hashSalt = generateHashSalt();

    const message = `
    Please sign the following message to link this wallet as a secondary wallet to your account.
    Wallet address: ${walletAddress}
    Timestamp: ${timestamp}
    Hash salt: ${hashSalt}
    `;

    return message;
}

/**
 * Links a secondary wallet to the user's account if signature check is valid.
 */
export const linkSecondaryWallet = async (
    twitterId: string,
    walletAddress: string,
    signatureMessage: string,
    signature: string
): Promise<ReturnValue> => {
    try {
        // get the eth signed message hash
        const ethSignedMessageHash = ethers.utils.arrayify(signatureMessage);

        // recover the address
        const recoveredAddress = ethers.utils.recoverAddress(ethSignedMessageHash, signature);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkSecondaryWallet) Invalid signature.`
            }
        }

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(linkSecondaryWallet) User not found.`
            }
        }

        // check if the wallet is already linked in the user's `secondaryWallets`
        // each secondaryWallet instance in `secondaryWallets` contain the `publicKey`.
        // check if the `publicKey` is the same as the `walletAddress`
        const isWalletAlreadyLinked = user.secondaryWallets?.some(wallet => wallet.publicKey.toLowerCase() === walletAddress.toLowerCase());

        if (isWalletAlreadyLinked) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkSecondaryWallet) Wallet is already linked.`
            }
        }

        // add the secondary wallet to the user's account
        await UserModel.updateOne({ twitterId }, {
            $push: {
                secondaryWallets: {
                    signatureMessage,
                    signature,
                    publicKey: walletAddress
                }
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(linkSecondaryWallet) Secondary wallet linked.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(linkSecondaryWallet) ${err.message}`
        }
    }
}

/**
 * Gets a user's main and secondary wallets linked to their account.
 */
export const getWallets = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getWallets) User not found.`
            }
        }

        const walletAddresses: string[] = [];

        // add the main wallet's public key
        walletAddresses.push(user.wallet.publicKey);

        // loop through `secondaryWallets` assuming length is not 0 and add each public key
        if (user.secondaryWallets.length > 0) {
            for (const secondaryWallet of user.secondaryWallets) {
                walletAddresses.push(secondaryWallet.publicKey);
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getWallets) Wallets fetched.`,
            data: {
                walletAddresses
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getWallets) ${err.message}`
        }
    }
}

/**
 * (User) Manually removes a specific amount of resources that the user owns.
 */
export const removeResources = async (twitterId: string, resourcesToRemove: SimplifiedResource[]): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(removeResources) User not found.`
            }
        }

        const userResources = user.inventory.resources as ExtendedResource[];

        if (userResources.length === 0) {
            return {
                status: Status.BAD_REQUEST,
                message: `(removeResources) User has no resources.`
            }
        }

        // cumulative inventory weight to reduce after removing resources
        let weightToReduce: number = 0;

        // for each resource specified in `resources` (which is the resources the user wants to remove)
        // check if the user has enough of that resource
        for (const resource of resourcesToRemove) {
            const userResource = userResources.find(r => r.type === resource.type);

            if (!userResource) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(removeResources) User does not have enough of this resource to remove: ${resource.type}.`
                }
            }

            if (userResource.amount < resource.amount) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(removeResources) User does not have enough of this resource to remove: ${resource.type}.`
                }
            }

            // get the index of the resource in the user's inventory
            const resourceIndex = userResources.findIndex(r => r.type === resource.type);

            // if the amount to remove is the same as the amount the user has, remove the resource entirely
            // otherwise, reduce the amount of the resource
            if (userResource.amount === resource.amount) {
                userUpdateOperations.$pull['inventory.resources'] = {
                    type: resource.type
                }
            } else {
                userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -resource.amount;
            }

            // calculate the total weight to reduce by looping through `resources` and getting the weight of each resource
            const { weight } = resources.find(r => r.type === resource.type);

            const totalWeight = weight * resource.amount;

            weightToReduce += totalWeight;
        }

        // reduce the user's inventory weight
        userUpdateOperations.$inc['inventory.weight'] = -weightToReduce;

        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(removeResources) Resources removed.`,
            data: {
                resourcesToRemove
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeResources) ${err.message}`
        }
    }
}

/**
 * (User) Claims the daily rewards.
 * 
 * As daily rewards can contain leaderboard points, optionally specify the leaderboard name to add the points to.
 * If no leaderboard name is specified, the points will be added to the newest leaderboard.
 */
export const claimDailyRewards = async (
    twitterId: string,
    leaderboardName: string | null
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        const leaderboardUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimDailyRewards) User not found.`
            }
        }

        const leaderboard = leaderboardName === null ?
            await LeaderboardModel.findOne().sort({ startTimestamp: -1 }) :
            await LeaderboardModel.findOne({ name: leaderboardName });

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(claimDailyRewards) Leaderboard not found.`
            }
        }


        // get the user's daily login reward data
        const dailyLoginRewardData = user.inGameData.dailyLoginRewardData as DailyLoginRewardData;

        // we don't have to check if it's a new day since a scheduler will change `isDailyClaimable` to true every day at 00:00 UTC.
        // so, we just check if `isDailyClaimable` is true. if not, return an error
        if (!dailyLoginRewardData.isDailyClaimable) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimDailyRewards) Daily rewards already claimed today.`
            }
        }

        // get the user's consecutive days claimed
        const consecutiveDaysClaimed = dailyLoginRewardData.consecutiveDaysClaimed;

        // get the daily login rewards based on the consecutive days claimed
        const dailyLoginRewards = GET_DAILY_LOGIN_REWARDS(consecutiveDaysClaimed);

        // 1. add the rewards to the user's inventory
        // 2. increment the user's `consecutiveDaysClaimed` by 1
        // 3. set `isDailyClaimable` to false
        // 4. set `lastClaimedTimestamp` to the current timestamp
        for (const reward of dailyLoginRewards) {
            if (reward.type === DailyLoginRewardType.X_COOKIES) {
                userUpdateOperations.$inc['inventory.xCookies'] = reward.amount;
            } else if (reward.type === DailyLoginRewardType.LEADERBOARD_POINTS) {
                // add the points to the leaderboard
                // get the index of the user in the leaderboard's `userData` array
                const userIndex = leaderboard.userData.findIndex(userData => userData.userId === user._id);

                // if the user is not found in the leaderboard, add them
                if (userIndex === -1) {
                    leaderboardUpdateOperations.$push['userData'] = {
                        userId: user._id,
                        twitterProfilePicture: user.twitterProfilePicture,
                        points: reward.amount
                    }
                } else {
                    leaderboardUpdateOperations.$inc[`userData.${userIndex}.points`] = reward.amount;
                }
                // if the reward is not xCookies or leaderboard points, return an error (for now)
            } else {
                return {
                    status: Status.ERROR,
                    message: `(claimDailyRewards) Invalid reward type.`
                }
            }
        }

        // increment the user's `consecutiveDaysClaimed` by 1
        userUpdateOperations.$inc['inGameData.dailyLoginRewardData.consecutiveDaysClaimed'] = 1;

        // set `isDailyClaimable` to false
        userUpdateOperations.$set['inGameData.dailyLoginRewardData.isDailyClaimable'] = false;

        // set `lastClaimedTimestamp` to the current timestamp
        userUpdateOperations.$set['inGameData.dailyLoginRewardData.lastClaimedTimestamp'] = Math.floor(Date.now() / 1000);

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            LeaderboardModel.updateOne({ _id: leaderboard._id }, leaderboardUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(claimDailyRewards) Daily rewards claimed.`,
            data: {
                dailyLoginRewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimDailyRewards) ${err.message}`
        }
    }
}

/**
 * Updates all users' daily login reward data.
 * This includes:
 * 
 * 1. resetting `isDailyClaimable` to true every day at 00:00 UTC.
 * 2. resetting `consecutiveDaysClaimed` to 0 if the user doesn't claim the reward for the day.
 */
export const updateDailyLoginRewardsData = async (): Promise<void> => {
    try {
        // fetch all users
        const users = await UserModel.find().lean();

        // users who have `isDailyClaimable` = false means they already claimed their rewards.
        // in this case, set `isDailyClaimable` back to true.
        // users who have `isDailyClaimable` = true means they haven't claimed their daily rewards.
        // in this case, reset `consecutiveDaysClaimed` to 0.
        const userUpdateOperations: Array<{
            userId: string,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }> = [];

        for (const user of users) {
            const dailyLoginRewardData = user.inGameData.dailyLoginRewardData as DailyLoginRewardData;

            if (!dailyLoginRewardData.isDailyClaimable) {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.dailyLoginRewardData.isDailyClaimable': true
                        },
                        $inc: {},
                        $pull: {},
                        $push: {}
                    }
                });
            } else {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.dailyLoginRewardData.consecutiveDaysClaimed': 0
                        },
                        $inc: {},
                        $pull: {},
                        $push: {}
                    }
                });
            }
        }

        // execute the update operations
        const userUpdatePromises = userUpdateOperations.map(async op => {
            return UserModel.updateOne({ _id: op.userId }, op.updateOperations);
        });
        
        await Promise.all(userUpdatePromises);

        console.log('Daily login rewards data updated.');
    } catch (err: any) {
        console.error('Error in updateDailyLoginRewardsData:', err.message);
    }
}

/**
 * Links either a starter or a referral code to play the game (i.e. invite code).
 * 
 * The current version only allows users to input EITHER, not both.
 */
export const linkInviteCode = async (
    twitterId: string,
    code: string
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(linkInviteCode) User not found.`
            }
        }

        // check if the code is a starter code or a referral code
        const starterCode = await StarterCodeModel.findOne({ code: code.toUpperCase() }).lean();
        const referralCode = await UserModel.findOne({ referralCode: code.toUpperCase() }).lean();

        if (!starterCode && !referralCode) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkInviteCode) Invalid code.`
            }
        }

        // if the code is a starter code
        if (starterCode) {
            // check if the user already has a starter code.
            // if they do, return an error.
            if (user.inviteCodeData.usedStarterCode) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) User already used a starter code.`
                }
            }

            // update the user's starter code data
            await UserModel.updateOne({ twitterId }, {
                $set: {
                    'inviteCodeData.usedStarterCode': code.toUpperCase()
                }
            });

            return {
                status: Status.SUCCESS,
                message: `(linkInviteCode) Starter code linked.`,
            }
        } else if (referralCode) {
            // check if the user already has a referral code.
            // if they do, return an error.
            if (user.inviteCodeData.usedReferralCode) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) User already used a referral code.`
                }
            }

            // update the user's referral code data
            await UserModel.updateOne({ twitterId }, {
                $set: {
                    'inviteCodeData.usedReferralCode': code.toUpperCase(),
                    'inviteCodeData.referrerId': referralCode._id
                }
            });

            // also update the referrer's code data to include the referee's id in the `referredUsers` array
            await UserModel.updateOne({ _id: referralCode._id }, {
                $push: {
                    'referralData.referredUsers': user._id
                }
            });

            return {
                status: Status.SUCCESS,
                message: `(linkInviteCode) Referral code linked.`,
            }
        } else {
            return {
                status: Status.ERROR,
                message: `(linkInviteCode) Code not found.`
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(linkInviteCode) ${err.message}`
        }
    }
}

/**
 * Checks if the user has a starter or referral code (i.e. invite code) linked.
 * 
 * One must exist to be allowed to play the game.
 */
export const checkInviteCodeLinked = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkInviteCodeLinked) User not found.`
            }
        }

        if (!user.inviteCodeData.usedStarterCode && !user.inviteCodeData.usedReferralCode) {
            return {
                status: Status.BAD_REQUEST,
                message: `(checkInviteCodeLinked) No starter or referral code linked.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(checkInviteCodeLinked) User has an invite code.`,
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkInviteCodeLinked) ${err.message}`
        }
    }
}

/**
 * Fetches the user's beginner rewards data.
 */
export const getBeginnerRewardsData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getBeginnerRewardsData) User not found.`
            }
        }

        const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;

        return {
            status: Status.SUCCESS,
            message: `(getBeginnerRewardsData) Beginner rewards data fetched.`,
            data: {
                beginnerRewardData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getBeginnerRewardsData) ${err.message}`
        }
    }
}
/**
 * Claims the beginner rewards for the user for a particular day.
 */
export const claimBeginnerRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimBeginnerRewards) User not found.`
            }
        }

        // get the user's beginner reward data
        const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;

        // check for beginner reward eligiblity
        const isEligible = beginnerRewardData.daysClaimed.length + beginnerRewardData.daysMissed.length < 7;

        if (!isEligible) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimBeginnerRewards) User is not eligible for beginner rewards.`
            }
        }

        // get the latest day from both arrays
        // e.g: if daysClaimed is [1, 3, 4] and daysMissed is [2, 5], then get 5
        const latestClaimedDay = beginnerRewardData.daysClaimed.length > 0 ? Math.max(...beginnerRewardData.daysClaimed) : 0;
        const latestMissedDay = beginnerRewardData.daysMissed.length > 0 ? Math.max(...beginnerRewardData.daysMissed) : 0;

        // get the next day to claim
        const nextDayToClaim = Math.max(latestClaimedDay, latestMissedDay) + 1;

        // if the user has already claimed the rewards for the day, return an error
        if (!beginnerRewardData.isClaimable) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimBeginnerRewards) Rewards already claimed for the day.`
            }
        }

        // get the beginner rewards for the day
        const rewards = GET_BEGINNER_REWARDS(nextDayToClaim);

        // 1. add the rewards to the user's inventory
        // 2. set `isClaimable` to false
        // 3. set `lastClaimedTimestamp` to now
        // 4. add the day to `daysClaimed`
        for (const reward of rewards) {
            if (reward.type === BeginnerRewardType.X_COOKIES) {
                userUpdateOperations.$inc['inventory.xCookies'] = reward.amount;
            } else if (reward.type === BeginnerRewardType.BIT_ORB) {
                userUpdateOperations.$inc['inventory.totalBitOrbs'] = reward.amount;
            } else if (reward.type === BeginnerRewardType.TERRA_CAPSULATOR) {
                userUpdateOperations.$inc['inventory.totalTerraCapsulators'] = reward.amount;
            }
        }
        userUpdateOperations.$set['inGameData.beginnerRewardData.isClaimable'] = false;
        userUpdateOperations.$set['inGameData.beginnerRewardData.lastClaimedTimestamp'] = Math.floor(Date.now() / 1000);
        userUpdateOperations.$push['inGameData.beginnerRewardData.daysClaimed'] = nextDayToClaim;

        // execute the update operations
        await UserModel.updateOne({twitterId}, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(claimBeginnerRewards) Beginner rewards claimed for day ${nextDayToClaim}.`,
            data: {
                rewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimBeginnerRewards) ${err.message}`
        }
    }
}

/**
 * Updates all users' beginner reward data daily. Called by a scheduler every 00:00 UTC.
 * 
 * This includes:
 * 1. only updating users whose `daysMissed` + `daysClaimed` < MAX_BEGINNER_REWARD_DAY.
 * 2. resetting `isClaimable` to true every day at 00:00 UTC.
 * 3. add the current day to the user's `daysMissed` if they don't claim the rewards for the day (i.e. `isClaimable` is still true).
 */
export const updateBeginnerRewardsData = async (): Promise<void> => {
    try {
        const users = await UserModel.find().lean();

        // filter out users who are not eligible for beginner rewards
        const eligibleUsers = users.filter(user => {
            const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;
            return beginnerRewardData.daysClaimed.length + beginnerRewardData.daysMissed.length < MAX_BEGINNER_REWARD_DAY;
        });

        const userUpdateOperations: Array<{
            userId: string,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }> = [];

        for (const user of eligibleUsers) {
            const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;

            // for users that have `isClaimable` as false, it means they claimed the rewards already.
            // simply convert `isClaimable` to true.
            if (!beginnerRewardData.isClaimable) {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.beginnerRewardData.isClaimable': true
                        },
                        $inc: {},
                        $pull: {},
                        $push: {}
                    }
                });
            } else {
                // if `isClaimable` is true, it means the user missed claiming the rewards for the day.
                // add the current day to `daysMissed`.
                const latestDay = Math.max(...beginnerRewardData.daysClaimed, ...beginnerRewardData.daysMissed);
                
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $push: {
                            'inGameData.beginnerRewardData.daysMissed': latestDay + 1
                        },
                        $inc: {},
                        $set: {},
                        $pull: {}
                    }
                });
            }
        }

        // execute the update operations
        const userUpdatePromises = userUpdateOperations.map(async op => {
            return UserModel.updateOne({ _id: op.userId }, op.updateOperations);
        });

        await Promise.all(userUpdatePromises);
    } catch (err: any) {
        console.error('Error in updateBeginnerRewardsData:', err.message);
    }
}