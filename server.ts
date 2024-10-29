import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import './utils/zod';
import passport from 'passport';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { checkMaintenance } from './middlewares/maintenance';
import {Server} from 'socket.io'
import http from 'http';

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
import discordAuth from './routes/auth/discord';
import telegramAuth from './routes/auth/telegram';
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
import craft from './routes/craft';
import cookie from './routes/cookie';
import poi from './routes/poi';
import leaderboard from './routes/leaderboard';
import kos from './routes/kos';
import asset from './routes/asset';
import tutorial from './routes/tutorial';
import invite from './routes/invite';
import squad from './routes/squad';
import setting from './routes/setting';
import poap from './routes/poap';
import squadLeaderboard from './routes/squadLeaderboard';
import weeklyMVPReward from './routes/weeklyMVPReward';
import collab from './routes/collab';
import collabV2 from './routes/collab_v2';
import web3 from './routes/web3';
import { schedulers } from './schedulers/schedulers';
import ban from './routes/ban';
import mail from './routes/mail';
import { initSocket } from './socket';
import upgrade from './routes/upgrade';
import gacha from './routes/gacha';
import cosmetic from './routes/cosmetic';

app.use('/auth/twitter', checkMaintenance, twitterAuth);
app.use('/auth/discord', checkMaintenance, discordAuth);
app.use('/auth/telegram', checkMaintenance, telegramAuth);
app.use('/jwt', checkMaintenance, jwt);
app.use('/shop', checkMaintenance, shop);
app.use('/quest', checkMaintenance, quest);
app.use('/terra_capsulator', checkMaintenance, terraCapsulator);
app.use('/raft', checkMaintenance, raft);
app.use('/island', checkMaintenance, island);
app.use('/bit_orb', checkMaintenance, bitOrb);
app.use('/bit', checkMaintenance, bit);
app.use('/user', checkMaintenance, user);
app.use('/chest', checkMaintenance, chest);
app.use('/craft', checkMaintenance, craft);
app.use('/poi', checkMaintenance, poi);
app.use('/cookie', checkMaintenance, cookie);
app.use('/leaderboard', checkMaintenance, leaderboard);
app.use('/kos', checkMaintenance, kos);
app.use('/asset', checkMaintenance, asset);
app.use('/tutorial', checkMaintenance, tutorial);
app.use('/invite', checkMaintenance, invite);
app.use('/squad', checkMaintenance, squad);
app.use('/setting', setting);
app.use('/poap', checkMaintenance, poap);
app.use('/squad_leaderboard', checkMaintenance, squadLeaderboard);
app.use('/weekly_mvp_reward', checkMaintenance, weeklyMVPReward);
app.use('/collab', checkMaintenance, collabV2);
app.use('/web3', checkMaintenance, web3);
app.use('/bans', checkMaintenance, ban);
app.use('/mail', checkMaintenance, mail);
app.use('/upgrade', checkMaintenance, upgrade);
app.use('/gacha', checkMaintenance, gacha);
app.use('/cosmetic', checkMaintenance, cosmetic);
// both protocol and socket.io
const httpServer = http.createServer(app);
// Sockets init
initSocket(httpServer);

httpServer.listen(port, async () => {
    console.log(`Server running on port: ${port}`);
    await schedulers();
});

export default app;