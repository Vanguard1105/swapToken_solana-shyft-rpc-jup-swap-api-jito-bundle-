import { Telegraf, session, Markup } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";
import {
    getTokenData,
    getTokenAccounts,
    connection,
    getSolBalance,
} from "./web3";
import { apiSwap } from "./swap";
import { BotContext } from "./types";

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000/";
console.log("BACKEND_URL=============>", BACKEND_URL);

const botToken = "7912313639:AAHWVJxqGdfpGnV2vLMQ87eS-fhs7-fbplk";
const bot = new Telegraf(botToken);

bot.use(session());

bot.start(async (ctx: BotContext) => {
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;

    if (!ctx.session) ctx.session = {};

    ctx.session.user = await fetchUser(chatId, username);

    ctx.session.walletBalances = await getTokenAccounts(
        ctx.session.user.wallets[0].publicKey,
        connection
    );
    ctx.session.solBalance = await getSolBalance(
        ctx.session.user.wallets[0].publicKey
    );

    let text: string = `SOL Balance: ${ctx.session.solBalance} SOL\n\n`;

    if (ctx.session.walletBalances.length == 0) {
        text += "No other tokens found";
    } else {
        ctx.session.walletBalances.forEach((item) => {
            text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
        });
    }

    ctx.session.tokenIndex = 0;
    ctx.session.walletIndex = 0;

    const inline_keyboard = getStartCaption();

    ctx.reply(`${ctx.session.user.wallets[0].publicKey}\n\n${text}`, {
        reply_markup: inline_keyboard,
    });
});

// // CallBack Logics

bot.action("home_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.walletIndex) ctx.session.walletIndex = 0;
    ctx.session.walletBalances = await getTokenAccounts(
        ctx.session.user.wallets[ctx.session.walletIndex].publicKey,
        connection
    );
    ctx.session.solBalance = await getSolBalance(
        ctx.session.user.wallets[ctx.session.walletIndex].publicKey
    );
    let text: string = `SOL Balance: ${ctx.session.solBalance} SOL\n\n`;
    if (ctx.session.walletBalances?.length === 0) {
        text += "No other tokens found";
    } else {
        ctx.session.walletBalances?.forEach((item) => {
            text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
        });
    }
    const inline_keyboard = getStartCaption();
    ctx.reply(`${ctx.session.user.wallets[ctx.session.walletIndex].publicKey}\n\n${text}`, {
        reply_markup: inline_keyboard,
    });
});

bot.action("buy_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    console.log("CTX Session===========>", ctx.session);
    ctx.session.selectedMode = "swap";
    ctx.reply(
        "Please input the token address you want to buy:",
        Markup.inlineKeyboard([[Markup.button.callback("Cancel", "cl_cmd")]])
    );
    ctx.session.messageStatus = "buy";
});

bot.action("swap_cmd", async (ctx: BotContext) => {
    ctx.reply(
        `How much are you going to Buy?\n${ctx.session?.tokenToBuy?.name} | ${ctx.session?.tokenToBuy?.symbol} | ${ctx.session?.tokenToBuy?.address}\n\nPrice: $${ctx.session?.tokenToBuy?.price_usd}\nMarketCap: ${ctx.session?.tokenToBuy?.market_cap_usd}`,
        Markup.inlineKeyboard([
            [
                Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                Markup.button.callback("Buy X SOL", "buy_x"),
            ],
            [Markup.button.callback("Cancel", "cl_cmd")],
        ])
    );
});

bot.action("buy_10", async (ctx: BotContext) => {
    const amount = 1000000000;
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0)
        await apiSwap(
            ctx.session?.tokenToBuy?.address,
            amount,
            ctx.session?.user.wallets[ctx.session.walletIndex].secretKey,
            `${ctx.session?.user.userId}`,
            true
        );
});

bot.action("buy_5", async (ctx: BotContext) => {
    const amount = 500000000;
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0)
        await apiSwap(
            ctx.session?.tokenToBuy?.address,
            amount,
            ctx.session?.user.wallets[ctx.session.walletIndex].secretKey,
            `${ctx.session?.user.userId}`,
            true
        );
});

bot.action("buy_x", async (ctx: BotContext) => {
    if (!ctx.session) {
        ctx.session = {}; // Initialize session if it doesn't exist
    }
    if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0) {
        ctx.session.solBalance = await getSolBalance(
            ctx.session?.user.wallets[ctx.session.walletIndex].publicKey
        );
        if (ctx.session.solBalance === 0) {
            ctx.reply(
                `Deposit $SOLs your wallet to buy tokens.\nWallet Address: ${ctx.session.user.wallets[ctx.session.walletIndex].publicKey
                }`
            );
        } else {
            ctx.session.messageStatus = "buy_x";
            ctx.reply(
                `Reply with the amount you wish to buy (0 - ${ctx.session.solBalance} SOL, Example: 0.1):`
            );
        }
    }
});

bot.action("sell_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {}; // Initialize session if it doesn't exist
    if (ctx.session.walletBalances) {
        if (ctx.session.walletBalances?.length > 0) {
            ctx.session.selectedMode = "swap";
            ctx.session.tokenToBuy = {
                address: ctx.session.walletBalances[0].tokenAddress,
                name: ctx.session.walletBalances[0].tokenName,
            };
            ctx.reply(
                `Token Name: ${ctx.session.walletBalances[0].tokenName}\nToken Address: ${ctx.session.walletBalances[0].tokenAddress}\nToken Balance: ${ctx.session.walletBalances[0].tokenBalance}\n\n`,
                {
                    reply_markup: {
                        inline_keyboard: getBuyLimitSellCaption(
                            ctx.session.selectedMode
                        ),
                    },
                }
            );
        } else {
            ctx.reply(
                "No position for sell",
                Markup.inlineKeyboard([
                    Markup.button.callback("Cancel", "cl_cmd"),
                ])
            );
        }
    }
});

