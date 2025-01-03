import express from 'express';
import http from 'http';
import cors from 'cors';
import * as dotenv from 'dotenv';
import './utils/zod';
import passport from 'passport';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { checkMaintenance } from './middlewares/maintenance';
import {Server} from 'socket.io'

dotenv.config();

const app = express();
const port = process.env.PORT!;
const mongoUri = process.env.MONGODB_URI!;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// temporarily allowing all cors requests
app.use(cors());

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        // store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'Sessions' })
    })
);

app.use(passport.initialize());
app.use(passport.session());

/** ROUTE IMPORTS */
import twitterAuth from './routes/auth/twitter';
import discordAuth from './routes/auth/discord';
import telegramAuth from './routes/auth/telegram';
import lineAuth from './routes/auth/line';
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
import web3 from './routes/web3';
import chat from './routes/chat';
import { schedulers } from './schedulers/schedulers';
import ban from './routes/ban';
import mail from './routes/mail';
import upgrade from './routes/upgrade';
import gacha from './routes/gacha';
import cosmetic from './routes/cosmetic';
import friend from './routes/friend';
import report from './routes/report';
import trade from './routes/trade';
import './utils/constants/shop';
import { populateBitCosmeticEnum } from './utils/constants/cosmetic';
import { initializeSocket } from './configs/socket';
import { CRAFTING_RECIPES, populateCraftingRecipesAndAssetEnums } from './utils/constants/craft';
import { populateBitTraitsData } from './utils/constants/bit';
import { BitTraitEnum } from './models/bit';
import { kaiaTestnetNFTListeners } from './utils/constants/web3';

app.use('/auth/twitter', checkMaintenance, twitterAuth);
app.use('/auth/discord', checkMaintenance, discordAuth);
app.use('/auth/telegram', checkMaintenance, telegramAuth);
app.use('/auth/line', checkMaintenance, lineAuth);
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
app.use('/collab', checkMaintenance, collab);
app.use('/web3', checkMaintenance, web3);
app.use('/chat', checkMaintenance, chat);
app.use('/bans', checkMaintenance, ban);
app.use('/mail', checkMaintenance, mail);
app.use('/upgrade', checkMaintenance, upgrade);
app.use('/gacha', checkMaintenance, gacha);
app.use('/cosmetic', checkMaintenance, cosmetic);
app.use('/friend', checkMaintenance, friend);
app.use('/report', checkMaintenance, report);
app.use('/trade', checkMaintenance, trade);

const httpServer = http.createServer(app);

/** socket io listener */
initializeSocket(httpServer);

httpServer.listen(port, async () => {
    console.log(`Server running on port: ${port}`);

    // populates the `BitCosmeticEnum` enum with the values from the database
    await populateBitCosmeticEnum();

    // populates `CRAFTING_RECIPES` array with all the crafting recipes available from the database
    // as well as the crafted asset enums
    await populateCraftingRecipesAndAssetEnums();

    // populates `BIT_TRAITS` and the `BitTrait` enum with the values from the database
    await populateBitTraitsData();

    const bitTraitKeys = Object.keys(BitTraitEnum);
    console.log(`BitTraitEnum keys: ${bitTraitKeys}`);

    // event listeners for NFT contracts in KAIA Testnet
    kaiaTestnetNFTListeners();

    // await schedulers();
});

export default app;
