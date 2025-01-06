import mongoose, { Document, Schema } from "mongoose";

export interface IOrder extends Document {
    userId: string;
    orderId: string;
    pubKey: string;
    privKey: string;
    tokenAddress: string;
    limitAmount: number;
    marketCapToHit: number;
    mode: "buy" | "sell";
}

const OrderSchema: Schema = new Schema({
    userId: { type: String, required: true },
    orderId: { type: String, required: true },
    pubKey: { type: String, required: true },
    privKey: { type: String, required: true },
    tokenAddress: { type: String, required: true },
    limitAmount: { type: Number, required: true },
    marketCapToHit: { type: Number, required: true },
    mode: { type: String, required: true },
});

const Order = mongoose.model<IOrder>("Order", OrderSchema, "orders");
export default Order;