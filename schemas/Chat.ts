import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { Chat, Chatroom, ChatroomParticipant } from '../models/chat';

export const ChatroomParticipantSchema = new mongoose.Schema<ChatroomParticipant & mongoose.Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    user: { type: String, ref: 'Users', required: true, index: true },
    joinedTimestamp: { type: String, required: true },
});

export const ChatroomSchema = new mongoose.Schema<Chatroom & mongoose.Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    name: { type: String, required: true },
    isGroup: { type: Boolean, required: true },
    type: { type: String, enum: ['public', 'private'], required: true },
    participants: [ChatroomParticipantSchema],
    lastSender: { type: String, ref: 'Users', default: null },
    lastMessage: { type: String, default: null },
    lastMessageTimestamp: { type: Number, default: null },
    messagesCount: { type: Number, default: 0 },
    createdTimestamp: { type: Number, required: true },
});

export const ChatSchema = new mongoose.Schema<Chat & mongoose.Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    message: { type: String, required: true },
    sender: { type: String, ref: 'Users', required: true, index: true },
    receiver: { type: String, ref: 'Users', default: null, index: true },
    chatroom: { type: String, ref: 'Chatrooms', required: true, index: true },
    createdTimestamp: { type: Number, required: true },
});
