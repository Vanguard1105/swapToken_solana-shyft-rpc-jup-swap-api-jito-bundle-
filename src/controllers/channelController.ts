import { Request, Response } from "express";
import Channel from "../models/Channel";
import { startTelegramClient } from "../../channel";
import { channel } from "diagnostics_channel";
import { start } from "repl";

export const getChannels = async (req: Request, res: Response) => {
    const { userId, publicKey } = req.body;
    const channels = await Channel.find({
        userId: userId,
        'wallet.publicKey': publicKey,
    })
    if (channels && channels.length > 0) {
        res.status(200).json(channels);
    } else {
        res.status(404).json({ message: "Channels not found" });
    }
}

export const addChannel = async (req: Request, res: Response) => {
    const {
        userId,
        name,
        url,
        autoBuy,
        autoSell,
        autoSellSettings,
        buyAmount,
        maxTotalInvestment,
        currentInvestment,
        autoBuyRetry,
        retryTime,
        slippage,
        antiMEV,
        buyTipMEV,
        sellTipMEV,
        buyGasFee,
        sellGasFee,
        wallet,
    } = req.body;
    try {
        const newChannel = new Channel({
            userId,
            name,
            url,
            autoBuy,
            autoSell,
            autoSellSettings,
            buyAmount,
            maxTotalInvestment,
            currentInvestment,
            autoBuyRetry,
            retryTime,
            slippage,
            antiMEV,
            buyTipMEV,
            sellTipMEV,
            buyGasFee,
            sellGasFee,
            wallet
        });
        await newChannel.save();
        const channels = await Channel.find();
        const channelUrls = channels.map(item => item.url);
        await startTelegramClient(channelUrls);
        res.status(200).json({ message: "Channel saved successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const startClient = async (req: Request, res: Response) => {
    const { channels } = req.body;
    try {
        await startTelegramClient(channels);
        res.send("Telegram client started.");
    } catch (error) {
        console.error("Error starting Telegram client:", error);
        res.status(500).send("Failed to start Telegram client.");
    }
};

export const updateChannel = async (req: Request, res: Response) => {
    const { newData, _id } = req.body;
    console.log("New Data =========>", newData);
    try {
        const result = await Channel.updateOne(
            { _id: _id },
            { $set: newData }
        );
        console.log("result==========>", result);
        if (result.modifiedCount > 0) {
            const channel = await Channel.findOne(
                { _id: _id }
            );
            const channels = await Channel.find();
            const channelUrls = channels.map(item => item.url);
            await startTelegramClient(channelUrls);
            res.status(200).json(channel);
        } else {
            res.status(404).json({ message: "Not updated." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error." });
    }
};