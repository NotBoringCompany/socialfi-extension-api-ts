import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import passport from 'passport';
import mongoose from 'mongoose';
import session from 'express-session';

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
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: mongoUri })
}));

app.use(passport.initialize());
app.use(passport.session());

/** ROUTE IMPORTS */
import twitterAuth from './routes/auth/twitter';
import MongoStore from 'connect-mongo';

app.use('/auth/twitter', twitterAuth);

app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    await mongoose.connect(mongoUri);
});