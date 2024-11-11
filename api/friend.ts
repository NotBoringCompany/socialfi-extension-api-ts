import { FriendStatus } from '../models/friend';
import { UserProfile } from '../models/user';
import { FriendModel, UserModel } from '../utils/constants/db';
import { MAX_FRIENDS_CAP } from '../utils/constants/user';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { getUserProfile } from './user';

/**
 * Gets user's friends.
 */
export const getFriends = async (twitterId: string): Promise<ReturnValue<{ friends: UserProfile[] }>> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getFriends) User not found.`,
            };
        }

        const friendships = await FriendModel.find({
            $or: [{ userId1: user._id }, { userId2: user._id }],
            status: FriendStatus.ACCEPTED,
        });

        // extract and return the friend's user IDs
        const friendIds = friendships.map((friend) => (friend.userId1 === user._id ? friend.userId2 : friend.userId1));

        // retrieve the user details of each friend
        const results = await UserModel.find({ _id: { $in: friendIds } });

        // parse the data to get ranking data
        const friends = await Promise.all(
            results.map(async (user) => {
                const { data } = await getUserProfile(user.twitterId);

                return data.profile;
            })
        );

        return {
            status: Status.SUCCESS,
            message: '(getFriends) Successfully retrieved friends',
            data: {
                friends: friends as UserProfile[],
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getFriends) Error: ${err.message}`,
        };
    }
};

/**
 * Gets user's friend request.
 */
export const getFriendRequests = async (userId: string): Promise<ReturnValue<{ requests: UserProfile[] }>> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getFriendRequests) User not found.`,
            };
        }

        // find pending friend requests where the user is the recipient
        const pendingRequests = await FriendModel.find({
            userId2: user._id,
            status: FriendStatus.PENDING,
        });

        // extract the user IDs of the friend request senders
        const requesterIds = pendingRequests.map((request) => request.userId1);

        // retrieve the user details of each requester
        const requesters = await UserModel.find({ _id: { $in: requesterIds } });

        // parse the data to get ranking data
        const requests = await Promise.all(
            requesters.map(async (user) => {
                const { data } = await getUserProfile(user.twitterId);

                return data.profile;
            })
        );

        return {
            status: Status.SUCCESS,
            message: '(getFriendRequests) Successfully retrieved friend requests.',
            data: {
                requests,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getFriendRequests) Error: ${err.message}`,
        };
    }
};

/**
 * Send friend request
 * @param userId twitterId of the person who requested the friend request
 * @param friendId twitterId of the person who received the friend request
 */
export const sendFriendRequest = async (userId: string, friendId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: '(sendFriendRequest) User not found.',
            };
        }

        const friend = await UserModel.findOne({ twitterId: friendId });
        if (!friend) {
            return {
                status: Status.ERROR,
                message: '(sendFriendRequest) Friend not found.',
            };
        }

        // Check if the user is attempting to send a friend request to themselves
        if (friend.twitterId === user.twitterId) {
            return {
                status: Status.ERROR,
                message: '(sendFriendRequest) You cannot send a friend request to yourself.',
            };
        }

        // fetch existing friendship data
        const existingFriendship = await FriendModel.findOne({
            $or: [
                { userId1: user._id, userId2: friend._id },
                { userId1: friend._id, userId2: user._id },
            ],
        });

        // if exsitingFriendship found, check if status is rejected or not. if Rejected, simply set the status into Pending. else throw error
        if (existingFriendship) {
            if (existingFriendship.status === FriendStatus.REJECTED) {
                existingFriendship.status = FriendStatus.PENDING;
                await existingFriendship.save();
            } else {
                return {
                    status: Status.ERROR,
                    message: '(sendFriendRequest) Friendship or pending request already exists.',
                };
            }
        } else {
            // create a new friend request with PENDING status
            await FriendModel.create({
                _id: generateObjectId(),
                userId1: user._id,
                userId2: friend._id,
                status: FriendStatus.PENDING,
            });
        }

        return {
            status: Status.SUCCESS,
            message: '(sendFriendRequest) Friend request sent successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(sendFriendRequest) Error: ${err.message}`,
        };
    }
};

/**
 * Accept friend request
 * @param userId twitterId of the person who received the friend request
 * @param friendId twitterId of the person who requested the friend request
 */