bot.action("sell_25", async (ctx: BotContext) => {
    if (ctx.session?.walletBalances) {
        const percentage = 0.25;
        const tokenAmount =
            ctx.session.walletBalances[0].tokenBalance * percentage;
        if (ctx.session.walletIndex)
            await apiSwap(
                ctx.session.tokenToBuy?.address,
                tokenAmount,
                ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                `${ctx.session.user?.userId}`,
                false
            );
    }
});

bot.action("sell_100", async (ctx: BotContext) => {
    if (ctx.session?.walletBalances) {
        const percentage = 1.0;
        const tokenAmount =
            ctx.session.walletBalances[0].tokenBalance * percentage;
        if (ctx.session.walletIndex)
            await apiSwap(
                ctx.session.tokenToBuy?.address,
                tokenAmount,
                ctx.session.user.wallets[ctx.session.walletIndex].secretKey,
                `${ctx.session.user?.userId}`,
                false
            );
    }
});

bot.action("sell_x", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "sell_x";
    ctx.reply("Reply with the percentage you wish to sell (1-100):");
});

bot.action("swap_opt", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.selectedMode = "swap";
    const replyMarkup =
        ctx.session.walletBalances?.length === 0
            ? getSwapLimitCaption(ctx.session.selectedMode)
            : getBuyLimitSellCaption(ctx.session.selectedMode);
    await ctx.editMessageReplyMarkup({ inline_keyboard: replyMarkup });
});

bot.action("limit_cmd", async (ctx: BotContext) => {
    ctx.reply(
        "How much are you going to Limit for buy order?",
        Markup.inlineKeyboard([
            [
                Markup.button.callback("Limit 5.0 SOL", "limit_50"),
                Markup.button.callback("Limit X SOL", "limit_x"),
            ],
            [Markup.button.callback("Cancel", "cl_cmd")],
        ])
    );
});

bot.action("limit_50", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    const amount = 5.0;
    ctx.session.tempLimitOrders = { amount };
    ctx.session.messageStatus = "limit_market_cap";
    ctx.reply(
        `Enter the target Market Cap (in USD) for your limit order:\nToken: ${ctx.session.tokenToBuy.name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`
    );
});

bot.action("limit_x", async (ctx: BotContext) => {
    console.log("Limit X command!!!");
    if (!ctx.session) ctx.session = {};
    console.log("walletIndex=============>", ctx.session.walletIndex);
    if (ctx.session.walletIndex || ctx.session.walletIndex === 0) {
        ctx.session.solBalance = await getSolBalance(
            ctx.session.user.wallets[ctx.session.walletIndex].publicKey
        );
        if (ctx.session.solBalance === 0) {
            ctx.reply(
                `Deposit $SOLs to your wallet to place limit orders.\nWallet Address: ${ctx.session.user.wallets[ctx.session.walletIndex].publicKey
                }`
            );
        } else {
            ctx.session.messageStatus = "limit_x";
            ctx.reply(
                `Reply with the amount for limit order (0 - ${ctx.session.solBalance} SOL, Example: 0.1):`
            );
        }
    }
});

bot.action("confirm_limit_buy", async (ctx: BotContext) => {
    const amount = ctx.session?.tempLimitOrders?.amount;
    const marketCap = ctx.session?.tempLimitOrders?.marketCap;
    console.log(
        "WalletIndex exists=================>",
        ctx.session?.walletIndex
    );
    const orderId = await generateOrderId();
    try {
        if (ctx.session?.walletIndex || ctx.session?.walletIndex === 0) {
            await saveLimitOrder(
                ctx.session?.user.userId,
                orderId,
                ctx.session.user.wallets[ctx.session.walletIndex].publicKey,
                ctx.session?.user.wallets[ctx.session.walletIndex].secretKey,
                ctx.session?.tokenToBuy.address,
                amount,
                marketCap,
                "buy"
            );
            ctx.reply(
                `✅ Limit Buy Order placed successfully!\nToken: ${ctx.session?.tokenToBuy.name
                }\nAmount: ${amount} SOL\nTarget Market Cap: $${marketCap?.toLocaleString()}`
            );
            delete ctx.session?.tempLimitOrders;
        }
    } catch (error) {
        console.error(error);
        ctx.reply("❌ Failed to place limit order. Please try again.");
    }
});

bot.action("limit_opt", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.selectedMode = "limit";
    const replyMarkup =
        ctx.session.walletBalances?.length === 0
            ? getSwapLimitCaption(ctx.session.selectedMode)
            : getBuyLimitSellCaption(ctx.session.selectedMode);
    await ctx.editMessageReplyMarkup({ inline_keyboard: replyMarkup });
});

bot.action("limit_orders", async (ctx: BotContext) => {
    let text: string = "Open orders:\n";
    const userId = ctx.session?.user.userId;
    const orders = await getLimitOrders(userId);
    const tokenPromises = orders.map(async (item) => {
        const tokenInfo = await getTokenData(item.tokenAddress);
        text += `\n🟢 Buy ${tokenInfo.name}
        ├Trigger: $${item.marketCapToHit} Mcap
        ├Slippage: 10%
        ├Filled: 0.00 / 0.00 SOL
        └Order ID: ${item.orderId}`;
    });
    // Wait for all token data to be fetched
    await Promise.all(tokenPromises);
    ctx.reply(
        text,
        Markup.inlineKeyboard([
            Markup.button.callback("Remove order", "remove_order_cmd"),
        ])
    );
});

bot.action("remove_order_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "remove_order";
    ctx.reply("Input Order ID you are going to remove.");
});

