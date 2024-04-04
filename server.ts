import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import passport from 'passport';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';

dotenv.config();

const app = express();
const port = process.env.PORT!;
const mongoUri = process.env.MONGODB_URI!;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// temporarily allowing all cors requests
app.use(cors());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'Sessions' })
}));

app.use(passport.initialize());
app.use(passport.session());

/** ROUTE IMPORTS */
import twitterAuth from './routes/auth/twitter';
import jwt from './routes/jwt';
import shop from './routes/shop';
import quest from './routes/quest';
import terraCapsulator from './routes/terraCapsulator';
import raft from './routes/raft';
import island from './routes/island';
import bitOrb from './routes/bitOrb';
import bit from './routes/bit';
import user from './routes/user';
import chest from './routes/chest';
import cookie from './routes/cookie';
import poi from './routes/poi';
import leaderboard from './routes/leaderboard';
import kos from './routes/kos';
import { schedulers } from './schedulers/schedulers';

app.use('/auth/twitter', twitterAuth);
app.use('/jwt', jwt);
app.use('/shop', shop);
app.use('/quest', quest);
app.use('/terra_capsulator', terraCapsulator);
app.use('/raft', raft);
app.use('/island', island);
app.use('/bit_orb', bitOrb);
app.use('/bit', bit);
app.use('/user', user);
app.use('/chest', chest);
app.use('/poi', poi);
app.use('/cookie', cookie);
app.use('/leaderboard', leaderboard);
app.use('/kos', kos);

app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    await mongoose.connect(mongoUri);

    await schedulers();
});