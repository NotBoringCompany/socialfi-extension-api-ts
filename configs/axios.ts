import Axios from 'axios';

export const baseURL = process.env.WONDERVERSE_API_URL;

export const axios = Axios.create({
    baseURL: `${baseURL}/api`,
});