bot.action("wallets_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    let replyWallets: string = `Your wallets:\n\n`;
    ctx.session.user.wallets.forEach((item: { publicKey: any }) => {
        replyWallets += `${item.publicKey}\n`;
    });
    replyWallets += "\nChoose a wallet";
    ctx.reply(
        replyWallets,
        Markup.inlineKeyboard([Markup.button.callback("Cancel", "cl_cmd")])
    );
    ctx.session.messageStatus = "select_wallet";
});

bot.action("privkey_cmd", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    const privKey =
        ctx.session.user.wallets[ctx.session.walletIndex ?? 0].secretKey;
    ctx.reply(`${privKey}`);
});

bot.action("call_channels", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.walletIndex) ctx.session.walletIndex = 0;
    const channels = await fetchChannels(ctx.session.user.userId, ctx.session.user.wallets[ctx.session.walletIndex].publicKey);
    if (channels && channels.length > 0) {
        const inline_keyboard = getChannlesCaption(channels);
        ctx.reply("Select call channels you'd like to subscribe", {
            reply_markup: { inline_keyboard: inline_keyboard },
        });
    } else {
        ctx.reply("Select call channels you'd like to subscribe", {
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.callback("🏠 Home", "home_cmd"),
                        Markup.button.callback("➕ Add Channel", "add_channel"),
                    ]
                ]
            }
        })
    }
});

bot.action("add_channel", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.reply("Input channel name you are going to monitor");
    ctx.session.messageStatus = "add_channel_name";
});

bot.action(/channel_setting_(.+)/, async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.walletIndex) ctx.session.walletIndex = 0;
    if (ctx.match && ctx.match[1]) {
        const channelUrl = ctx.match[1]; // Safely access match[1]
        const channels = await fetchChannels(ctx.session.user.userId, ctx.session.user.wallets[ctx.session.walletIndex].publicKey);
        const channel = channels.find((item: { url: string; }) => item.url === channelUrl);
        ctx.session.channel = channel;
        console.log("channel==========>", channel);
        const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
        const text = getChannelText(channel);
        ctx.reply(text, { reply_markup: { inline_keyboard: inline_keyboard } }).then((sentMessage) => {
            if (!ctx.session) ctx.session = {};
            ctx.session.channelSettingMessageId = sentMessage.message_id;
        });
    } else {
        ctx.reply('No channel URL found in the callback data.');
    }
});

bot.action("channel_is_auto_buy_off", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        autoBuy: false
    };
    const channel = await updateChannel(_id, newData);
    const text = getChannelText(channel);
    const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
    await ctx.editMessageText(text);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_is_auto_buy_on", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        autoBuy: true
    };
    const channel = await updateChannel(_id, newData);
    const text = getChannelText(channel);
    const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
    await ctx.editMessageText(text);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_auto_sell_settings", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    const text =
        `Auto Sell Settings` +
        `\nSet a T/P strategy by setting as many limit TP targets as you would like. The Amount column for T/P should add up to only 100%. Structure accordingly.` +
        `\nExample:` +
        `\n100%; 50% (i.e. takes out your initials)` +
        `\n250%; 20%` +
        `\n400%; 20%` +
        `\n1000%; 10%`;
    const inline_keyboard = getAutoSellSettingsCaption(ctx.session?.channel.autoSell, ctx.session?.channel.autoSellSettings);
    ctx.reply(text, {
        reply_markup: { inline_keyboard: inline_keyboard }
    }).then((sentMessage) => {
        if (!ctx.session) ctx.session = {};
        ctx.session.channelSettingMessageId = sentMessage.message_id;
    });
});

bot.action("channel_is_auto_sell_off", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        autoSell: false
    };
    const channel = await updateChannel(_id, newData);
    const inline_keyboard = getAutoSellSettingsCaption(false, channel.autoSellSettings);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_is_auto_sell_on", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        autoSell: true
    };
    const channel = await updateChannel(_id, newData);
    const inline_keyboard = getAutoSellSettingsCaption(true, channel.autoSellSettings);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_add_tp_button", async (ctx: BotContext | any) => {
    // Check if the callback query message has reply_markup
    const initialInlineKeyboard = ctx.callbackQuery.message.reply_markup.inline_keyboard;

    const newButtons = [
        Markup.button.callback("T/P: -", "channel_add_tp"),
        Markup.button.callback("Amount: -", "channel_add_tp_amount")
    ];

    // Create a copy of the initial keyboard to modify
    const updatedInlineKeyboard = getAutoSellSettingsCaption(ctx.session?.channel.autoSell, ctx.session?.channel.autoSellSettings);

    // Insert new buttons at the second-to-last position
    updatedInlineKeyboard.splice(updatedInlineKeyboard.length - 2, 0, newButtons);

    // Function to compare two arrays for equality
    const arraysEqual = (arr1: any[], arr2: any[]) => {
        if (arr1.length !== arr2.length) return false;
        return true;
    };

    // Check if the updated keyboard is different from the initial keyboard
    if (!arraysEqual(initialInlineKeyboard, updatedInlineKeyboard)) {
        await ctx.editMessageReplyMarkup({ inline_keyboard: updatedInlineKeyboard });
    } else {
        console.log("No changes to the inline keyboard; skipping update.");
    }
});

bot.action("channel_add_tp", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_add_tp";
    ctx.reply("Input T/P in percentage(i.e. If you want 100% T/P, enter 100.)");
});

bot.action("channel_add_tp_amount", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_add_tp_amount";
    ctx.reply("Input Amount in percentage(i.e. If you want 20% Amount, enter 20.)");
});

bot.action(/channel_tp_(.+)/, async (ctx: BotContext | any) => {
    const tpOption = ctx.match[0].split("_")[2];
    ctx.session.messageStatus = ctx.match[0];
    if (tpOption === "amount") {
        ctx.reply("Input T/P in percentage(i.e. If you want 100% T/P, enter 100.)");
    } else {
        ctx.reply("Input Amount in percentage(i.e. If you want 20% Amount, enter 20.)");
    }
});

