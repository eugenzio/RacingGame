const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// State
// rooms = { "CODE": { players: { socketId: { ... } }, state: "waiting" | "racing", host: "socketId" } }
const rooms = {};
// socketToRoom = { "socketId": "CODE" }
const socketToRoom = {};

function generateRoomCode() {
  let result = '';
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// F1 Grid spawn positions - proper spacing on straight section
// All positions behind finish line (Z > 50)
const SPAWN_POSITIONS = [
  { x: -1.5, y: 0.3, z: 52 },   // P1 - Pole (left front)
  { x: 1.5, y: 0.3, z: 56 },    // P2 - (right, 4m behind)
  { x: -1.5, y: 0.3, z: 62 },   // P3 - Row 2 left (10m from P1)
  { x: 1.5, y: 0.3, z: 66 },    // P4 - Row 2 right
  { x: -1.5, y: 0.3, z: 72 },   // P5 - Row 3 left
  { x: 1.5, y: 0.3, z: 76 },    // P6 - Row 3 right
  { x: -1.5, y: 0.3, z: 82 },   // P7 - Row 4 left
  { x: 1.5, y: 0.3, z: 86 },    // P8 - Row 4 right
];

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- ROOM MANAGEMENT ---

  socket.on('createRoom', (data) => {
    const code = generateRoomCode();
    const playerName = data?.name || 'Player';

    // Initialize Room
    rooms[code] = {
      players: {},
      state: 'waiting',
      host: socket.id
    };

    // Add Host as first player (position 0)
    const spawnPos = SPAWN_POSITIONS[0];
    const initialPlayerState = {
      id: socket.id,
      name: playerName,
      x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
      qx: 0, qy: 0, qz: 0, qw: 1,
      isHost: true
    };
    rooms[code].players[socket.id] = initialPlayerState;

    // Join Socket Room
    socket.join(code);
    socketToRoom[socket.id] = code;

    socket.emit('roomCreated', { code, isHost: true, players: rooms[code].players });
    console.log(`Room created: ${code} by ${playerName} (${socket.id})`);
  });

  socket.on('joinRoom', (data) => {
    if (!data) return;
    let code = typeof data === 'string' ? data : data.code;
    const playerName = data?.name || 'Player';

    if (!code) return;
    code = code.toUpperCase();

    const room = rooms[code];
    if (!room) {
      socket.emit('roomError', 'Room does not exist.');
      return;
    }

    if (room.state === 'racing') {
      socket.emit('roomError', 'Race already in progress.');
      return;
    }

    // Get spawn position based on player count
    const playerCount = Object.keys(room.players).length;
    const spawnPos = SPAWN_POSITIONS[playerCount % SPAWN_POSITIONS.length];

    // Add Player
    const newPlayer = {
      id: socket.id,
      name: playerName,
      x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
      qx: 0, qy: 0, qz: 0, qw: 1,
      isHost: false
    };

    room.players[socket.id] = newPlayer;

    socket.join(code);
    socketToRoom[socket.id] = code;

    // Tell the joiner about the room state
    socket.emit('roomJoined', { code, isHost: false, players: room.players });

    // Tell others in the room a new player arrived
    socket.to(code).emit('newPlayer', newPlayer);

    console.log(`${playerName} (${socket.id}) joined room ${code}`);
  });

  // --- GAMEPLAY ---

  socket.on('requestStartRace', () => {
    const code = socketToRoom[socket.id];
    if (code && rooms[code] && rooms[code].host === socket.id) {
      rooms[code].state = 'racing';
      rooms[code].finishResults = []; // Track finish order
      rooms[code].raceStartTime = Date.now();
      rooms[code].countdownStarted = false;
      // Broadcast to everyone in the room (including host) to start
      io.to(code).emit('startRace');
    }
  });

  socket.on('playerFinished', (data) => {
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code] || rooms[code].state !== 'racing') return;

    const room = rooms[code];
    const player = room.players[socket.id];
    if (!player) return;

    // Check if player already finished
    if (room.finishResults.find(r => r.id === socket.id)) return;

    const finishTime = data.totalTime || (Date.now() - room.raceStartTime);
    const position = room.finishResults.length + 1;

    room.finishResults.push({
      id: socket.id,
      name: player.name,
      position,
      time: finishTime,
      status: 'finished'
    });

    console.log(`${player.name} finished in position ${position} (${finishTime}ms)`);

    // If first player finished, start 10-second countdown for others
    if (position === 1 && !room.countdownStarted) {
      room.countdownStarted = true;
      room.countdownEndTime = Date.now() + 10000;

      // Notify all players that winner finished
      io.to(code).emit('raceWinner', {
        winnerId: socket.id,
        winnerName: player.name,
        winnerTime: finishTime
      });

      // After 10 seconds, end the race
      setTimeout(() => {
        if (!rooms[code]) return; // Room might be deleted

        // Mark remaining players as retired
        const totalPlayers = Object.keys(room.players).length;
        Object.keys(room.players).forEach(playerId => {
          if (!room.finishResults.find(r => r.id === playerId)) {
            const retiredPlayer = room.players[playerId];
            room.finishResults.push({
              id: playerId,
              name: retiredPlayer.name,
              position: room.finishResults.length + 1,
              time: null,
              status: 'retired'
            });
          }
        });

        room.state = 'finished';
        io.to(code).emit('raceResults', room.finishResults);
        console.log(`Race in room ${code} finished with ${room.finishResults.length} results`);
      }, 10000);
    } else {
      // Notify others that this player finished
      socket.to(code).emit('playerFinishedRace', {
        id: socket.id,
        name: player.name,
        position,
        time: finishTime
      });

      // Check if all players finished before countdown ends
      const totalPlayers = Object.keys(room.players).length;
      if (room.finishResults.length === totalPlayers) {
        room.state = 'finished';
        io.to(code).emit('raceResults', room.finishResults);
        console.log(`All players in room ${code} finished!`);
      }
    }
  });

  socket.on('playerMovement', (movementData) => {
    const code = socketToRoom[socket.id];
    if (code && rooms[code]) {
      // Update server state
      if (rooms[code].players[socket.id]) {
        Object.assign(rooms[code].players[socket.id], movementData);
      }
      // Broadcast only to that room
      socket.to(code).emit('playerMoved', { id: socket.id, ...movementData });
    }
  });

  // --- DISCONNECT ---

  socket.on('disconnect', () => {
    const code = socketToRoom[socket.id];
    if (code && rooms[code]) {
      delete rooms[code].players[socket.id];
      delete socketToRoom[socket.id];

      // Notify room
      io.to(code).emit('playerDisconnected', socket.id);

      // If room empty, delete it
      if (Object.keys(rooms[code].players).length === 0) {
        delete rooms[code];
        console.log(`Room ${code} deleted`);
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});