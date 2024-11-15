import { Report, ReportStatus } from '../models/report';
import { ChatModel, ReportModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { dayjs } from '../utils/dayjs';
import { Metadata, PaginatedResult, Pagination, ReturnValue, Status } from '../utils/retVal';
import { ReportDTO, ReportQueryDTO } from '../validations/report';

/**
 * Get all reports.
 */
export const getAllReports = async (query: ReportQueryDTO): Promise<ReturnValue<PaginatedResult<Report>>> => {
    try {
        // build the filter based on the validated query parameters
        const filter: any = {};

        if (query.reportedBy) {
            const reportedByUser = await UserModel.findOne({ twitterId: query.reportedBy });
            if (reportedByUser) {
                filter.reportedBy = reportedByUser._id;
            }
        }

        if (query.reportedOn) {
            const reportedOnUser = await UserModel.findOne({ twitterId: query.reportedOn });
            if (reportedOnUser) {
                filter.reportedOn = reportedOnUser._id;
            }
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.startTimestamp && query.endTimestamp) {
            filter.createdTimestamp = {
                $gte: query.startTimestamp,
                $lte: query.endTimestamp,
            };
        } else if (query.startTimestamp) {
            filter.createdTimestamp = { $gte: query.startTimestamp };
        } else if (query.endTimestamp) {
            filter.createdTimestamp = { $lte: query.endTimestamp };
        }

        // get the total count of reports for pagination metadata
        const totalReports = await ReportModel.countDocuments(filter);

        // get the reports with pagination
        const reports = await ReportModel.find(filter)
            .skip((query.page - 1) * query.limit)
            .limit(query.limit);

        // prepare pagination metadata
        const metadata: Metadata = {
            page: query.page,
            limit: query.limit,
            total: totalReports,
            count: reports.length,
            hasNext: (query.page - 1) * query.limit + reports.length < totalReports,
            hasPrev: query.page > 1,
        };

        return {
            status: Status.SUCCESS,
            message: `(getAllReports) Reports fetched successfully`,
            data: {
                metadata,
                result: reports,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getAllReports) Error: ${err.message}`,
        };
    }
};

/**
 * Get report by id.
 */
export const getReportById = async (reportId: string): Promise<ReturnValue> => {
    try {
        const report = await ReportModel.findById(reportId);
        if (!report) {
            return { status: Status.ERROR, message: 'Report not found.' };
        }

        return { status: Status.SUCCESS, message: 'Report fetched successfully.', data: report };
    } catch (err: any) {
        return { status: Status.ERROR, message: `Error: ${err.message}` };
    }
};

/**
 * Delete report.
 */
export const deleteReport = async (reportId: string): Promise<ReturnValue> => {
    try {
        const report = await ReportModel.findByIdAndDelete(reportId);
        if (!report) {
            return { status: Status.ERROR, message: 'Report not found.' };
        }
        return { status: Status.SUCCESS, message: 'Report deleted successfully.' };
    } catch (err: any) {
        return { status: Status.ERROR, message: `Error: ${err.message}` };
    }
};

/**
 * Submit a report.
 */
export const submitReport = async (data: ReportDTO): Promise<ReturnValue> => {
    try {
        const reportedBy = await UserModel.findOne({ twitterId: data.reportedBy });
        if (!reportedBy) {
            return {
                status: Status.ERROR,
                message: '(submitReport) Reporter User not found.',
            };
        }

        const reportedOn = await UserModel.findOne({ twitterId: data.reportedOn });
        if (!reportedOn) {
            return {
                status: Status.ERROR,
                message: '(submitReport) Reported User not found.',
            };
        }

        const reportPayload: Report = {
            _id: generateObjectId(),
            reportedBy: reportedBy._id,
            reportedOn: reportedOn._id,
            categories: data.categories,
            reason: data.reason,
            createdTimestamp: dayjs().unix(),
            status: ReportStatus.PENDING,
        };

        // If data contain chatId data, add the data into ReportModel
        if (data.chatId) {
            const chat = await ChatModel.findOne({ _id: data.chatId });
            if (!chat) {
                return {
                    status: Status.ERROR,
                    message: '(submitReport) Reporter User chat log not found.',
                }
            }

            reportPayload.chatId = data.chatId;
        }

        // Create the report with the complete payload
        const report = await ReportModel.create(reportPayload);

        if (!report) {
            return {
                status: Status.ERROR,
                message: '(submitReport) Report submission failed.',
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(submitReport) Report submitted successfully`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(submitReport) Error: ${err.message}`,
        };
    }
};

/**
 * Update a report.
 */
export const updateReport = async (reportId: string, updates: Partial<Report>): Promise<ReturnValue> => {
    try {
        const report = await ReportModel.findById(reportId);
        if (!report) {
            return {
                status: Status.ERROR,
                message: '(updateReport) Report not found.',
            };
        }

        if (updates.status) report.status = updates.status;
        if (updates.categories) report.categories = updates.categories;
        if (updates.reason) report.reason = updates.reason;

        await report.save();

        return {
            status: Status.SUCCESS,
            message: '(updateReport) Report updated successfully.',
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateReport) Error: ${err.message}`,
        };
    }
};
