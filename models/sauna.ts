export interface Sauna {
  userConnected: number;
  userDetail: SaunaUserDetail[]
}
export interface SaunaUserDetail {
  userId: string
}
// global event
export enum EventSauna {
  USER_COUNT = "userCount",
  USER_JOIN = "userJoin",
  START_REST = "startRest",
  STOP_REST = "stopRest",
}

export enum  SaunaGlobalKey {
  USERS = "userList",
  CONNECTED = "connected"
}