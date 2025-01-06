import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import axios from "axios";
import { getTokenData, getTokenAccounts, connection, getSolBalance } from "./bot/web3";
import { apiSwap } from "./bot/swap";

dotenv.config();

const BACKEND_URL = process.env.BAKEND_URL;
console.log("BACKEND_URL=============>", BACKEND_URL);


// Replace 'YOUR_BOT_TOKEN' with your actual bot token from BotFather
const token = "7912313639:AAHWVJxqGdfpGnV2vLMQ87eS-fhs7-fbplk";
export const bot = new TelegramBot(token, { polling: true });


let messageStatus: { [key: number]: string } = {};
let tokenToBuy: { [key: number]: any } = {};
let user: { [key: number]: any } = {};
let walletBalances: { [key: number]: any[] } = {};
let solBalance: { [key: number]: any } = {};
let tokenIndex: { [key: number]: any } = {};
let selectedMode: { [key: number]: "swap" | "limit" } = {};
let tempLimitOrders: { 
    [key: number]: { 
        amount: number;
        marketCap?: number;
    } 
} = {};

// Listen for the /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from?.username;

    user[chatId] = await fetchUser(chatId, username);

    let text: string = "";
    walletBalances[chatId] = await getTokenAccounts(user[chatId].wallets[0].publicKey, connection);
    solBalance[chatId] = await getSolBalance(user[chatId].wallets[0].publicKey);

    text = `SOL Balance: ${solBalance[chatId]} SOL\n\n`;

    if (walletBalances[chatId].length == 0) {
        text += "No other tokens found";
    } else {
        walletBalances[chatId].forEach((item) => {
            text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
        });
    }

    tokenIndex[chatId] = 0;

    const inline_keyboard = getStartCaption();
    bot.sendMessage(chatId, `${user[chatId].wallets[0].publicKey}\n\n${text}`, {
        reply_markup: { inline_keyboard: inline_keyboard },
    });
});

// Listen for the /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "This is a simple bot. You can use /start to see the welcome message.");
});