bot.action("channel_max_investment", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_max_investment";
    ctx.reply("Input max investment SOL amount (For example: 0.5)");
});

bot.action("channel_auto_buy", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_auto_buy";
    ctx.reply("Input the number of retires for auto buy (For example: 1~10)");
});

bot.action("channel_retry_time", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_retry_time";
    ctx.reply("Input retry times for auto buy in milliseconds (For example: 30)");
});

bot.action("channel_buy_amount", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_buy_amount";
    ctx.reply("Input buy SOL amount (For example: 0.5)");
});

bot.action("channel_slippage", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_slippage";
    ctx.reply("Input slippage percentage (For example: 1~100%)");
});

bot.action("channel_antimev_off", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        antiMEV: false
    };
    const channel = await updateChannel(_id, newData);
    const text = getChannelText(channel);
    const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
    await ctx.editMessageText(text);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_antimev_on", async (ctx: BotContext) => {
    const _id = ctx.session?.channel._id;
    const newData = {
        antiMEV: true
    };
    const channel = await updateChannel(_id, newData);
    const text = getChannelText(channel);
    const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
    await ctx.editMessageText(text);
    await ctx.editMessageReplyMarkup({ inline_keyboard: inline_keyboard });
});

bot.action("channel_buy_mev_fee", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_buy_mev_fee";
    ctx.reply("Input buy MEV fee in SOL (For example: 0.5)");
});

bot.action("channel_sell_mev_fee", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_sell_mev_fee";
    ctx.reply("Input sell MEV fee in SOL (For example: 0.5)");
});

bot.action("channel_buy_gas_fee", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_buy_gas_fee";
    ctx.reply("Input buy gas fee in SOL (For example: 0.5)");
});

bot.action("channel_sell_gas_fee", async (ctx: BotContext) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.messageStatus = "channel_sell_gas_fee";
    ctx.reply("Input sell gas fee in SOL (For example: 0.5)");
});

bot.action("cl_cmd", async (ctx: BotContext) => {
    ctx.deleteMessage();
});

// // Message Response Logics

