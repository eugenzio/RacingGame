import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export interface PlayerInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  isHost: boolean;
  colorIndex?: number;
}

// F1-inspired team colors
export const CAR_COLORS = [
  '#dc0000',  // Ferrari Red
  '#0066cc',  // Williams Blue
  '#ff8700',  // McLaren Papaya
  '#00d2be',  // Mercedes Teal
  '#0600ef',  // Red Bull Navy
  '#006f62',  // Aston Martin Green
  '#b6babd',  // Haas Silver
  '#2b4562',  // Alpha Tauri Navy
  '#900000',  // Alfa Romeo Maroon
  '#005aff',  // Alpine Blue
];

export interface RoomInfo {
  code: string;
  isHost: boolean;
  players: Record<string, PlayerInfo>;
}

type PlayerJoinCallback = (player: PlayerInfo) => void;
type PlayerLeaveCallback = (playerId: string) => void;
type RaceStartCallback = () => void;

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private socket: Socket | null = null;

  roomCode: string | null = null;
  isHost: boolean = false;
  username: string = 'Player';
  players: Map<string, PlayerInfo> = new Map();
  private nextColorIndex: number = 0;

  private playerJoinCallbacks: PlayerJoinCallback[] = [];
  private playerLeaveCallbacks: PlayerLeaveCallback[] = [];
  private raceStartCallbacks: RaceStartCallback[] = [];

  private constructor() {}

  static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket?.id);
    });

    this.socket.on('newPlayer', (player: PlayerInfo) => {
      player.colorIndex = this.assignColorIndex();
      this.players.set(player.id, player);
      this.playerJoinCallbacks.forEach(cb => cb(player));
    });

    this.socket.on('playerDisconnected', (playerId: string) => {
      this.players.delete(playerId);
      this.playerLeaveCallbacks.forEach(cb => cb(playerId));
    });

    this.socket.on('startRace', () => {
      this.raceStartCallbacks.forEach(cb => cb());
    });
  }

  setUsername(name: string): void {
    this.username = name || 'Player';
  }

  createRoom(username: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.setUsername(username);
      this.connect();

      if (!this.socket) {
        reject(new Error('Failed to connect'));
        return;
      }

      const onRoomCreated = (data: RoomInfo) => {
        this.roomCode = data.code;
        this.isHost = true;
        this.players.clear();
        this.nextColorIndex = 0;

        // Add all players from response with color indices
        Object.entries(data.players).forEach(([id, player]) => {
          player.colorIndex = this.assignColorIndex();
          this.players.set(id, player);
        });

        this.socket?.off('roomCreated', onRoomCreated);
        resolve(data.code);
      };

      this.socket.on('roomCreated', onRoomCreated);
      this.socket.emit('createRoom', { name: this.username });
    });
  }

  joinRoom(code: string, username: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      this.setUsername(username);
      this.connect();

      if (!this.socket) {
        reject(new Error('Failed to connect'));
        return;
      }

      const onRoomJoined = (data: RoomInfo) => {
        this.roomCode = data.code;
        this.isHost = false;
        this.players.clear();
        this.nextColorIndex = 0;

        // Add all players from response with color indices
        Object.entries(data.players).forEach(([id, player]) => {
          player.colorIndex = this.assignColorIndex();
          this.players.set(id, player);
        });

        this.socket?.off('roomJoined', onRoomJoined);
        this.socket?.off('roomError', onRoomError);
        resolve(data);
      };

      const onRoomError = (error: string) => {
        this.socket?.off('roomJoined', onRoomJoined);
        this.socket?.off('roomError', onRoomError);
        reject(new Error(error));
      };

      this.socket.on('roomJoined', onRoomJoined);
      this.socket.on('roomError', onRoomError);
      this.socket.emit('joinRoom', { code, name: this.username });
    });
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  onPlayerJoin(callback: PlayerJoinCallback): void {
    this.playerJoinCallbacks.push(callback);
  }

  onPlayerLeave(callback: PlayerLeaveCallback): void {
    this.playerLeaveCallbacks.push(callback);
  }

  onRaceStart(callback: RaceStartCallback): void {
    this.raceStartCallbacks.push(callback);
  }

  startRace(): void {
    if (this.isHost && this.socket) {
      this.socket.emit('requestStartRace');
    }
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayers(): PlayerInfo[] {
    return Array.from(this.players.values());
  }

  getPlayerColor(playerId: string): string {
    const player = this.players.get(playerId);
    const colorIndex = player?.colorIndex ?? 0;
    return CAR_COLORS[colorIndex % CAR_COLORS.length];
  }

  getLocalColorIndex(): number {
    const localPlayer = this.players.get(this.socket?.id || '');
    return localPlayer?.colorIndex ?? 0;
  }

  private assignColorIndex(): number {
    const index = this.nextColorIndex;
    this.nextColorIndex = (this.nextColorIndex + 1) % CAR_COLORS.length;
    return index;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomCode = null;
    this.isHost = false;
    this.players.clear();
  }
}
