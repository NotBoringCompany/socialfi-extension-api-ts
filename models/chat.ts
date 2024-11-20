import { Squad } from './squad';
import { User } from './user';

/**
 * Represents a chat message.
 */
export interface Chat {
    _id?: string;
    message: string;
    /** Sender's user ID, reference to the Users collection */
    sender: string;
    /** Receiver's user ID; set to null for group chats */
    receiver: string | null;
    /** Chatroom ID or object the message belongs to */
    chatroom: Chatroom | string;
    /** UNIX timestamp indicating when the message was sent */
    createdTimestamp: number;
}

/**
 * Represents the type of the chatroom.
 */
export enum ChatroomType {
    PUBLIC = 'public',
    PRIVATE = 'private',
    SQUAD = 'squad',
}

/**
 * Represents a chatroom, which tracks users and handles both group and direct conversations.
 */
export interface Chatroom {
    _id?: string;
    name: string;
    /** Indicates if the chatroom is a group chat (true) or direct message (false) */
    isGroup: boolean;
    /** Type of chatroom: public or private */
    type: ChatroomType;
    /** UNIX timestamp for when the chatroom was created */
    createdTimestamp: number;
    /** the last message sent to the chatroom, this is used for caching purpose */
    lastMessage: string | null;
    /** the last sender who sent a message to the chatroom, this is used for caching purpose */
    lastSender: User | string | null;
    /** the last message sent timestamp to the chatroom, this is used for caching purpose */
    lastMessageTimestamp: number | null;
    /** the count of message sent to the chatroom, this is used for caching purpose */
    messagesCount: number;
    participants: ChatroomParticipant[];
    squad?: Squad | string;
}

/**
 * Represents a participant in a chatroom.
 */
export interface ChatroomParticipant {
    _id?: string;
    /** User ID or object representing the participant */
    user: User | string;
    /** Timestamp indicating when the user joined the chatroom */
    joinedTimestamp: string;
    /** the timestamp until which the participant is muted, if applicable */
    mutedUntilTimestamp?: number | null;
}