// Echo the user's message
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    console.log("message status==========>", messageStatus[chatId]);
    if (msg.text?.startsWith("/")) {
        return; // Ignore command messages
    }

    if (messageStatus[chatId] == "buy") {
        const tokenAddress = message;
        if (tokenAddress) {
            const tokenData = await getTokenData(tokenAddress);
            if (tokenData) {
                tokenToBuy[chatId] = tokenData;
                const inline_keyboard =
                    walletBalances[chatId].length === 0
                        ? getSwapLimitCaption(selectedMode[chatId])
                        : getBuyLimitSellCaption(selectedMode[chatId]);
                bot.sendMessage(
                    chatId,
                    `${tokenData.name} | ${tokenData.symbol} | ${tokenData.address}\n\nPrice: $${tokenData.price_usd}\nMarketCap: ${tokenData.market_cap_usd}`,
                    { reply_markup: { inline_keyboard: inline_keyboard } }
                );
            } else {
                bot.sendMessage(chatId, `Token address ${tokenAddress} not found`);
            }
        } else {
            return;
        }
    }

    if (messageStatus[chatId] == "buy_x") {
        const amount = parseFloat(message || "0") * 1000000000; // Convert to SOL lamports
        if (amount && amount <= solBalance[chatId] * 1000000000) {
            await apiSwap(tokenToBuy[chatId].address, amount, user[chatId].wallets[0].secretKey, `${chatId}`, true, bot);
        } else {
            bot.sendMessage(chatId, "Insufficient SOL balance for this transaction.");
        }
    }
    if (messageStatus[chatId] == "sell_x") {
        const percentage = parseFloat(message || "0");
        if (percentage > 0 && percentage <= 100) {
            await apiSwap(
                tokenToBuy[chatId].address,
                percentage,
                user[chatId].wallets[0].secretKey,
                `${chatId}`,
                false,
                bot
            );
        } else {
            bot.sendMessage(chatId, "Please enter a valid percentage between 1 and 100.");
        }
    }
    if (messageStatus[chatId] == "limit_x") {
        const amount = parseFloat(message || "0");
        if (amount && amount <= solBalance[chatId]) {
            tempLimitOrders[chatId] = { amount };
            messageStatus[chatId] = "limit_market_cap";
            bot.sendMessage(
                chatId,
                `Enter the target Market Cap (in USD) for your limit order:\nToken: ${tokenToBuy[chatId].name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`
            );
        } else {
            bot.sendMessage(
                chatId,
                "Please enter a valid amount within your balance."
            );
            // messageStatus[chatId] = "";
        }
    } else if (messageStatus[chatId] == "limit_market_cap") {
        const marketCap = parseFloat(message || "0");
        if (marketCap && marketCap > 0) {
            const amount = tempLimitOrders[chatId].amount;
            // console.log("amount&marketcap================>", amount, marketCap);
            bot.sendMessage(
                chatId,
                `Confirm Limit Buy Order:\nToken: ${tokenToBuy[chatId].name}\nAmount: ${amount} SOL\nTarget Market Cap: $${marketCap.toLocaleString()}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Confirm", callback_data: `confirm_limit_buy_${amount}_${marketCap}` },
                                { text: "Cancel", callback_data: "cl_cmd" }
                            ]
                        ]
                    }
                }
            );
        } else {
            bot.sendMessage(
                chatId,
                "Please enter a valid market cap value greater than 0."
            );
        }
        // messageStatus[chatId] = "";
    }

});

bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const callback_data = query.data;
    const messageId = query.message?.message_id;

    if (chatId) {
        if (callback_data == "cl_cmd" && messageId) {
            await bot.deleteMessage(chatId, messageId);
            // messageStatus[chatId] = "";
            return;
        }

        if (callback_data == "buy_cmd") {
            selectedMode[chatId] = "swap";
            bot.sendMessage(chatId, "Please input the token address you want to buy:", {
                reply_markup: { inline_keyboard: [[{ text: "Close", callback_data: "cl_cmd" }]] },
            });
            messageStatus[chatId] = "buy";
        } else if (callback_data == "swap_cmd") {
            bot.sendMessage(
                chatId,
                `How much are you going to Buy?\n${tokenToBuy[chatId].name} | ${tokenToBuy[chatId].symbol} | ${tokenToBuy[chatId].address}\n\nPrice: $${tokenToBuy[chatId].price_usd}\nMarketCap: ${tokenToBuy[chatId].market_cap_usd}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Buy 1.0 SOL", callback_data: "buy_10" },
                                { text: "Buy 0.5 SOL", callback_data: "buy_05" },
                                { text: "Buy X SOL", callback_data: "buy_x" },
                            ],
                            [{ text: "Cancel", callback_data: "cl_cmd" }],
                        ],
                    },
                }
            );
        } else if (callback_data == "buy_10" || callback_data == "buy_05" || callback_data == "buy_x") {
            // Avoid duplicate code for fixed amount swaps
            if (callback_data == "buy_10" || callback_data == "buy_05") {
                const amount = callback_data == "buy_10" ? 1000000000 : 500000000;
                await apiSwap(tokenToBuy[chatId].address, amount, user[chatId].wallets[0].secretKey, `${chatId}`, true, bot);
            } else {
                // Check balance for custom amount
                solBalance[chatId] = await getSolBalance(user[chatId].wallets[0].publicKey);
                if (solBalance[chatId] == 0) {
                    bot.sendMessage(
                        chatId,
                        `Deposit $SOLs your wallet to buy tokens.\nWallet Address: ${user[chatId].wallets[0].publicKey}`
                    );
                } else {
                    messageStatus[chatId] = "buy_x";
                    bot.sendMessage(
                        chatId,
                        `Reply with the amount you wish to buy (0 - ${solBalance[chatId]} SOL, Example: 0.1):`
                    );
                }
            }
        } else if (callback_data == "sell_cmd") {
            if (walletBalances[chatId].length > 0) {
                selectedMode[chatId] = "swap";
                tokenToBuy[chatId] = {
                    address: walletBalances[chatId][0].tokenAddress,
                    name: walletBalances[chatId][0].tokenName,
                };

                bot.sendMessage(
                    chatId,
                    `Token Name: ${walletBalances[chatId][0].tokenName}\nToken Address: ${walletBalances[chatId][0].tokenAddress}\nToken Balance: ${walletBalances[chatId][0].tokenBalance}\n\n`,
                    {
                        reply_markup: {
                            inline_keyboard: getBuyLimitSellCaption(selectedMode[chatId]),
                        },
                    }
                );
            } else {
                bot.sendMessage(chatId, "No position for Sell", {
                    reply_markup: { inline_keyboard: [[{ text: "Cancel", callback_data: "cl_cmd" }]] },
                });
            }
        } else if (callback_data == "sell_25" || callback_data == "sell_100" || callback_data == "sell_x") {
            // Handle custom percentage sell
            if (callback_data == "sell_x") {
                messageStatus[chatId] = "sell_x";
                bot.sendMessage(chatId, `Reply with the percentage you wish to sell (1-100):`);
                return;
            }

            // Handle fixed percentage sells
            const percentageMap = {
                sell_25: 0.25,
                sell_100: 1.0,
            };

            const percentage = percentageMap[callback_data];
            const tokenAmount = walletBalances[chatId][0].tokenBalance * percentage;
            await apiSwap(
                tokenToBuy[chatId].address,
                tokenAmount,
                user[chatId].wallets[0].secretKey,
                `${chatId}`,
                false,
                bot
            );
        } else if (callback_data == "limit_cmd") {
            bot.sendMessage(chatId, "How much are you going to Limit for buy order?", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "Limit 5.0 SOL", callback_data: "limit_50" },
                            { text: "Limit X SOL", callback_data: "limit_x" },
                        ],
                        [{ text: "Cancel", callback_data: "cl_cmd" }],
                    ],
                },
            });
        } else if (callback_data == "limit_50" || callback_data == "limit_x") {
            if (callback_data == "limit_50") {
                const amount = 5.0; // 5 SOL
                tempLimitOrders[chatId] = { amount };
                messageStatus[chatId] = "limit_market_cap";
                bot.sendMessage(
                    chatId,
                    `Enter the target Market Cap (in USD) for your limit order:\nToken: ${tokenToBuy[chatId].name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`
                );
            } else {
                // For limit_x, ask for custom amount
                solBalance[chatId] = await getSolBalance(user[chatId].wallets[0].publicKey);
                if (solBalance[chatId] == 0) {
                    bot.sendMessage(
                        chatId,
                        `Deposit $SOLs to your wallet to place limit orders.\nWallet Address: ${user[chatId].wallets[0].publicKey}`
                    );
                } else {
                    messageStatus[chatId] = "limit_x";
                    bot.sendMessage(
                        chatId,
                        `Reply with the amount for limit order (0 - ${solBalance[chatId]} SOL, Example: 0.1):`
                    );
                }
            }
        } else if (callback_data?.startsWith("confirm_limit_buy_")) {
            const [_, amount, marketCap] = callback_data.split("_").slice(-3);
            // console.log("parseFloat marketcap================>", marketCap, amount);
            try {
                await saveLimitOrder(
                    chatId,
                    user[chatId].wallets[0].secretKey,
                    tokenToBuy[chatId].address,
                    parseFloat(amount),
                    parseFloat(marketCap),
                    "buy"
                );
                bot.sendMessage(
                    chatId,
                    `✅ Limit Buy Order placed successfully!\nToken: ${tokenToBuy[chatId].name}\nAmount: ${amount} SOL\nTarget Market Cap: $${parseFloat(marketCap).toLocaleString()}`
                );
                
                // Clean up temp data
                delete tempLimitOrders[chatId];
            } catch (error) {
                bot.sendMessage(
                    chatId,
                    "❌ Failed to place limit order. Please try again."
                );
            }
        } else if (callback_data == "swap_opt") {
            selectedMode[chatId] = "swap";
            // Update message with new keyboard
            if (messageId) {
                await bot.editMessageReplyMarkup(
                    {
                        inline_keyboard:
                            walletBalances[chatId].length == 0
                                ? getSwapLimitCaption(selectedMode[chatId])
                                : getBuyLimitSellCaption(selectedMode[chatId]),
                    },
                    { chat_id: chatId, message_id: messageId }
                );
            }
        } else if (callback_data == "limit_opt") {
            selectedMode[chatId] = "limit";
            // Update message with new keyboard
            if (messageId) {
                await bot.editMessageReplyMarkup(
                    {
                        inline_keyboard:
                            walletBalances[chatId].length == 0
                                ? getSwapLimitCaption(selectedMode[chatId])
                                : getBuyLimitSellCaption(selectedMode[chatId]),
                    },
                    { chat_id: chatId, message_id: messageId }
                );
            }
        } else if (callback_data == "limit_50" || callback_data == "limit_x") {

        }
    }
});

