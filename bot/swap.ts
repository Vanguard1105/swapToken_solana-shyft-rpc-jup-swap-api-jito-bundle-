import { Transaction, VersionedTransaction, sendAndConfirmTransaction, Keypair } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import axios from "axios";
import { connection, fetchTokenAccountData } from "./web3";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";
import { Telegraf } from "telegraf";
import Channel from "../src/models/Channel";
import { iterMessages } from "telegram/client/messages";

export const bot = new Telegraf("7912313639:AAHWVJxqGdfpGnV2vLMQ87eS-fhs7-fbplk");

interface SwapCompute {
    id: string;
    success: true;
    version: "V0" | "V1";
    openTime?: undefined;
    msg: undefined;
    data: {
        swapType: "BaseIn" | "BaseOut";
        inputMint: string;
        inputAmount: string;
        outputMint: string;
        outputAmount: string;
        otherAmountThreshold: string;
        slippageBps: number;
        priceImpactPct: number;
        routePlan: {
            poolId: string;
            inputMint: string;
            outputMint: string;
            feeMint: string;
            feeRate: number;
            feeAmount: string;
        }[];
    };
}

export const apiSwap = async (
    mintAddress: string | undefined,
    amount: number,
    secretKey: string,
    chatId: string,
    isBuy: boolean,
    slippage?: number,
    channel?: any
) => {
    console.log("Swaping.....");
    let inputMint: string | undefined;
    let outputMint: string | undefined;
    try {
        if (isBuy) {
            inputMint = NATIVE_MINT.toBase58();
            outputMint = mintAddress;
        } else {
            inputMint = mintAddress;
            outputMint = NATIVE_MINT.toBase58();
        }
        //   const outputMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' // RAY
        //   const amount = 10000
        const slippage = 0.5; // in percent, for this example, 0.5 means 0.5%
        const txVersion: string = "V0"; // or LEGACY
        const isV0Tx = txVersion === "V0";
        const owner: Keypair = Keypair.fromSecretKey(bs58.decode(secretKey));

        const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()];

        const { tokenAccounts } = await fetchTokenAccountData(owner);
        const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint)?.publicKey;
        const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint)?.publicKey;

        if (!inputTokenAcc && !isInputSol) {
            console.error("do not have input token account");
            return;
        }

        // get statistical transaction fee from api
        /**
         * vh: very high
         * h: high
         * m: medium
         */
        const { data } = await axios.get<{
            id: string;
            success: boolean;
            data: { default: { vh: number; h: number; m: number } };
        }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

        const { data: swapResponse } = await axios.get<SwapCompute>(
            `${API_URLS.SWAP_HOST
            }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100
            }&txVersion=${txVersion}`
        );

        const { data: swapTransactions } = await axios.post<{
            id: string;
            version: string;
            success: boolean;
            data: { transaction: string }[];
        }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            computeUnitPriceMicroLamports: String(data.data.default.h),
            swapResponse,
            txVersion,
            wallet: owner.publicKey.toBase58(),
            wrapSol: isInputSol,
            unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
            inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
            outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
        });

        const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, "base64"));
        const allTransactions = allTxBuf.map((txBuf) =>
            isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
        );

        console.log(`total ${allTransactions.length} transactions`, swapTransactions);
        bot.telegram.sendMessage(chatId, `total ${allTransactions.length} transactions`);

        let idx = 0;
        if (!isV0Tx) {
            for (const tx of allTransactions) {
                console.log(`${++idx} transaction sending...`);
                bot.telegram.sendMessage(chatId, `${++idx} transaction sending...`);
                const transaction = tx as Transaction;
                transaction.sign(owner);
                const txId = await sendAndConfirmTransaction(connection, transaction, [owner], { skipPreflight: true });
                console.log(`${++idx} transaction confirmed, txId: ${txId}`);
                bot.telegram.sendMessage(chatId, `${++idx} transaction confirmed, txId: ${txId}`);
            }
        } else {
            for (const tx of allTransactions) {
                idx++;
                const transaction = tx as VersionedTransaction;
                transaction.sign([owner]);
                const txId = await connection.sendTransaction(tx as VersionedTransaction, { skipPreflight: true });
                const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
                    commitment: "finalized",
                });
                console.log(`${idx} transaction sending..., txId: ${txId}`);
                bot.telegram.sendMessage(chatId, `${idx} transaction sending..., txId: ${txId}`);
                await connection.confirmTransaction(
                    {
                        blockhash,
                        lastValidBlockHeight,
                        signature: txId,
                    },
                    "confirmed"
                );
                console.log(`${idx} transaction confirmed`);
                bot.telegram.sendMessage(chatId, `${idx} transaction confirmed`);
                if (channel) {
                    await Channel.updateOne(
                        { _id: channel._id },
                        { $set: { currentInvestment: channel.currentInvestment + amount }}
                    );
                }
            }
        }
    } catch (error) {
        bot.telegram.sendMessage(chatId, "Transaction failed");
    }
};

// apiSwap("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", 100000, "5ib36nMCaPSdZaHPMrJ7zq8oWhWa6trrNwHY6oNUePtUwdsYCU2MsJ4LpCw9oaZm3h3ruQzsYtFHCtxDQoUhBPBF", "7916248551", true);
