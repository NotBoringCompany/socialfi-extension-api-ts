import express from 'express';
import { submitReport, getAllReports, getReportById, deleteReport, updateReport } from '../api/report';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { reportQueryDTO, reportDTO } from '../validations/report';

const router = express.Router();

/**
 * @route GET /report/get_all_reports
 * @description Retrieves a paginated list of all reports based on query parameters.
 * @param {ReportQueryDTO} req.query - the query parameters for filtering and pagination.
 */
router.get('/', async (req, res) => {
    try {
        // Authentication check
        const auth = await validateRequestAuth(req, res, 'get_all_reports');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        // Validate the query parameters
        const validation = reportQueryDTO.safeParse(req.query);
        if (!validation.success) {
            return res.status(Status.ERROR).json({
                status: Status.ERROR,
                message: 'Invalid query parameters.',
                errors: validation.error.format(),
            });
        }

        const { status, message, data } = await getAllReports(validation.data);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: `(getAllReports) Error: ${err.message}`,
        });
    }
});

/**
 * @route GET /report/get_report_detail/:reportId
 * @description Retrieves a report by its ID.
 * @param {string} reportId - the report ID.
 */
router.get('/get_report_detail/:reportId', async (req, res) => {
    const { reportId } = req.params;

    try {
        // Authentication check
        const auth = await validateRequestAuth(req, res, 'get_report_detail');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const { status, message, data } = await getReportById(reportId);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: `(getReportById) Error: ${err.message}`,
        });
    }
});

/**
 * @route DELETE /report/delete_report/:reportId
 * @description Deletes a report by its ID.
 * @param {string} reportId - the report ID.
 */
router.delete('/delete_report/:reportId', async (req, res) => {
    const { reportId } = req.params;

    try {
        // Authentication check
        const auth = await validateRequestAuth(req, res, 'delete_report');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const { status, message } = await deleteReport(reportId);

        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: `(deleteReport) Error: ${err.message}`,
        });
    }
});

/**
 * @route POST /report/submit_report
 * @description Submit a new report.
 * @param {ReportDTO} req.body - the report data.
 */
router.post('/submit_report', async (req, res) => {
    try {
        // Authentication check
        const auth = await validateRequestAuth(req, res, 'submit_report');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        // Validate the report submission data
        const validation = reportDTO.safeParse(req.body);
        if (!validation.success) {
            return res.status(Status.ERROR).json({
                status: Status.ERROR,
                message: 'Invalid report data.',
                errors: validation.error.format(),
            });
        }

        const { status, message } = await submitReport(validation.data);

        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: `(submitReport) Error: ${err.message}`,
        });
    }
});

/**
 * @route PATCH /report/update_report/:reportId
 * @description Update an existing report.
 * @param {string} reportId - the report ID.
 * @param {Partial<Report>} req.body - the data to update.
 */
router.patch('/update_report/:reportId', async (req, res) => {
    const { reportId } = req.params;
    const updates = req.body;

    try {
        // Authentication check
        const auth = await validateRequestAuth(req, res, 'update_report');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const { status, message } = await updateReport(reportId, updates);

        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: `(updateReport) Error: ${err.message}`,
        });
    }
});

export default router;
