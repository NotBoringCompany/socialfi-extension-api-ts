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
    /** the event create timestamp */
    createTimestamp: number;
}

/**
 * Represents the POAP's code information.
 */
interface POAPCode {
    /** redeemable keyword code */
    keyword: string;
    /** the POAP code's expiration timestamp */
    expirationTimestamp: number;
    /** redeemable limit, (-1) on infinite */
    limit: number;
}

/**
 * Represents the POAP's attendance (the user who redeemed the code).
 */
interface POAPAttendance {
    /** the user that redeemed the code (twitter ID) */
    twitterId: string;
    /** redeemed code */
    keyword: string;
    /** attendance timestamp */
    attendanceTimestamp: number;
}