const getStartCaption = () => {
    const inline_keyboard = [
        [
            { text: "Buy", callback_data: "buy_cmd" },
            { text: "Sell & Manage", callback_data: "sell_cmd" },
        ],
        [
            { text: "Wallets", callback_data: "wallets_cmd" },
            { text: "Settings", callback_data: "settings_cmd" },
        ],
        [{ text: "Help", callback_data: "help_cmd" }],
        [
            { text: "Pin", callback_data: "pin_cmd" },
            { text: "Refresh", callback_data: "refresh_cmd" },
        ],
    ];
    return inline_keyboard;
};

const getSwapLimitCaption = (mode?: "swap" | "limit") => {
    const inline_keyboard = [
        [{ text: "Cancel", callback_data: "cl_cmd" }],
        [
            { text: mode === "swap" ? "✅ Swap" : "Swap", callback_data: "swap_opt" },
            { text: mode === "limit" ? "✅ Limit" : "Limit", callback_data: "limit_opt" },
        ],
        ...(mode === "swap"
            ? [
                [
                    { text: "Buy 1.0 SOL", callback_data: "buy_10" },
                    { text: "Buy 0.5 SOL", callback_data: "buy_05" },
                    { text: "Buy X SOL", callback_data: "buy_x" },
                ],
            ]
            : [
                [
                    { text: "Limit Buy 5.0 SOL", callback_data: "limit_50" },
                    { text: "Limit Buy X SOL", callback_data: "limit_x" },
                ],
            ]),
        [{ text: "Refresh", callback_data: "refresh_cmd" }],
    ];
    return inline_keyboard;
};

