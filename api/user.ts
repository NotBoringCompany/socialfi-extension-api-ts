
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
import { DailyLoginRewardData, DailyLoginRewardType } from '../models/user';
import { GET_DAILY_LOGIN_REWARDS } from '../utils/constants/user';
import { InviteCodeData, InviteCodeType } from '../models/invite';

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 * 
 * If users sign up, they are required to input an invite code (either from a starter code or a referral code).
 * Otherwise, they can't sign up.
 */
export const handleTwitterLogin = async (
    twitterId: string,
    starterCode: string | null,
    referralCode: string | null
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        let inviteCodeData: InviteCodeData | null = null;

        // if user doesn't exist, create a new user
        if (!user) {
            // if no invite code data, return an error.
            if (!starterCode && !referralCode) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(handleTwitterLogin) Invite code is required to sign up.`
                }
            }

            // if referral code is present, query the users collection to check if the referral code belongs to anybody.
            if (referralCode) {
                const users = await UserModel.find({}).lean();

                // find the referrer
                const referrer = users.find(u => u.referralCode.toLowerCase() === referralCode.toLowerCase());

                // if the referrer doesn't exist, return an error
                if (!referrer) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(handleTwitterLogin) Referral code does not exist.`
                    }
                }

                inviteCodeData = {
                    type: InviteCodeType.REFERRAL,
                    code: referralCode,
                    referrerId: referrer._id,
                    maxUses: 'infinite',
                    usedBy: []
                }
            } else if (starterCode) {
                // query the starter codes collection to check if the starter code exists
                const code = await StarterCodeModel.findOne({ code: starterCode.toUpperCase() }).lean();

                // if the starter code doesn't exist, return an error
                if (!code) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(handleTwitterLogin) Starter code does not exist.`
                    }
                }

                // if the starter code has reached its limit, return an error
                if (code.usedBy.length >= code.maxUses) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(handleTwitterLogin) Starter code has reached its limit.`
                    }
                }

                inviteCodeData = {
                    type: InviteCodeType.STARTER,
                    code: starterCode,
                    maxUses: code.maxUses,
                    usedBy: [
                        user._id,
                        ...code.usedBy
                    ]
                }
            }

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
                inviteCodeData,
                referralCode: generateReferralCode(),
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
    