bot.use(async (ctx: BotContext, next) => {
    if (ctx.text && ctx.message) {
        const userInput = ctx.text; // Get the user's input
        console.log(`User input: ${userInput}`); // Log the input or process it as needed
        const messageId = ctx.message?.message_id;

        if (ctx.session?.messageStatus === "buy") {
            const tokenAddress = userInput;
            const tokenData = await getTokenData(tokenAddress);
            if (tokenData) {
                ctx.session.tokenToBuy = tokenData;
                const inline_keyboard =
                    ctx.session.walletBalances?.length === 0
                        ? getSwapLimitCaption(ctx.session.selectedMode)
                        : getBuyLimitSellCaption(ctx.session.selectedMode);
                ctx.reply(
                    `${tokenData.name} | ${tokenData.symbol} | ${tokenData.address}\n\nPrice: $${tokenData.price_usd}\nMarketCap: ${tokenData.market_cap_usd}`,
                    { reply_markup: { inline_keyboard: inline_keyboard } }
                );
            } else {
                ctx.reply(`Token address ${tokenAddress} not found`);
            }
            return next();
        }
        if (ctx.session?.messageStatus === "buy_x") {
            const amount = parseFloat(userInput || "0") * 1000000000;
            if (amount && amount <= ctx.session.solBalance * 1000000000) {
                if (ctx.session.walletIndex)
                    await apiSwap(
                        ctx.session.tokenToBuy.address,
                        amount,
                        ctx.session.user.wallets[ctx.session.walletIndex]
                            .secretKey,
                        `${ctx.session.user.userId}`,
                        true
                    );
            } else {
                ctx.reply("Insufficient SOL balance for this transaction.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "sell_x") {
            const percentage = parseFloat(userInput || "0");
            if (percentage > 0 && percentage <= 100) {
                if (ctx.session.walletIndex)
                    await apiSwap(
                        ctx.session.tokenToBuy.address,
                        percentage,
                        ctx.session.user.wallets[ctx.session.walletIndex]
                            .secretKey,
                        `${ctx.session.user.userId}`,
                        false
                    );
            } else {
                ctx.reply("Please enter a valid percentage between 1 and 100.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "limit_x") {
            const amount = parseFloat(userInput || "0");
            if (amount && amount <= ctx.session.solBalance) {
                ctx.session.tempLimitOrders = { amount };
                ctx.reply(
                    `Enter the target Market Cap (in USD) for your limit order:\nToken: ${ctx.session.tokenToBuy.name}\nAmount: ${amount} SOL\n\nExample: 1000000 (for $1M market cap)`
                );
                ctx.session.messageStatus = "limit_market_cap";
                return next();
            } else {
                ctx.reply("Please enter a valid amount within your balance.");
                return next();
            }
        }
        if (ctx.session?.messageStatus === "limit_market_cap") {
            const marketCap = parseFloat(userInput || "0");
            if (marketCap && marketCap > 0) {
                const amount = ctx.session.tempLimitOrders?.amount;
                ctx.session.tempLimitOrders = {
                    amount: amount,
                    marketCap: marketCap,
                };
                ctx.reply(
                    `Confirm Limit Buy Order:\nToken: ${ctx.session.tokenToBuy.name
                    }\nAmount: ${amount} SOL\nTarget Market Cap: $${marketCap.toLocaleString()}`,
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback(
                                "Confirm",
                                "confirm_limit_buy"
                            ),
                            Markup.button.callback("Cancel", "cl_cmd"),
                        ],
                    ])
                );
            } else {
                ctx.reply(
                    "Please enter a valid market cap value greater than 0."
                );
            }
            return next();
        }
        if (ctx.session?.messageStatus === "select_wallet") {
            const walletToUse = userInput;
            const walletIndex = ctx.session.user.wallets.findIndex(
                (item: { publicKey: string }) => item.publicKey === walletToUse
            );
            ctx.session.walletIndex = walletIndex;
            ctx.session.walletBalances = await getTokenAccounts(
                ctx.session.user.wallets[walletIndex].publicKey,
                connection
            );
            ctx.session.solBalance = await getSolBalance(
                ctx.session.user.wallets[walletIndex].publicKey
            );

            let text: string = `SOL Balance: ${ctx.session.solBalance} SOL\n\n`;

            if (ctx.session.walletBalances.length == 0) {
                text += "No other tokens found";
            } else {
                ctx.session.walletBalances.forEach((item) => {
                    text += `Token Name: ${item.tokenName}\nToken Address: ${item.tokenAddress}\nToken Balance: ${item.tokenBalance}\n\n`;
                });
            }
            const inline_keyboard = getStartCaption();

            ctx.reply(
                `${ctx.session.user.wallets[walletIndex].publicKey}\n\n${text}`,
                {
                    reply_markup: inline_keyboard,
                }
            );
            return next();
        }
        if (ctx.session?.messageStatus === "remove_order") {
            const orderIdToRemove = userInput;
            const userId = ctx.session.user.userId;
            const result = await removeLimitOrder(userId, orderIdToRemove);
            if (result?.status === 200) {
                //Get Limit Orders again
                let text: string = "Open orders:";
                const orders = await getLimitOrders(userId);
                const tokenPromises = orders.map(async (item) => {
                    const tokenInfo = await getTokenData(item.tokenAddress);
                    text += `\n🟢 Buy ${tokenInfo.name}
                    ├Trigger: $${item.marketCapToHit} Mcap
                    ├Slippage: 10%
                    ├Filled: 0.00 / 0.00 SOL
                    └Order ID: ${item.orderId}`;
                });
                // Wait for all token data to be fetched
                await Promise.all(tokenPromises);
                ctx.reply(
                    text,
                    Markup.inlineKeyboard([
                        Markup.button.callback(
                            "Remove order",
                            "remove_order_cmd"
                        ),
                    ])
                );
            } else if (result?.status === 404) {
                // Reply with Order not found message
                ctx.reply("Order Not Found");
            } else {
                // Reply with Internal sever error. Try again later message
                ctx.reply("Internal Server Error. Please try again later.");
            }
            return next();
        }
        if (ctx.session?.messageStatus === "add_channel_name") {
            const channelName = userInput;
            const channelTitle = await getChannelTitle(channelName);
            console.log("channelTitle=========>", channelTitle);
            if (!ctx.session.walletIndex) ctx.session.walletIndex = 0;
            if (channelTitle) {
                const saveChannel = await saveDefaultChannel(
                    ctx.session.user.userId,
                    channelTitle,
                    channelName,
                    ctx.session.user.wallets[ctx.session.walletIndex]
                );
                if (saveChannel?.status === 200) {
                    const channels = await fetchChannels(ctx.session.user.userId, ctx.session.user.wallets[ctx.session.walletIndex].publicKey);
                    const channel = channels.find((item: { url: string; }) => item.url === channelName);
                    ctx.session.channel = channel;
                    const inline_keyboard = getDefaultChannelSettings(channelTitle, channelName, channel.antiMEV, channel.autoBuy, channel.autoSell);
                    const text = getChannelText(channel);
                    ctx.reply(text, { reply_markup: { inline_keyboard: inline_keyboard } });
                } else {
                    ctx.reply("Something wrong! Try again later.")
                }
            } else {
                ctx.reply("Wrong channel name");
            }
            // if (channelTitle) {
            //     ctx.reply(`Channel Title: ${channelTitle}`)
            // } else {
            //     ctx.reply("Wrong channel name");
            // }
            return next();
        }
        if (ctx.session?.messageStatus === "channel_add_tp") {
            const tp = parseFloat(userInput);
            if (!ctx.session.tempChannelTP) ctx.session.tempChannelTP = {};
            ctx.session.tempChannelTP.tp = tp;
            await ctx.deleteMessage();
            await ctx.telegram.deleteMessage(ctx.session.user.userId, messageId - 1);
            if (ctx.session.tempChannelTP.tp && ctx.session.tempChannelTP.amount) {
                ctx.session.channel.autoSellSettings.push(ctx.session.tempChannelTP);
                console.log("ctxChannelAutoSellSettings============>", ctx.session.channel.autoSellSettings);
                const newData = {
                    autoSellSettings: ctx.session.channel.autoSellSettings
                }
                const channel: any = await updateChannel(ctx.session.channel._id, newData);
                const inline_keyboard = getAutoSellSettingsCaption(channel.autoSell, channel.autoSellSettings);
                await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: inline_keyboard });
            } else {
                const newButtons = [
                    Markup.button.callback(`T/P: ${tp}%`, "channel_add_tp"),
                    Markup.button.callback("Amount: -", "channel_add_tp_amount")
                ]
                const updatedInlineKeyboard = getAutoSellSettingsCaption(ctx.session?.channel.autoSell, ctx.session?.channel.autoSellSettings);

                // Insert new buttons at the second-to-last position
                updatedInlineKeyboard.splice(updatedInlineKeyboard.length - 2, 0, newButtons);
                await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: updatedInlineKeyboard });
            }
            return next();
        }
        if (ctx.session?.messageStatus === "channel_add_tp_amount") {
            const amount = parseFloat(userInput);
            if (!ctx.session.tempChannelTP) ctx.session.tempChannelTP = {};
            ctx.session.tempChannelTP.amount = amount;
            await ctx.deleteMessage();
            await ctx.telegram.deleteMessage(ctx.session.user.userId, messageId - 1);
            if (ctx.session.tempChannelTP.tp && ctx.session.tempChannelTP.amount) {
                ctx.session.channel.autoSellSettings.push(ctx.session.tempChannelTP);
                console.log("ctxChannelAutoSellSettings============>", ctx.session.channel.autoSellSettings);
                const newData = {
                    autoSellSettings: ctx.session.channel.autoSellSettings
                }
                const channel: any = await updateChannel(ctx.session.channel._id, newData);
                console.log("Channel=========>", channel);
                const inline_keyboard = getAutoSellSettingsCaption(channel.autoSell, channel.autoSellSettings);
                await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: inline_keyboard });
            } else {
                const newButtons = [
                    Markup.button.callback(`T/P: -`, "channel_add_tp"),
                    Markup.button.callback(`Amount: ${amount}%`, "channel_add_tp_amount")
                ]
                const updatedInlineKeyboard = getAutoSellSettingsCaption(ctx.session?.channel.autoSell, ctx.session?.channel.autoSellSettings);

                // Insert new buttons at the second-to-last position
                updatedInlineKeyboard.splice(updatedInlineKeyboard.length - 2, 0, newButtons);
                await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: updatedInlineKeyboard });
            }
            return next();
        }
        if (ctx.session?.messageStatus?.startsWith("channel_tp_")) {
            const tpOption = ctx.session.messageStatus.split("_")[2];
            const input = parseFloat(userInput);
            if (tpOption === "amount") {
                const tpAmountIndex = ctx.session.messageStatus.split("_")[3];
                if (input === 0) {
                    ctx.session.channel.autoSellSettings.splice(tpAmountIndex, 1);
                } else {
                    ctx.session.channel.autoSellSettings[tpAmountIndex].amount = input;
                }
            } else {
                const tpIndex = ctx.session.messageStatus.split("_")[2];
                if (input === 0) {
                    ctx.session.channel.autoSellSettings.splice(tpIndex, 1);
                } else {
                    ctx.session.channel.autoSellSettings[tpIndex].tp = input;
                }
            }
            const newData = {
                autoSellSettings: ctx.session.channel.autoSellSettings
            }
            const channel = await updateChannel(ctx.session.channel._id, newData);
            await ctx.deleteMessage();
            await ctx.telegram.deleteMessage(ctx.session.user.userId, messageId - 1);
            const inline_keyboard = getAutoSellSettingsCaption(channel.autoSell, channel.autoSellSettings);
            await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: inline_keyboard });
            return next();
        }
        if (ctx.session?.messageStatus?.startsWith("channel_")) {
            let newData: any;
            switch (ctx.session.messageStatus) {
                case "channel_max_investment":
                    const maxTotalInvestment = parseFloat(userInput);
                    newData = { maxTotalInvestment: maxTotalInvestment };
                    break;
                case "channel_auto_buy":
                    const autoBuyRetry = parseFloat(userInput);
                    newData = { autoBuyRetry: autoBuyRetry };
                    break;
                case "channel_retry_time":
                    const retryTime = parseFloat(userInput);
                    newData = { retryTime: retryTime };
                    break;
                case "channel_buy_amount":
                    const buyAmount = parseFloat(userInput);
                    newData = { buyAmount: buyAmount };
                    break;
                case "channel_slippage":
                    const slippage = parseFloat(userInput);
                    newData = { slippage: slippage };
                    break;
                case "channel_buy_mev_fee":
                    const buyTipMEV = parseFloat(userInput);
                    newData = { buyTipMEV: buyTipMEV };
                    break;
                case "channel_sell_mev_fee":
                    const sellTipMEV = parseFloat(userInput);
                    newData = { sellTipMEV: sellTipMEV };
                    break;
                case "channel_buy_gas_fee":
                    const buyGasFee = parseFloat(userInput);
                    newData = { buyGasFee: buyGasFee };
                    break;
                case "channel_sell_gas_fee":
                    const sellGasFee = parseFloat(userInput);
                    newData = { sellGasFee: sellGasFee };
                    break;
            }
            const channel = await updateChannel(ctx.session.channel._id, newData);
            const inline_keyboard = getDefaultChannelSettings(channel.name, channel.url, channel.antiMEV, channel.autoBuy, channel.autoSell);
            const text = getChannelText(channel)
            await ctx.deleteMessage();
            await ctx.telegram.deleteMessage(ctx.session.user.userId, messageId - 1);
            await ctx.telegram.editMessageText(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, text);
            await ctx.telegram.editMessageReplyMarkup(ctx.session.user.userId, ctx.session.channelSettingMessageId, undefined, { inline_keyboard: inline_keyboard });
            return next();
        }
        // You can send a response back to the user
        // ctx.reply(`You said: ${userInput}`);
    }
    return next(); // Call the next middleware or handler
});

