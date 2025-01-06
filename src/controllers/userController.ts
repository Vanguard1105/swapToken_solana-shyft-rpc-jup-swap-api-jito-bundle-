import { Request, Response } from "express";
import User from "../models/User";
import { Keypair } from "@solana/web3.js";
import bs58 from 'bs58';

// export const createUser = async (req: Request, res: Response) => {
//     try {
//         const user = new User(req.body);
//         console.log("user----------->", user);
//         await user.save();
//         res.status(201).json(user);
//     } catch (error) {
//         res.status(400).json({ message: "Server Error occured: createUser" });
//     }
// };

export const getUsers = async (req: Request, res: Response) => {
    const { userId, username } = req.body;
    console.log("userInfo==========>", userId, username);
    try {
        // const users = await User.find();
        const user = await User.findOne({
            $or: [{ username }, { userId }],
        });
        if (user) {
            res.status(200).json(user);
        } else {
            console.log("user NULL!!!");
            const wallets = createSolanaWallet();
            const newUser = new User({
                userId: userId,
                username: username,
                wallets: wallets,
            });
            console.log("user============>", newUser);
            await newUser.save();
            res.status(200).json(newUser);
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error occured: getUser" });
    }
};

const createSolanaWallet = () => {
    const wallets = [];
    for (let i = 0; i < 10; i++) {
        // Generate a new keypair
        const wallet = Keypair.generate();
        // Retrieve the public key and secret key
        const publicKey = wallet.publicKey.toString();
        const secretKey = bs58.encode(wallet.secretKey);
        wallets.push({
            publicKey,
            secretKey, // Convert Uint8Array to regular array for display
        });
    }
    return wallets;
};
