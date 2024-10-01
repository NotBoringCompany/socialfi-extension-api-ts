export interface Sauna {
  userConnected:number;
  userDetail:SaunaUserDetail[]
}
export interface SaunaUserDetail {
  userId: string
}
// global event
export enum EventSauna {
  USER_CONNECTED = "userConnected",
  CONNECTED = "connected",
  START_REST = "startRest",
  STOP_REST = "stopRest",
}
