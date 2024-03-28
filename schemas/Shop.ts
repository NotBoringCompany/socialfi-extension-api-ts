import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Shop schema. Represents closely to the `Shop` interface in `models/shop.ts`.
 */
export const ShopSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    bitOrbs: Object,
    terraCapsulators: Object,
    foods: Object
})