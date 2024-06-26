export type Creds = {
    id: string;
    name: string;
    username: string;
    method: string;
    role: number;
};

export type Authenticated = {
    creds: Creds;
    token: string;
};
