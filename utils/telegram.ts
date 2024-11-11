import crypto from 'crypto';

type TelegramCreds = {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
    allows_write_to_pm: boolean;
};

export type TelegramAuthData = {
    query_id: string;
    user: TelegramCreds;
    auth_date: string;
    hash: string;
};

export const validateTelegramData = (telegramInitData: string) => {
    const initData = new URLSearchParams(telegramInitData);

    initData.sort();

    const hash = initData.get('hash');
    initData.delete('hash');

    const dataToCheck = [...initData.entries()].map(([key, value]) => key + '=' + value).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest('hex');

    const _hash = crypto.createHmac('sha256', secretKey).update(dataToCheck).digest('hex');

    return hash === _hash;
};

export const parseTelegramData = (initData: string): TelegramAuthData | null => {
    const parsedData = new URLSearchParams(initData);
    const data: any = {};

    parsedData.forEach((value, key) => {
        data[key] = value;
    });

    return {
        ...data,
        user: JSON.parse(data.user),
    };
};
