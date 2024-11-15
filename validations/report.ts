import { z } from 'zod';
import { Pagination } from '../utils/retVal';

export const reportDTO = z.object({
    reportedBy: z.string().optional(),
    reportedOn: z.string(),
    categories: z.array(z.string()).min(1, 'At least one category is required'),
    reason: z.string().min(1, 'Reason is required'),
});

export interface ReportDTO {
    reportedBy?: string;
    reportedOn?: string;
    categories?: string[];
    reason?: string;
}

export const reportQueryDTO = z.object({
    reportedOn: z.string().optional(),
    reportedBy: z.string().optional(),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().optional().default(10),
    status: z.enum(['Pending', 'Resolved', 'Rejected']).optional(),
    startTimestamp: z.number().int().positive().optional(),
    endTimestamp: z.number().int().positive().optional(),
});

export interface ReportQueryDTO extends Pagination {
    status?: string;
    reportedBy?: string;
    reportedOn?: string;
    startTimestamp?: number;
    endTimestamp?: number;
}
