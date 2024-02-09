import mongoose from 'mongoose';

/**
 * Shop schema. Represents closely to the `Shop` interface in `models/shop.ts`.
 */
export const ShopSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    bitOrbs: Object,
    terraCapsulators: Object,
    foods: Object
})