const fetchUser = async (
    userId: Number | undefined,
    username: String | undefined
) => {
    const response = await axios.post(`${BACKEND_URL}api/users`, {
        userId: userId,
        username: username,
    });
    // console.log(response.data);
    return response.data;
};

const saveLimitOrder = async (
    userId: number,
    orderId: string,
    pubKey: string,
    privKey: string,
    tokenAddress: string,
    limitAmount: number | undefined,
    marketCapToHit: number | undefined,
    mode: "buy" | "sell"
) => {
    try {
        // console.log("marketCap==============>", marketCapToHit);
        const response = await axios.post(`${BACKEND_URL}api/addOrder`, {
            userId: userId,
            orderId: orderId,
            pubKey: pubKey,
            privKey: privKey,
            tokenAddress: tokenAddress,
            limitAmount: limitAmount,
            marketCapToHit: marketCapToHit,
            mode: mode,
        });
        return response.data;
    } catch (error) {
        console.error("Error in saveLimitOrder function");
    }
};

const getLimitOrders = async (userId: number): Promise<any[]> => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/getOrders`, {
            userId: userId,
        });
        console.log("getLimitOrders==============>", response.data);
        return response.data;
    } catch (error) {
        console.error("Error in getLimitOrder function");
        return [];
    }
};

const removeLimitOrder = async (userId: number, orderId: string) => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/removeOrder`, {
            userId: userId,
            orderId: orderId,
        });
        return response;
        // if (response.status === 200) {
        //     return "Removed";
        // } else if (response.status === 404) {
        //     return "Not found";
        // } else {
        //     return "Internal server error";
        // }
    } catch (error) {
        console.error(error);
        return;
    }
};

