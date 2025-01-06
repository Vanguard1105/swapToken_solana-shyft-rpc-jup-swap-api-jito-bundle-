import { Connection, GetProgramAccountsFilter, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { parseTokenAccountResp } from "@raydium-io/raydium-sdk-v2";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const X_CG_PRO_API_KEY = process.env.X_CG_PRO_API_KEY || "CG-8HSwLsg9TepS8SYboZLeS5oq";

const rpcEndpoint = "https://mainnet.helius-rpc.com/?api-key=324aa379-1b3f-45ab-97de-96c11ce7fb24";
export const connection = new Connection(rpcEndpoint);

// const walletToQuery = "6ezb8pPCz2LZKy97cMcZunVENT3b6u6HeMDub3KpNSJ5"; //example: vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg

interface TokenBalance {
    tokenAddress: string;
    tokenName: string;
    tokenBalance: number;
}

export async function getTokenAccounts(wallet: string, solanaConnection: Connection): Promise<TokenBalance[]> {
    let walletBalances: TokenBalance[] = [];
    const filters: GetProgramAccountsFilter[] = [
        {
            dataSize: 165, //size of account (bytes)
        },
        {
            memcmp: {
                offset: 32, //location of our query in the account (bytes)
                bytes: wallet, //our search criteria, a base58 encoded string
            },
        },
    ];
    const accounts = await solanaConnection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        { filters: filters }
    );
    console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);
    for (const [i, account] of accounts.entries()) {
        // Parse the account data
        const parsedAccountInfo: any = account.account.data;
        console.log("parsedAccountInfo================>", parsedAccountInfo["parsed"]);

        const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];

        const tokenData = await getTokenData(mintAddress);
        const tokenName = tokenData.name;

        // Log results
        console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
        console.log(`--Token Mint: ${mintAddress}`);
        console.log(`--Token Name: ${tokenName}`);
        console.log(`--Token Balance: ${tokenBalance}`);

        if (tokenBalance > 0) {
            walletBalances.push({
                tokenAddress: mintAddress,
                tokenName: tokenName,
                tokenBalance: tokenBalance,
            });
        }
    }
    // console.log("walletBalances----------->", walletBalances);

    return walletBalances;
}

export async function getTokenData(tokenAddress: string | undefined) {
    try {
        console.log("Getting Token Data");
        const options = {
            headers: { accept: "application/json", "x-cg-pro-api-key": X_CG_PRO_API_KEY },
        };
        const url = `https://pro-api.coingecko.com/api/v3/onchain/networks/solana/tokens/${tokenAddress}`;
        const response = await axios.get(url, options);

        if (!response.data || !response.data.data || !response.data.data.attributes) {
            throw new Error("Invalid token data structure received");
            // bot.sendMessage(chatId, "Invalid token data structure received");
        }

        // console.log(response.data.data);
        return response.data.data.attributes;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                return null;
                // throw new Error(`Token address ${tokenAddress} not found`);
            }
            throw new Error(`Failed to fetch token data: ${error.message}`);
        }
        throw new Error(`Error getting token data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

// export async function swapToken() {}

export const fetchTokenAccountData = async (owner: Keypair) => {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey);
    const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID });
    const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
    });
    const tokenAccountData = parseTokenAccountResp({
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    });
    return tokenAccountData;
};

export async function getSolBalance(walletAddress: string) {
    // Connect to the Solana mainnet
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

    // Create a PublicKey object from the wallet address
    const publicKey = new PublicKey(walletAddress);

    try {
        // Get the balance in lamports
        const balance = await connection.getBalance(publicKey);
        // Convert lamports to SOL (1 SOL = 1e9 lamports)
        console.log(`Balance: ${(balance / 1e9).toFixed(9)} SOL`);
        return (balance / 1e9).toFixed(9);
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

// getSolBalance('6ezb8pPCz2LZKy97cMcZunVENT3b6u6HeMDub3KpNSJ5');

// getTokenAccounts(walletToQuery, solanaConnection);
