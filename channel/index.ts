import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { NewMessageEvent } from "telegram/events";
import fs from "fs";
import readline from "readline";
import Channel from "../src/models/Channel";
import { apiSwap, bot } from "../bot/swap";

const apiId = 11682918;
const apiHash = "8d78b2d673ec4a66ad7558f9b123da06";
const sessionFilePath = './session.txt'; // Path to save the session string

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export async function startTelegramClient(channel: string[]) {
    let stringSession = new StringSession("");

    // Load the session string from the file if it exists
    if (fs.existsSync(sessionFilePath)) {
        const savedSession = fs.readFileSync(sessionFilePath, 'utf-8');
        stringSession = new StringSession(savedSession);
    }

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your number: ", resolve)
            ),
        password: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your password: ", resolve)
            ),
        phoneCode: async () =>
            new Promise((resolve) =>
                rl.question("Please enter the code you received: ", resolve)
            ),
        onError: (err) => console.log(err),
    });

    console.log("You should now be connected.");
    console.log(client.session.save()); // Save this string to avoid logging in again

    // Save the session string to a file
    fs.writeFileSync(sessionFilePath, `${client.session.save()}`);

    // Start listening for new messages in a specific channel
    // const channel = 'mtbbotchanneltest'; // Replace with your channel username or ID
    async function handler(event: NewMessageEvent) {
        const messageText = event.message.message;
        const pattern = /\b[A-Za-z0-9]{43,}\b/;
        const tokenAddress = messageText.match(pattern) || [];
        if (tokenAddress && tokenAddress.length > 0) {
            let temp: any = event.message.chat
            const channelUsername = temp?.username;
            const enabledChannels: any[] = await Channel.find(
                { url: `@${channelUsername}`, autoBuy: true }
            );
            enabledChannels.forEach(async (item) => {
                if (item.maxTotalInvestment === "No Limit" || item.currentInvestment + item.buyAmount < item.maxTotalInvestment) {
                    await apiSwap(tokenAddress[0], item.buyAmount, item.wallet.secretKey, item.userId, true, item.slippage, item);
                } else {
                    bot.telegram.sendMessage(item.userId, "⚠️ Your current investment has reached the maximum total investment limit. Please review your investment strategy or consider adjusting your allocations.")
                }
            });
            console.log("Token Address===========>", tokenAddress[0]);
            console.log("Channels to buy the token==================>", enabledChannels);
        } else {
            console.log("Token Address not found");
        }
    }

    client.addEventHandler(handler, new NewMessage({ chats: channel }));
}