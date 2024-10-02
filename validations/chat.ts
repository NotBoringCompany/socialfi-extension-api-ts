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
