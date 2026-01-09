export enum UIState {
  LANDING = 'LANDING',
  SINGLEPLAYER = 'SINGLEPLAYER',
  MULTIPLAYER = 'MULTIPLAYER',
  MP_CREATE = 'MP_CREATE',
  MP_JOIN = 'MP_JOIN',
  MAP_SELECT = 'MAP_SELECT',
  IN_GAME = 'IN_GAME'
}

export interface UIManagerInterface {
  transition(to: UIState, data?: any): void;
  showMessage(msg: string): void;
}
