import { Profile as TwitterProfile } from '@superfaceai/passport-twitter-oauth2';
import { Strategy as DiscordStrategy } from 'passport-discord';

declare namespace Express {
    export interface User {
        id: string;
    }
}

export interface ExtendedProfile extends TwitterProfile {
    photos?: {
        value: string;
    }[];
    twitterAccessToken?: string;
    twitterRefreshToken?: string;
    twitterExpiryDate?: number;
}

export interface DiscordProfile extends DiscordStrategy.Profile {
    discordAccessToken?: string;
    discordRefreshToken?: string;
    discordExpiryDate?: number;
}