const getBuyLimitSellCaption = (mode?: "swap" | "limit") => {
    const inline_keyboard = [
        [
            { text: "Home", callback_data: "home_cmd" },
            { text: "Close", callback_data: "cl_cmd" },
        ],
        [
            { text: mode === "swap" ? "✅ Swap" : "Swap", callback_data: "swap_opt" },
            { text: mode === "limit" ? "✅ Limit" : "Limit", callback_data: "limit_opt" },
        ],
        ...(mode === "swap"
            ? [
                [
                    { text: "Buy 1.0 SOL", callback_data: "buy_10" },
                    { text: "Buy 0.5 SOL", callback_data: "buy_05" },
                    { text: "Buy X SOL", callback_data: "buy_x" },
                ],
                [
                    { text: "Prev", callback_data: "pre_opt" },
                    { text: "Token To Buy", callback_data: "no_cmd" },
                    { text: "Next", callback_data: "next_opt" },
                ],
                [
                    { text: "Sell 25%", callback_data: "sell_25" },
                    { text: "Sell 100%", callback_data: "sell_100" },
                    { text: "Sell X%", callback_data: "sell_x" },
                ],
            ]
            : [
                [
                    { text: "Limit Buy 5.0 SOL", callback_data: "limit_50" },
                    { text: "Limit Buy X SOL", callback_data: "limit_x" },
                ],
                [
                    { text: "Prev", callback_data: "pre_opt" },
                    { text: "Token To Buy", callback_data: "no_cmd" },
                    { text: "Next", callback_data: "next_opt" },
                ],
                [
                    { text: "Limit Sell 25%", callback_data: "limit_sell_25" },
                    { text: "Limit Sell X%", callback_data: "limit_sell_x" },
                ],
            ]),
        [{ text: "Refresh", callback_data: "refresh_cmd" }],
    ];
    return inline_keyboard;
};

const fetchUser = async (userId: Number, username: String | undefined) => {
    const response = await axios.post(`${BACKEND_URL}api/users`, {
        userId: userId,
        username: username,
    });
    // console.log(response.data);
    return response.data;
};

const saveLimitOrder = async (
    userId: number,
    privKey: string,
    tokenAddress: string,
    limitAmount: number,
    marketCapToHit: number,
    mode: "buy" | "sell"
) => {
    // console.log("marketCap==============>", marketCapToHit);
    const response = await axios.post(`${BACKEND_URL}api/addOrder`, {
        userId: userId,
        privKey: privKey,
        tokenAddress: tokenAddress,
        limitAmount: limitAmount,
        marketCapToHit: marketCapToHit,
        mode: mode
    });
    return response.data;
};

export const Swap = async (mintAddress: string, amount: number, secretKey: string, chatId: string, isBuy: boolean) => {
    // await apiSwap(mintAddress, amount, secretKey, chatId, isBuy, bot);
}

console.log("Bot is running...");
