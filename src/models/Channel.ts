import mongoose, { Document, Schema } from "mongoose";

interface IWallet {
    publicKey: string;
    privKey: string;
}

export interface IChannel extends Document {
    userId: string;
    name:string;
    url: string;
    autoBuy: boolean;
    autoSell: boolean;
    autoSellSettings: any[];
    buyAmount: number;
    maxTotalInvestment: number | string;
    currentInvestment: number;
    autoBuyRetry: number;
    retryTime: number;
    slippage: number;
    antiMEV: boolean;
    buyTipMEV: number;
    sellTipMEV: number;
    buyGasFee: number;
    sellGasFee: number;
    wallet: IWallet;
}

const ChannelSchema: Schema = new Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    autoBuy: { type: Boolean, required: true},
    autoSell: {type: Boolean, required: true},
    autoSellSettings: {type: Object, required: true},
    buyAmount: { type: Number, required: true},
    maxTotalInvestment: { type: String || Number, required: true},
    currentInvestment: {type: Number, required: true},
    autoBuyRetry: { type: Number, required: true},
    retryTime: { type: Number, required: true},
    slippage: { type: Number, required: true},
    antiMEV: { type: Boolean, required: true},
    buyTipMEV: { type: Number, required: true},
    sellTipMEV: { type: Number, required: true},
    buyGasFee: { type: Number, required: true},
    sellGasFee: { type: Number, required: true},
    wallet: { type: Object, required: true}
});

const Channel = mongoose.model<IChannel>("Channel", ChannelSchema, "channels");
export default Channel;