export const acceptFriendRequest = async (userId: string, friendId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: '(acceptFriendRequest) User not found.',
            };
        }

        const friend = await UserModel.findOne({ twitterId: friendId });
        if (!friend) {
            return {
                status: Status.ERROR,
                message: '(acceptFriendRequest) Friend not found.',
            };
        }

        // Check if user has reached the maximum friend cap
        const userFriendsCount = await FriendModel.countDocuments({
            $or: [
                { userId1: user._id, status: FriendStatus.ACCEPTED },
                { userId2: user._id, status: FriendStatus.ACCEPTED }
            ],
        });
        if (userFriendsCount >= MAX_FRIENDS_CAP) {
            return {
                status: Status.ERROR,
                message: '(acceptFriendRequest) You have reached the maximum friend limit. Please remove some friends to add new ones.',
            };
        }        

        // find the pending friend request
        const friendRequest = await FriendModel.findOne({
            userId1: friend._id,
            userId2: user._id,
            status: FriendStatus.PENDING,
        });

        if (!friendRequest) {
            return {
                status: Status.ERROR,
                message: '(acceptFriendRequest) Friend request not found or already processed.',
            };
        }

        // update the status to ACCEPTED
        friendRequest.status = FriendStatus.ACCEPTED;
        await friendRequest.save();

        return {
            status: Status.SUCCESS,
            message: '(acceptFriendRequest) Friend request accepted successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(acceptFriendRequest) Error: ${err.message}`,
        };
    }
};

/**
 * Reject friend request
 * @param userId twitterId of the person who received the friend request
 * @param friendId twitterId of the person who requested the friend request
 */
export const rejectFriendRequest = async (userId: string, friendId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: '(rejectFriendRequest) User not found.',
            };
        }

        const friend = await UserModel.findOne({ twitterId: friendId });
        if (!friend) {
            return {
                status: Status.ERROR,
                message: '(rejectFriendRequest) Friend not found.',
            };
        }

        // find the pending friend request
        const friendRequest = await FriendModel.findOne({
            userId1: friend._id,
            userId2: user._id,
            status: FriendStatus.PENDING,
        });

        if (!friendRequest) {
            return {
                status: Status.ERROR,
                message: '(denyFriendRequest) Friend request not found or already processed.',
            };
        }

        // update the status to REJECTED
        friendRequest.status = FriendStatus.REJECTED;
        await friendRequest.save();

        return {
            status: Status.SUCCESS,
            message: '(rejectFriendRequest) Friend request rejected successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(rejectFriendRequest) Error: ${err.message}`,
        };
    }
};

/**
 * Cancel friend request
 * @param userId twitterId of the person who requested the friend request
 * @param friendId twitterId of the person who received the friend request
 */
export const cancelFriendRequest = async (userId: string, friendId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: '(cancelFriendRequest) User not found.',
            };
        }

        const friend = await UserModel.findOne({ twitterId: friendId });
        if (!friend) {
            return {
                status: Status.ERROR,
                message: '(cancelFriendRequest) Friend not found.',
            };
        }

        // find and delete the pending friend request sent by the user
        const result = await FriendModel.findOneAndDelete({
            userId1: user._id,
            userId2: friend._id,
            status: { $ne: FriendStatus.ACCEPTED },
        });

        if (!result) {
            return {
                status: Status.ERROR,
                message: '(cancelFriendRequest) Friend request not found or already processed.',
            };
        }

        return {
            status: Status.SUCCESS,
            message: '(cancelFriendRequest) Friend request canceled successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(cancelFriendRequest) Error: ${err.message}`,
        };
    }
};

/**
 * Cancel friend request
 * @param userId twitterId of the person who requested the friend request
 * @param friendId twitterId of the person who received the friend request
 */
export const deleteFriend = async (userId: string, friendId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: userId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: '(deleteFriend) User not found.',
            };
        }

        const friend = await UserModel.findOne({ twitterId: friendId });
        if (!friend) {
            return {
                status: Status.ERROR,
                message: '(deleteFriend) Friend not found.',
            };
        }

        // find and delete the accepted friendship between the two users
        const result = await FriendModel.findOneAndDelete({
            $or: [
                { userId1: user._id, userId2: friend._id, status: FriendStatus.ACCEPTED },
                { userId1: friend._id, userId2: user._id, status: FriendStatus.ACCEPTED },
            ],
        });

        if (!result) {
            return {
                status: Status.ERROR,
                message: '(deleteFriend) Friendship not found or already removed.',
            };
        }

        return {
            status: Status.SUCCESS,
            message: '(deleteFriend) Friend removed successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteFriend) Error: ${err.message}`,
        };
    }
};
