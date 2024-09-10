import { z } from 'zod';

export interface ChatMessageQuery {
    limit?: number;
    startTimestamp?: number;
    endTimestamp?: number;
    user: string; // Users.twitterId
    chatroom: string; // Chatroom._id
}

export const chatMessageQuery = z.object({
    limit: z.number().optional(),
    startTimestamp: z.number().optional(),
    endTimestamp: z.number().optional(),
});

export interface ChatroomCreateDTO {
    name: string;
    
}
