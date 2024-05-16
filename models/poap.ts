/****************
 * POAP-RELATED MODELS
 ****************/

/**
 * Represents a Proof of Attendance Protocol (POAP).
 */
interface POAP {
    /** the event name */
    name: string;
    /** the event description */
    description: string;
    /** the event's codes */
    codes: POAPCode[];
    /** the event's attendances */
    attendances: POAPAttendance[];
    /** the event start timestamp */
    startTimestamp: number;
    /** the event end timestamp */
    endTimestamp: number;
}

/**
 * Represents POAP Code information.
 */
interface POAPCode {
    /** redeemable keyword code */
    keyword: string;
    /** the POAP code expiration timestamp */
    expirationTimestamp: number;
}

/**
 * Represents POAP Attendance (the user who redeem the code).
 */
interface POAPAttendance {
    /** the user that redeem the code (database user IDs) */
    userId: string;
    /** attendance timestamp */
    attendanceTimestamp: number;
}
