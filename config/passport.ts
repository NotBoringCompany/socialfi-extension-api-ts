import { Strategy as TwitterStrategy } from '@superfaceai/passport-twitter-oauth2';
import passport from 'passport';
import types, { ExtendedProfile } from '../utils/types';

passport.use(new TwitterStrategy({
    clientType: 'confidential',
    clientID: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    callbackURL: process.env.TWITTER_CALLBACK_URL!,
    scope: ['tweet.read', 'users.read', 'offline.access']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user: Express.User = {
                ...profile,
                twitterAccessToken: accessToken,
                twitterRefreshToken: refreshToken,
                twitterExpiresIn: 7200,
            }

            return done(null, user);
        } catch (err: any) {
            done(err, undefined);
        }
    }
));

passport.serializeUser((user: ExtendedProfile, done) => {
    console.log('serializing user, user profile: ', user);

    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    console.log('deserializing user, user id: ', id);

    done(null, { id });
});

export default passport;