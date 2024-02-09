import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { UserSchema } from '../schemas/User';
import { ethers } from 'ethers';
import { createUserWallet } from '../utils/wallet';
import { createRaft } from './raft';
import { generateObjectId } from '../utils/crypto';

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 */
export const handleTwitterLogin = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const user = await User.findOne({ twitterId });

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

            // creates the wallet for the user
            const { privateKey, publicKey } = createUserWallet();

            const newUser = new User({
                _id: userObjectId,
                twitterId,
                wallet: {
                    privateKey,
                    publicKey
                },
                openedTweetIdsToday: [],
                inventory: {
                    xCookies: 0,
                    resources: [],
                    items: [],
                    foods: [],
                    raftId: data.raft.raftId,
                    islandIds: [],
                    bitIds: [],
                    totalBitOrbs: 0,
                    totalTerraCapsulators: 0
                }
            });

            await newUser.save();

            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) New user created.`,
                data: {
                    userId: newUser._id,
                    twitterId
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