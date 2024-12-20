import mongoose from 'mongoose';
import { ChatModel, ChatroomModel, SquadModel, TEST_CONNECTION, UserModel } from '../utils/constants/db';
import { ChatroomType } from '../models/chat';
import { generateObjectId } from '../utils/crypto';
import { dayjs } from '../utils/dayjs';
import { ReturnValue, Status } from '../utils/retVal';
import { ChatMessageQuery } from '../validations/chat';

/**
 * Retrieves the chatrooms the user has participated in, or all available public channels
 */
export const getUserChatrooms = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserChatrooms) User not found.`,
            };
        }

        // find the chatroom that user participated to, or all the public channel that available
        const chatrooms = await ChatroomModel.find({
            $or: [{ 'participants.user': user._id }, { type: ChatroomType.PUBLIC }],
        })
            .populate('lastSender')
            .populate('participants.user')
            .populate('squad');

        return {
            status: Status.SUCCESS,
            message: `(getUserChatrooms) Chatrooms fetched.`,
            data: {
                chatrooms,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserChatrooms) ${err.message}`,
        };
    }
};

/**
 * Retrieves the chat messages from the specified chatroom.
 */
export const getChatMessages = async (query: ChatMessageQuery): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId: query.user });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserChatrooms) User not found.`,
            };
        }

        // user's participated chatroom
        const chatrooms = await ChatroomModel.find({ 'participants.user': user._id }).lean();

        // check if the chatrooms empty or didn't exist in the list
        if (!chatrooms || (query.chatroom && !chatrooms.find(({ _id }) => _id === query.chatroom))) {
            return {
                status: Status.SUCCESS,
                message: `(getChatroomChatrooms) Chat messages fetched.`,
                data: {
                    chats: [],
                },
            };
        }

        const chatQuery = ChatModel.find();

        if (query.startTimestamp) {
            chatQuery.where('createdTimestamp').gte(Number(query.startTimestamp));
        }

        if (query.endTimestamp) {
            chatQuery.where('createdTimestamp').lte(Number(query.endTimestamp));
        }

        if (query.chatroom) {
            chatQuery.where('chatroom').equals(query.chatroom);
        }

        const chats = await chatQuery
            .sort({ createdTimestamp: 1 })
            .populate('sender')
            .limit(Number(query.limit))
            .exec();

        return {
            status: Status.SUCCESS,
            message: `(getChatroomChatrooms) Chat messages fetched.`,
            data: {
                chats,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getChatroomChatrooms) ${err.message}`,
        };
    }
};

/**
 * Sends a message to a chatroom.
 */
