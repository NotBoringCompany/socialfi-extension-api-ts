import { Profile as TwitterProfile } from '@superfaceai/passport-twitter-oauth2';

declare namespace Express {
    export interface User {
        id: string;
    }
}

export interface ExtendedProfile extends TwitterProfile {
    twitterAccessToken?: string;
    twitterRefreshToken?: string;
    twitterExpiryDate?: number;
}
