/**
 * Represents a ban on a user.
 *
 * @property {string} bandId - The unique ID of the ban.
 * @property {string} userId - The user ID of the banned user.
 * @property {BanType} banType - The type of the ban.
 * @property {Date} startDate - The timestamp when the ban starts.
 * @property {Date} endDate - The timestamp when the ban ends.
 * @property {string} reason - The reason for the ban.
 * @property {string} adminId - The user ID of the admin who banned the user.
 * @property {BanStatus} status - The status of the ban.
 * @property {Date} createdAt - The timestamp when the ban was created.
 * @property {Date} updatedAt - The timestamp when the ban was last updated.
 */
export interface Ban {
  bandId: string;
  userId: string;
  banType: BanType;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  adminId: string;
  status: BanStatus;
  createdAt: Date;
  updatedAt: Date;
}
export enum BanType {
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent',
}
export enum BanStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}
