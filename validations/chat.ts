import { z } from 'zod';

export interface ChatMessageQuery {
    limit?: number | string;
    startTimestamp?: number | string;
    endTimestamp?: number | string;
    user?: string; // Users.twitterId
    chatroom?: string; // Chatroom._id
}

export const chatMessageQuery = z.object({
    chatroom: z.string().optional(),
    limit: z.union([z.string(), z.number()]).optional(),
    startTimestamp: z.union([z.string(), z.number()]).optional(),
    endTimestamp: z.union([z.string(), z.number()]).optional(),
});

export interface ChatroomCreateDTO {
    name: string;
}

export interface SendMessageDTO {
    chatroomId: string;
    message: string;
}

export const sendMessageDTO = z.object({
    chatroomId: z.string(),
    message: z.string(),
});

export interface SendDirectMessageDTO {
    receivedId: string;
    message: string;
}

export const sendDirectMessageDTO = z.object({
    receiverId: z.string(),
    message: z.string(),
});

export interface JoinChatroomDTO {
    chatroomId: string;
}

export const joinChatroomDTO = z.object({
    chatroomId: z.string(),
});

export interface MuteParticipantDTO {
    /** the ID of the chatroom where the participant is being muted */
    chatroomId: string;
    /** the user's unique identifier (_id or Twitter ID) representing the participant */
    userId: string;
    /** the UNIX timestamp until which the participant will remain muted */
    mutedUntilTimestamp: number;
}

export interface UnmuteParticipantDTO {
    /** the ID of the chatroom where the participant is being muted */
    chatroomId: string;
    /** the user's unique identifier (_id or Twitter ID) representing the participant */
    userId: string;
}

export const muteParticipantDTO = z.object({
    /** the ID of the chatroom where the participant is being muted */
    chatroomId: z.string(),
    /** the user's unique identifier (_id or Twitter ID) representing the participant */
    userId: z.string(),
    /** the UNIX timestamp until which the participant will remain muted */
    mutedUntilTimestamp: z.number(),
});

export const unmuteParticipantDTO = z.object({
    /** the ID of the chatroom where the participant is being muted */
    chatroomId: z.string(),
    /** the user's unique identifier (_id or Twitter ID) representing the participant */
    userId: z.string(),
});

export interface SendBlastMessageDTO {
    /** the blast message */
    message: string;
}

export const sendBlastMessageDTO = z.object({
    message: z.string().min(1, 'Message is required'),
});