const fetchChannels = async (userId: number, publicKey: string) => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/getChannels`, {
            userId: userId,
            publicKey: publicKey
        });
        if (response.status === 200) {
            return response.data
        } else {
            return null;
        }
    } catch (error) {
        // console.error(error);
        return null;
    }
};

const saveDefaultChannel = async (userId: number, name: string | null, url: string, wallet: any) => {
    const data = {
        userId: userId,
        name: name,
        url: url,
        autoBuy: false,
        autoSell: false,
        autoSellSettings: [
            { tp: 400, amount: 20 },
            { tp: 500, amount: 20 },
            { tp: 800, amount: 20 },
            { tp: 1000, amount: 10 },
            { tp: 1500, amount: 10 },
            { tp: 2500, amount: 5 },
            { tp: 4900, amount: 5 },
        ],
        buyAmount: 0.1,
        maxTotalInvestment: "No Limit",
        currentInvestment: 0,
        autoBuyRetry: 1,
        retryTime: 30,
        slippage: 10,
        antiMEV: false,
        buyTipMEV: 0.01,
        sellTipMEV: 0.01,
        buyGasFee: 0.005,
        sellGasFee: 0.005,
        wallet: wallet
    };
    try {
        const response = await axios.post(`${BACKEND_URL}api/addChannel`, data);
        return response;
    } catch (error) {
        console.error(error);
        return;
    }
}

const getChannelTitle = async (channelUsername: string): Promise<string | null> => {
    try {
        // Get chat information using the channel username
        const chat = await bot.telegram.getChat(channelUsername);

        // Check if the chat is a channel
        if (chat && chat.type === 'channel') {
            console.log(`Channel Title: ${chat.title}`);
            return chat.title; // Return the title of the channel
        } else {
            console.log('This chat is not a channel or does not have a title.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching channel title:', error);
        return null;
    }
}

const updateChannel = async (_id: string, newData: any) => {
    try {
        const response = await axios.post(`${BACKEND_URL}api/updateChannel`, {
            _id: _id,
            newData: newData
        });
        if (response.status === 200) {
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
};


// // Define Inline Keyboards

const getStartCaption = () => {
    return {
        inline_keyboard: [
            [
                Markup.button.callback("💰 Buy", "buy_cmd"),
                Markup.button.callback("📈 Sell & Manage", "sell_cmd"),
            ],
            [
                Markup.button.callback("💼 Choose wallet", "wallets_cmd"),
                Markup.button.callback("🔑 Export Private Key", "privkey_cmd"),
            ],
            [
                Markup.button.callback("📊 Copy Trade", "copy_trade_cmd"),
                Markup.button.callback("📞 Call Channels", "call_channels"),
            ],
            [Markup.button.callback("📉 Limit Orders", "limit_orders")],
            [
                Markup.button.callback("❓ Help", "help_cmd"),
                Markup.button.callback("⚙️ Settings", "settings_cmd"),
            ],
            [
                Markup.button.callback("📌 Pin", "pin_cmd"),
                Markup.button.callback("🔄 Refresh", "refresh_cmd"),
            ],
        ],
    };
};

const getSwapLimitCaption = (mode?: "swap" | "limit") => {
    return [
        [Markup.button.callback("Cancel", "cl_cmd")],
        [
            Markup.button.callback(
                mode === "swap" ? "✅ Swap" : "Swap",
                "swap_opt"
            ),
            Markup.button.callback(
                mode === "limit" ? "✅ Limit" : "Limit",
                "limit_opt"
            ),
        ],
        ...(mode === "swap"
            ? [
                [
                    Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                    Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                    Markup.button.callback("Buy X SOL", "buy_x"),
                ],
            ]
            : [
                [
                    Markup.button.callback("Limit Buy 5.0 SOL", "limit_50"),
                    Markup.button.callback("Limit Buy X SOL", "limit_x"),
                ],
            ]),
        [Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

const getBuyLimitSellCaption = (mode?: "swap" | "limit") => {
    return [
        [
            Markup.button.callback("🏠 Home", "home_cmd"),
            Markup.button.callback("Close", "cl_cmd"),
        ],
        [
            Markup.button.callback(
                mode === "swap" ? "✅ Swap" : "Swap",
                "swap_opt"
            ),
            Markup.button.callback(
                mode === "limit" ? "✅ Limit" : "Limit",
                "limit_opt"
            ),
        ],
        ...(mode === "swap"
            ? [
                [
                    Markup.button.callback("Buy 1.0 SOL", "buy_10"),
                    Markup.button.callback("Buy 0.5 SOL", "buy_05"),
                    Markup.button.callback("Buy X SOL", "buy_x"),
                ],
                [
                    Markup.button.callback("◀️ Prev", "prev_opt"),
                    Markup.button.callback("Token To Buy", "no_cmd"),
                    Markup.button.callback("Next ▶️", "next_opt"),
                ],
                [
                    Markup.button.callback("Sell 25%", "sell_25"),
                    Markup.button.callback("Sell 100%", "sell_100"),
                    Markup.button.callback("Sell X %", "sell_x"),
                ],
            ]
            : [
                [
                    Markup.button.callback("Limit Buy 5.0 SOL", "limit_50"),
                    Markup.button.callback("Limit Buy X SOL", "limit_x"),
                ],
                [
                    Markup.button.callback("◀️ Prev", "prev_opt"),
                    Markup.button.callback("Token To Buy", "no_cmd"),
                    Markup.button.callback("Next ▶️", "next_opt"),
                ],
                [
                    Markup.button.callback("Limit Sell 25%", "limit_sell_25"),
                    Markup.button.callback("Limit Sell X %", "limit_sell_x"),
                ],
            ]),
        [Markup.button.callback("Refresh", "refresh_cmd")],
    ];
};

const getChannlesCaption = (channels: any[]) => {
    let inline_keyboard = [
        [
            Markup.button.callback("🏠 Home", "home_cmd"),
            Markup.button.callback("➕ Add Channel", "add_channel"),
        ],
    ];
    channels.forEach((channel) => {
        inline_keyboard.push([Markup.button.callback(`📢 ${channel.name}`, `channel_setting_${channel.url}`)]);
    });
    return inline_keyboard
};

const getDefaultChannelSettings = (name: string, url: string, antiMEV: boolean, autoBuy: boolean, autoSell: boolean) => {
    return [
        [Markup.button.callback(name, "name")],
        [Markup.button.callback(url, "url")],
        [
            autoBuy === true ?
                Markup.button.callback("🟢 AutoBuy", "channel_is_auto_buy_off")
                : Markup.button.callback("🔴 AutoBuy", "channel_is_auto_buy_on"),
            autoSell === true ?
                Markup.button.callback("🟢 AutoSell", "channel_auto_sell_settings")
                : Markup.button.callback("🔴 AutoSell", "channel_auto_sell_settings")],
        [Markup.button.callback("Max Total Investment", "channel_max_investment")],
        [Markup.button.callback("Auto Buy Retry", "channel_auto_buy"), Markup.button.callback("Retry Time", "channel_retry_time")],
        [Markup.button.callback("Buy Amount", "channel_buy_amount"), Markup.button.callback("Slippage", "channel_slippage")],
        [
            antiMEV === true ?
                Markup.button.callback("🟢 Anti-MEV", "channel_antimev_off")
                : Markup.button.callback("🔴 Anti-MEV", "channel_antimev_on")
        ],
        [Markup.button.callback("Buy Tip MEV Fee", "channel_buy_mev_fee"), Markup.button.callback("Sell Tip MEV Fee", "channel_sell_mev_fee")],
        [Markup.button.callback("Buy Gas Fee", "channel_buy_gas_fee"), Markup.button.callback("Sell Gas Fee", "channel_sell_gas_fee")]
    ]
};

const getAutoSellSettingsCaption = (isAutoSell: boolean, tp: any[]) => {
    let inline_keyboard = [
        [isAutoSell === true ?
            Markup.button.callback("✅ Active", "channel_is_auto_sell_off")
            : Markup.button.callback("🟠 Paused", "channel_is_auto_sell_on")
        ]
    ];
    tp.forEach((item) => {
        inline_keyboard.push([
            Markup.button.callback(`T/P: ${item.tp}%`, `channel_tp_${tp.indexOf(item)}`),
            Markup.button.callback(`Amount: ${item.amount}%`, `channel_tp_amount_${tp.indexOf(item)}`)
        ]);
    });
    inline_keyboard.push(
        [Markup.button.callback("Add", "channel_add_tp_button")],
        [Markup.button.callback("Cancel", "cl_cmd")]
    );
    return inline_keyboard;
};

const generateOrderId = () => {
    const now = new Date();

    // Get the components of the date
    const year = String(now.getUTCFullYear()).slice(-2); // Last two digits of the year
    const month = String(now.getUTCMonth() + 1).padStart(2, "0"); // Month (0-11)
    const day = String(now.getUTCDate()).padStart(2, "0"); // Day of the month
    const hours = String(now.getUTCHours()).padStart(2, "0"); // Hours (0-23)
    const minutes = String(now.getUTCMinutes()).padStart(2, "0"); // Minutes
    const seconds = String(now.getUTCSeconds()).padStart(2, "0"); // Seconds

    // Construct the order ID
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const getChannelText = (channel: any) => {
    const text =
        `Name: ${channel.name}` +
        `\nusername: ${channel.url}` +
        `\n\n📌 Auto Buy & Sell` +
        `\nAuto Buy: ${channel.autoBuy === false ? "❌ Disabled" : "⭕️ Enabled"}` +
        `\nAuto Sell: ${channel.autoSell === false ? "❌ Disabled" : "⭕️ Enabled"}` +
        `\nAmount: ${channel.buyAmount}` +
        `\nMax Total Investment: ${channel.maxTotalInvestment}` +
        `\nCurrent Investment: ${channel.currentInvestment}` +
        `\nAuto Buy Retry: ${channel.autoBuyRetry}` +
        `\nRetry Time: ${channel.retryTime}` +
        `\nSlippage: ${channel.slippage}` +
        `\nAnti MEV: ${channel.antiMEV}` +
        `\nBuy Tip MEV Fee: ${channel.buyTipMEV}` +
        `\nSell Tip MEV Fee: ${channel.sellTipMEV}` +
        `\nBuy Gas Fee: ${channel.buyGasFee}` +
        `\nSell Gas Fee: ${channel.sellGasFee}`;
    return text;
};

// Start the bot
bot.launch()
    .then(() => {
        console.log("Bot is running...");
    })
    .catch((error) => {
        console.error("Error starting bot:", error);
    });
