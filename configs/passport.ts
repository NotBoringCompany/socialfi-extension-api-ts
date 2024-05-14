import { Strategy as TwitterStrategy } from '@superfaceai/passport-twitter-oauth2';
import { Strategy as DiscordStrategy } from 'passport-discord';
import passport from 'passport';
import { ExtendedProfile } from '../utils/types';

passport.use(new TwitterStrategy({
    clientType: 'confidential',
    clientID: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    callbackURL: process.env.TWITTER_CALLBACK_URL!,
    scope: ['tweet.read', 'users.read', 'offline.access'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user: Express.User = {
                ...profile,
                twitterAccessToken: accessToken,
                twitterRefreshToken: refreshToken,
                // get the current unix timestamp, add 7200
                twitterExpiryDate: Math.floor(Date.now() / 1000) + 7200,
            }

            return done(null, user);
        } catch (err: any) {
            done(err, undefined);
        }
    }
));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID ?? '1239521901630459934',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? 'XZAS0E-LHP9FDkeQMR5C3rnQl3RRQo0Z',
    callbackURL: process.env.DISCORD_CALLBACK_URL ?? '/auth/discord/callback',
    scope: ['identify', 'role_connections.write']
}, (accessToken, refreshToken, profile, done) => {
    try {
        const user: Express.User = {
            ...profile,
            discordAccessToken: accessToken,
            discordRefreshToken: refreshToken,
            // get the current unix timestamp, add 7200
            discordExpiryDate: Math.floor(Date.now() / 1000) + 7200,
        }

        return done(null, user);
    } catch (err: any) {
        done(err, undefined);
    }
}));

passport.serializeUser((user: ExtendedProfile, done) => {
    console.log('serializing user, user profile: ', user);

    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    console.log('deserializing user, user id: ', id);

    done(null, { id });
});

export default passport;