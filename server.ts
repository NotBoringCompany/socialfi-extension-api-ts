import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT!;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// temporarily allowing all cors requests
app.use(cors());

app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
});