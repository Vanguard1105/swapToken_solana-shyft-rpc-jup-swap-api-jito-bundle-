import { Request, Response } from "express";
import Order from "../models/Order";

export const addOrder = async (req: Request, res: Response) => {
    console.log("addOrder request==============>", req.body);
    const {
        userId,
        orderId,
        pubKey,
        privKey,
        tokenAddress,
        limitAmount,
        marketCapToHit,
        mode,
    } = req.body;

    try {
        const newOrder = new Order({
            userId,
            orderId,
            pubKey,
            privKey,
            tokenAddress,
            limitAmount,
            marketCapToHit,
            mode,
        });

        await newOrder.save();
        res.status(200).json({ message: "Order saved successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error saving order" });
    }
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const orders = await Order.find({
            $or: [{ userId }],
        });
        if (orders) {
            res.status(200).json(orders);
        } else {
            res.status(404).json({ message: "Orders not found" });
        }
    } catch (error) {}
};

export const removeOrder = async (req: Request, res: Response) => {
    const { userId, orderId } = req.body;
    try {
        const result = await Order.deleteOne({
            userId: userId,
            orderId: orderId,
        });
        if (result.deletedCount === 0) {
            res.status(404).json({ message: "Order not found" });
        }
        res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};
