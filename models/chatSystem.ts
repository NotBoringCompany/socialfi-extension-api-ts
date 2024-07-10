/**
 * Represents a chat message instance.
 */
export interface ChatMessage {
    /** the message type */
    type: ChatMessageType;
    /** the content of the message */
    content: string;
    /** when the message was sent (unix) */
    timestamp: number;
    /** (optional) if the message was sent to the user's squad */
    squadId?: string;
    /** the recipient's user ID */
    recipientId?: string;
}

/**
 * Represents the chat message type.
 */
export enum ChatMessageType {
    GLOBAL = 'Global',
    SQUAD = 'Squad',
    DIRECT = 'Direct',
    // called upon first WS connection to register user and squad ID
    REGISTER = 'Register',
}