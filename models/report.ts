/****************
 * REPORT-RELATED MODELS
 ****************/

import { User } from './user';

export interface Report {
    _id?: string;
    /** the person who reported the user */
    reportedBy: string | User;
    /** the person who get reported */
    reportedOn: string | User;
    /** report categories, such as 'Spam', 'Cheat' or 'Harassment' */
    categories: string[];
    /** the reason why the user get reported */
    reason: string;
    status: ReportStatus;
    createdTimestamp: number;
}

export enum ReportStatus {
    PENDING = 'Pending',
    RESOLVED = 'Resolved',
    REJECTED = 'Rejected',
}