export const sendMessage = async (senderId: string, chatroomId: string, message: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ twitterId: senderId }, { _id: senderId }] });
        if (!user) {
            throw new Error('User not found.');
        }

        const chatroom = await ChatroomModel.findById(chatroomId);
        if (!chatroom) {
            throw new Error('Chatroom not found.');
        }

        const participant = chatroom.participants.find((participant) => participant.user.toString() === user._id);

        if (!participant) throw new Error(`You're not a participant in this chatroom.`);

        const currentTimestamp = dayjs().unix();
        const isMuted = participant.mutedUntilTimestamp && participant.mutedUntilTimestamp > currentTimestamp;

        if (isMuted) throw new Error(`You're muted`);

        // create a new chat messsage
        const chats = await ChatModel.create(
            [
                {
                    _id: generateObjectId(),
                    chatroom: chatroom._id,
                    receiver: null,
                    sender: user._id,
                    createdTimestamp: currentTimestamp,
                    message,
                },
            ],
            { session }
        );

        // check if the chat message have been created
        if (!chats) {
            throw new Error('Failed to send the message.');
        }

        // cached the last message information in the chatroom
        await chatroom.updateOne(
            {
                $inc: { messagesCount: 1 },
                $set: {
                    lastMessage: message,
                    lastSender: senderId,
                    lastMessageTimestamp: currentTimestamp,
                },
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const newChat = await ChatModel.findById(chats[0]._id).populate('sender');
        const newChatroom = await ChatroomModel.findById(chatroom._id)
            .populate('participants.user')
            .populate('lastSender');

        return {
            status: Status.SUCCESS,
            message: `(sendMessage) Message sent.`,
            data: {
                chat: newChat,
                chatroom: newChatroom,
            },
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(sendMessage) ${err.message}`,
        };
    }
};

/**
 * Sends a direct message from the sender to the receiver.
 */
export const sendDirectMessage = async (
    senderId: string,
    receiverId: string,
    message: string
): Promise<ReturnValue> => {
    try {
        let chatroom = await ChatroomModel.findOne({
            participants: {
                $all: [{ $elemMatch: { user: senderId } }, { $elemMatch: { user: receiverId } }],
            },
            isGroup: false,
            type: 'private',
        });

        let isNew = false;
        const currentTimestamp = dayjs().unix();

        // create a new chatroom if the chatroom didn't exist
        if (!chatroom) {
            chatroom = await ChatroomModel.create({
                _id: generateObjectId(),
                name: 'Private Conversation',
                isGroup: false,
                type: 'private',
                participants: [
                    {
                        _id: generateObjectId(),
                        user: senderId,
                        joinedTimestamp: currentTimestamp,
                    },
                    {
                        _id: generateObjectId(),
                        user: receiverId,
                        joinedTimestamp: currentTimestamp,
                    },
                ],
                createdTimestamp: currentTimestamp,
            });

            isNew = true;
        }

        // return error if somehow the chatroom still empty after re-creating
        if (!chatroom) {
            throw new Error('Cannot create a chatroom.');
        }

        // create a new chat messsage
        const chat = await ChatModel.create({
            _id: generateObjectId(),
            chatroom: chatroom._id,
            receiver: receiverId,
            sender: senderId,
            createdTimestamp: currentTimestamp,
            message,
        });

        if (!chat) {
            throw new Error('Failed to send the message.');
        }

        // cached the last message information in the chatroom
        await chatroom.updateOne({
            $inc: { messagesCount: 1 },
            $set: {
                lastMessage: message,
                lastSender: senderId,
                lastMessageTimestamp: currentTimestamp,
            },
        });

        const newChat = await ChatModel.findById(chat._id).populate('sender');
        const newChatroom = await ChatroomModel.findById(chatroom._id)
            .populate('participants.user')
            .populate('lastSender');

        return {
            status: Status.SUCCESS,
            message: `(sendDirectMessage) Direct message sent.`,
            data: {
                chat: newChat,
                chatroom: newChatroom,
                isNew,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(sendDirectMessage) ${err.message}`,
        };
    }
};

/**
 * Allows the user to join the specified chatroom, adding them as a participant.
 */
export const joinChatroom = async (
    userId: string,
    chatroomId: string,
    allowPrivate: boolean = false
): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] });
        if (!user) {
            throw new Error('User not found.');
        }

        const chatroom = await ChatroomModel.findById(chatroomId);
        if (!chatroom) {
            throw new Error('Chatroom not found.');
        }

        // check if the chatroom was private
        if (!chatroom.isGroup || (chatroom.type === ChatroomType.PRIVATE && !allowPrivate)) {
            throw new Error(`You cannot join this chatroom.`);
        }

        // check if the user already participated in this chatroom
        if (chatroom.participants.find((participant) => participant.user === user._id)) {
            throw new Error(`You've already joined this chatroom.`);
        }

        // participated the user in the chatroom
        await chatroom.updateOne(
            {
                $push: {
                    participants: {
                        _id: generateObjectId(),
                        user: user._id,
                        joinedTimestamp: dayjs().unix(),
                    },
                },
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(joinChatroom) The user joined the chatroom successfully.`,
            data: {
                chatroom,
            },
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(joinChatroom) ${err.message}`,
        };
    }
};

/**
 * Allows the user to leave the specified chatroom, removing them from the participant list.
 */
export const leaveChatroom = async (twitterId: string, chatroomId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            throw new Error('User not found.');
        }

        const chatroom = await ChatroomModel.findById(chatroomId);
        if (!chatroom) {
            throw new Error('Chatroom not found.');
        }

        // check if the chatroom was public
        if (!chatroom.isGroup || chatroom.type === ChatroomType.PRIVATE) {
            throw new Error(`You cannot leave the chatroom.`);
        }

        // check if the user already participated in this chatroom
        if (!chatroom.participants.find((participant) => participant.user === user._id)) {
            throw new Error(`You didn't joined this chatroom.`);
        }

        // remove the user from the participant list
        await chatroom.updateOne(
            {
                $pull: { participants: { user: user._id } },
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(leaveChatroom) The user leave the chatroom successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(leaveChatroom) ${err.message}`,
        };
    }
};

/**
 * Bulk creates chatrooms for all registered squads.
 */
export const bulkCreateFromSquad = async (): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const squads = await SquadModel.find().lean();

        for (const squad of squads) {
            await ChatroomModel.create(
                [
                    {
                        _id: generateObjectId(),
                        name: squad.name,
                        isGroup: true,
                        type: ChatroomType.SQUAD,
                        participants: squad.members.map((member) => ({
                            _id: generateObjectId(),
                            user: member.userId,
                            joinedTimestamp: member.joinedTimestamp,
                        })),
                        squad: squad._id,
                        createdTimestamp: squad.formedTimestamp,
                    },
                ],
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(bulkCreateFromSquad) Operations executed successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(bulkCreateFromSquad) ${err.message}`,
        };
    }
};

