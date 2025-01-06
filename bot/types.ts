import { Context } from 'telegraf';

export interface BotContext extends Context {
    match?: RegExpMatchArray;
    session?: {
        messageStatus?: string;
        tokenToBuy?: any;
        user?: any;
        walletBalances?: any[];
        solBalance?: any;
        tokenIndex?: number;
        walletIndex? :number;
        selectedMode?: 'swap' | 'limit';
        tempLimitOrders?: {
            amount?: number;
            marketCap?: number;
        };
        channel?: any;
        channelSettingMessageId?: number;
        tempChannelTP?: {
            tp?: number;
            amount?: number;
        }
    };
}

export interface TokenData {
    name: string;
    symbol: string;
    address: string;
    price_usd: number;
    market_cap_usd: number;
}