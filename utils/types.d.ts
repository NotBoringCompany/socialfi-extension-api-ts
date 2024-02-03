import { Profile as TwitterProfile } from '@superfaceai/passport-twitter-oauth2';

declare global {
    namespace Express {
        interface User {
            id: string;
        }
    }
}

interface TwitterFields {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
}

export interface ExtendedProfile extends Express.User, TwitterFields { }