/**
 * Create squad chatroom.
 */
export const createSquadChatroom = async (squadId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const squad = await SquadModel.findById(squadId);

        if (!squad) throw new Error('Squad not found');

        await ChatroomModel.create(
            [
                {
                    _id: generateObjectId(),
                    name: squad.name,
                    isGroup: true,
                    type: ChatroomType.SQUAD,
                    participants: squad.members.map((member) => ({
                        _id: generateObjectId(),
                        user: member.userId,
                        joinedTimestamp: member.joinedTimestamp,
                    })),
                    squad: squad._id,
                    createdTimestamp: squad.formedTimestamp,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(createSquadChatroom) Chatroom created successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(createSquadChatroom) ${err.message}`,
        };
    }
};

/**
 * Remove squad chatroom.
 */
export const removeSquadChatroom = async (squadId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        await ChatroomModel.deleteOne({
            squad: squadId,
        });

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(removeSquadChatroom) Chatroom deleted successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(removeSquadChatroom) ${err.message}`,
        };
    }
};

/**
 * Add squad chatroom participant.
 */
export const addSquadChatroomParticipant = async (squadId: string, memberId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const squad = await SquadModel.findById(squadId);
        if (!squad) throw new Error('Squad not found');

        const member = await UserModel.findById(memberId);
        if (!member) throw new Error('Member not found');

        if (!squad.members.some(({ userId }) => member._id === userId)) {
            throw new Error(`You are not a member of this squad`);
        }

        const chatroom = await ChatroomModel.findOne({ squad: squad._id });
        if (!chatroom) throw new Error('Chatroom not found');

        await joinChatroom(member._id, chatroom._id);

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(addSquadChatroomParticipant) Member joined the chatroom successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(addSquadChatroomParticipant) ${err.message}`,
        };
    }
};

/**
 * Remove squad chatroom participant.
 */
export const removeSquadChatroomParticipant = async (squadId: string, memberId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const squad = await SquadModel.findById(squadId);
        if (!squad) throw new Error('Squad not found');

        const member = await UserModel.findById(memberId);
        if (!member) throw new Error('Member not found');

        if (!squad.members.some(({ userId }) => member._id === userId)) {
            throw new Error(`You are not a member of this squad`);
        }

        const chatroom = await ChatroomModel.findOne({ squad: squad._id });
        if (!chatroom) throw new Error('Chatroom not found');

        await leaveChatroom(member._id, chatroom._id);

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(removeSquadChatroomParticipant) Member joined the chatroom successfully.`,
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(removeSquadChatroomParticipant) ${err.message}`,
        };
    }
};

/**
 * Mutes a participant in the specified chatroom until the provided timestamp.
 */
export const muteParticipant = async (
    userId: string,
    chatroomId: string,
    mutedUntilTimestamp: number
): Promise<ReturnValue> => {
    try {
        const chatroom = await ChatroomModel.findById(chatroomId);
        if (!chatroom) {
            throw new Error('Chatroom not found.');
        }

        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] });
        if (!user) throw new Error('User not found');

        const participant = chatroom.participants.find((participant) => participant.user.toString() === user._id);

        if (!participant) {
            throw new Error('Participant not found in this chatroom.');
        }

        participant.mutedUntilTimestamp = mutedUntilTimestamp;

        await chatroom.save();

        return {
            status: Status.SUCCESS,
            message: `(muteParticipant) Participant muted successfully.`,
            data: { chatroom },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(muteParticipant) ${err.message}`,
        };
    }
};

/**
 * Unmutes a participant in the specified chatroom.
 */
export const unmuteParticipant = async (userId: string, chatroomId: string): Promise<ReturnValue> => {
    try {
        const chatroom = await ChatroomModel.findById(chatroomId);
        if (!chatroom) {
            throw new Error('Chatroom not found.');
        }

        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] });
        if (!user) throw new Error('User not found');

        const participant = chatroom.participants.find((participant) => participant.user.toString() === user._id);

        participant.mutedUntilTimestamp = null;

        await chatroom.save();

        return {
            status: Status.SUCCESS,
            message: `(unmuteParticipant) Participant unmuted successfully.`,
            data: { chatroom },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(unmuteParticipant) ${err.message}`,
        };
    }
};
