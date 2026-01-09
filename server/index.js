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

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- ROOM MANAGEMENT ---

  socket.on('createRoom', () => {
    const code = generateRoomCode();
    
    // Initialize Room
    rooms[code] = {
      players: {},
      state: 'waiting',
      host: socket.id
    };

    // Add Host as first player
    const initialPlayerState = {
      id: socket.id,
      x: 0, y: 0.5, z: 60,
      qx: 0, qy: 0, qz: 0, qw: 1,
      isHost: true
    };
    rooms[code].players[socket.id] = initialPlayerState;

    // Join Socket Room
    socket.join(code);
    socketToRoom[socket.id] = code;

    socket.emit('roomCreated', { code, isHost: true, players: rooms[code].players });
    console.log(`Room created: ${code} by ${socket.id}`);
  });

  socket.on('joinRoom', (code) => {
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

    // Add Player
    const newPlayer = {
      id: socket.id,
      x: 0, y: 0.5, z: 60, 
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
    
    console.log(`${socket.id} joined room ${code}`);
  });

  // --- GAMEPLAY ---

  socket.on('requestStartRace', () => {
    const code = socketToRoom[socket.id];
    if (code && rooms[code] && rooms[code].host === socket.id) {
      rooms[code].state = 'racing';
      // Broadcast to everyone in the room (including host) to start
      io.to(code).emit('startRace');
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