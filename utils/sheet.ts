import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export async function getGoogleSheetsClient() {
    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_EMAIL,
        key: process.env.GOOGLE_SERVICE_KEY,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

    const googleSheets = google.sheets({ version: 'v4', auth });
    return googleSheets;
}

interface SheetData {
    [key: string]: string | number | boolean | null;
}

export async function readSheet(spreadsheetId: string, range: string): Promise<SheetData[]> {
    try {
        const sheets = await getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return [];
        }

        // Assume the first row is the header
        const headers = rows[0];
        const data: SheetData[] = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowData: SheetData = {};

            headers.forEach((header: string, index: number) => {
                rowData[header] = row[index] || null;
            });

            data.push(rowData);
        }

        return data;
    } catch (err) {
        console.log(err)
        throw new Error('Failed to load the sheet');
    }
}
