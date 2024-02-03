/**
 * Status enum for `ReturnValue`.
 */
export enum Status {
    SUCCESS=200,
    BAD_REQUEST=400,
    UNAUTHORIZED=401,
    ERROR=500
}

/**
 * `ReturnValue` returns a status, message and optionally data.
 */
export interface ReturnValue {
    /** the status (either SUCCESS or ERROR) */
    status: Status
    /** a return message (can be anything, usually to add on to the status) */
    message: string
    /** the data if SUCCESS is returned. usually an object containing required values */
    data?: any
}
