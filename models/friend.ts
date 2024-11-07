/****************
 * FRIEND-RELATED MODELS
 ****************/

/**
 * Represents user friend relationship.
 */
export interface Friend {
    _id?: string;
    userId1: string;
    userId2: string;
    status: FriendStatus;
}

export enum FriendStatus {
    PENDING = 'Pending',
    ACCEPTED = 'Accepted',
    REJECTED = 'Rejected',
}

export interface FriendData {
    _id?: string;
    twitterId: string;
    name: string;
    username: string;
    profilePicture: string;
    level: string | number;
    rank: string | number;
    points: string | number;
}
