export class MultiplayerStub {
  static async createRoom(params: { name: string, region: string, maxPlayers: number }): Promise<string> {
    return new Promise(resolve => {
      setTimeout(() => {
        // Mock ID generation
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        resolve(code);
      }, 500);
    });
  }

  static async joinRoom(code: string): Promise<boolean> {
    return new Promise(resolve => {
      setTimeout(() => {
        // Accept any code length 4
        resolve(code.length === 4);
      }, 500);
    });
  }
}
