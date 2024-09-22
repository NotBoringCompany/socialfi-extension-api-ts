/**
 * Status enum for `ReturnValue`.
 */
export enum Status {
    SUCCESS=200,
    BAD_REQUEST=400,
    INVALID_PAYLOAD=422,
    UNAUTHORIZED=401,
    ERROR=500
}

/**
 * `ReturnValue` returns a status, message and optionally data.
 */
export interface ReturnValue<T = any> {
    /** the status (either SUCCESS or ERROR) */
    status: Status
    /** a return message (can be anything, usually to add on to the status) */
    message: string
    /** the data if SUCCESS is returned. usually an object containing required values */
    data?: T
}

export interface ReturnWithPagination<T = any> extends ReturnValue<T> {
    meta?: {
        /** The total number of pages. This is calculated by dividing the total number of documents by the page size. */
        totalPage: number
        /** The number of documents per page. This is the number of documents returned per page. */
        pageSize: number
        /** The current page number. This is the page number that the user is currently viewing. */
        currentPage: number
        /** The total number of documents. This is the total number of documents in the database. */
        totalDocument: number
        /** the document that has the next page */
        isHasNext: boolean
    }
}
