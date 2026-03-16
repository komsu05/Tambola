import Peer, { DataConnection } from 'peerjs';
import { CustomAlert } from '../utils/CustomAlert';

export type Player = {
  socketId: string; // Keeping name as socketId for UI compatibility, but it's the peer ID
  name: string;
  tickets: any[];
  ticketStates: any[];
};

export class GameState {
  private static instance: GameState;
  
  public peer: Peer | null = null;
  public hostId: string = '';
  public playerName: string = '';
  public calledNumbers: number[] = [];
  public approvedClaims: { pattern: string, playerName: string }[] = [];
  public status: 'waiting' | 'playing' = 'waiting';
  public players: Player[] = [];
  
  // Host state
  private isHost: boolean = false;
  private connections: Map<string, DataConnection> = new Map();
  
  // Player state
  private hostConnection: DataConnection | null = null;
  private isRejected: boolean = false;
  
  // Callbacks
  public onNumberCalled: ((num: number) => void) | null = null;
  public onPlayerJoined: ((player: Player) => void) | null = null;
  public onGameReset: (() => void) | null = null;
  public onGameEnded: (() => void) | null = null;
  public onPlayerClaimed: ((claim: any) => void) | null = null;
  public onClaimResult: ((result: any) => void) | null = null;
  public onJoinRequested: ((peerId: string, playerName: string, ticketCount: number) => void) | null = null;
  public onJoinApproved: (() => void) | null = null;
  public onJoinRejected: (() => void) | null = null;
  public onJoinError: ((errorMsg: string) => void) | null = null;
  public onHostCreated: (() => void) | null = null;
  public onHostError: (() => void) | null = null;
  public onConnectionLost: (() => void) | null = null;
  
  private constructor() {
    this.recoverState();
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  private saveState() {
    const data = {
      hostId: this.hostId,
      playerName: this.playerName,
      role: this.isHost ? 'host' : 'player',
      status: this.status,
      calledNumbers: this.calledNumbers,
      approvedClaims: this.approvedClaims,
      tickets: this.players.find(p => p.socketId === (this.peer?.id || ''))?.tickets || []
    };
    localStorage.setItem('tambola_game_state', JSON.stringify(data));
  }

  private recoverState() {
    const saved = localStorage.getItem('tambola_game_state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.hostId = data.hostId || '';
        this.playerName = data.playerName || '';
        this.status = data.status || 'waiting';
        this.calledNumbers = data.calledNumbers || [];
        this.approvedClaims = data.approvedClaims || [];
        this.isHost = data.role === 'host';
        // Recovered tickets will be handled by PlayerView via public access if needed
        // Or we can store them in a temporary property
        (this as any)._recoveredTickets = data.tickets || [];
      } catch (e) {
        console.error('Failed to recover state', e);
      }
    }
  }

  // --- HOST LOGIC ---
  public createRoom(requestedHostId: string) {
    this.isHost = true;
    this.hostId = requestedHostId;
    this.saveState();
    
    // Create a Peer with the specific host ID so players can find us
    this.peer = new Peer(requestedHostId);
    
    this.peer.on('open', (id) => {
      console.log('Host Peer ID is: ' + id);
      if (this.onHostCreated) this.onHostCreated();
    });

    this.peer.on('connection', (conn) => {
      this.connections.set(conn.peer, conn);
      
      conn.on('data', (data: any) => {
        this.handleMessageFromPlayer(conn.peer, data);
      });
      
      conn.on('close', () => {
        this.connections.delete(conn.peer);
      });

      // Handle disconnected state
      conn.on('error', () => {
        this.connections.delete(conn.peer);
      });
    });
    
    this.peer.on('error', (err) => {
      console.error('PeerJS Host Error:', err);
      if (err.type === 'unavailable-id') {
        CustomAlert('Room Taken', 'This Room ID is already taken. Please try another.', 'error');
        if (this.onHostError) this.onHostError();
      } else {
        if (this.onHostError) this.onHostError();
      }
    });
  }

  private handleMessageFromPlayer(peerId: string, data: any) {
      if (data.type === 'joinRequest') {
      const existingPlayer = this.players.find(p => p.name === data.playerName);
      if (existingPlayer) {
        // Auto-approve reconnections
        console.log(`Auto-approving reconnection for ${data.playerName}`);
        this.approveJoin(peerId, data.playerName, data.tickets || [], data.ticketStates || []);
      } else if (this.onJoinRequested) {
        this.onJoinRequested(peerId, data.playerName, data.ticketCount);
      } else {
        this.approveJoin(peerId, data.playerName, data.tickets || [], data.ticketStates || []);
      }
    } else if (data.type === 'claimDividend') {
      // Forward claim to UI
      const claim = {
         playerSocketId: peerId,
         playerName: this.players.find(p => p.socketId === peerId)?.name || 'Player',
         ticketIndex: data.ticketIndex,
         pattern: data.pattern,
         ticket: data.ticket
      };
      if (this.onPlayerClaimed) this.onPlayerClaimed(claim);
      // Also broadcast to other players that someone claimed (optional, but good for UI sync if needed)
      this.broadcast({ type: 'playerClaimed', ...claim });
    } else if (data.type === 'updateTickets') {
      const player = this.players.find(p => p.socketId === peerId);
      if (player) {
        player.tickets = data.tickets;
        player.ticketStates = data.ticketStates || [];
        if (this.onPlayerJoined) this.onPlayerJoined(player); // Trigger update
      }
    }
  }

  public approveJoin(peerId: string, playerName: string, tickets: any[] = [], ticketStates: any[] = []) {
    let player = this.players.find(p => p.name === playerName);
    if (player) {
      player.socketId = peerId;
      player.tickets = tickets.length > 0 ? tickets : player.tickets;
      player.ticketStates = ticketStates.length > 0 ? ticketStates : (player.ticketStates || []);
    } else {
      player = { socketId: peerId, name: playerName, tickets, ticketStates };
      this.players.push(player);
    }
    if (this.onPlayerJoined) this.onPlayerJoined(player);
    
    this.sendMessageToPlayer(peerId, {
      type: 'joinApproved',
      hostId: this.hostId,
      calledNumbers: this.calledNumbers,
      approvedClaims: this.approvedClaims,
      status: this.status
    });
  }

  public rejectJoin(peerId: string) {
    this.sendMessageToPlayer(peerId, { type: 'joinRejected' });
    setTimeout(() => {
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.close();
        this.connections.delete(peerId);
      }
    }, 500);
  }

  private broadcast(data: any) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  private sendMessageToPlayer(peerId: string, data: any) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  // --- PLAYER LOGIC ---
  public joinRoom(hostId: string, playerName: string, ticketCount: number, tickets: any[] = [], ticketStates: any[] = []) {
    this.disconnect();
    this.isHost = false;
    this.hostId = hostId;
    this.playerName = playerName;
    this.saveState();
    
    // Create a client peer with random ID
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      console.log('My Player Peer ID is: ' + id);
      this.connectToHost(hostId, playerName, ticketCount, tickets, ticketStates);
    });
    
    this.peer.on('error', (err) => {
      console.error('PeerJS Player Error:', err);
      if (err.type === 'peer-unavailable') {
        CustomAlert("Error", "Host not found. Ensure the Host has created the room first.", "error");
        if (this.onJoinError) this.onJoinError("Host not found");
      }
    });
  }

  private connectToHost(hostId: string, playerName: string, ticketCount: number, tickets: any[], ticketStates: any[]) {
    this.hostConnection = this.peer!.connect(hostId);
      
    this.hostConnection.on('open', () => {
      console.log('Connected to host!');
      // Say hello with request
      this.hostConnection!.send({ type: 'joinRequest', playerName, ticketCount, tickets, ticketStates });
    });
    
    this.hostConnection.on('data', (data: any) => {
      this.handleMessageFromHost(data);
    });
    
    this.hostConnection.on('close', () => {
      console.log('Connection to host lost.');
      if (!this.isRejected) {
        if (this.onConnectionLost) this.onConnectionLost();
      }
    });

    this.hostConnection.on('error', () => {
      if (this.onConnectionLost) this.onConnectionLost();
    });
  }

  private handleMessageFromHost(data: any) {
    if (data.type === 'numberCalled') {
      this.calledNumbers.push(data.number);
      this.saveState();
      if (this.onNumberCalled) this.onNumberCalled(data.number);
    } else if (data.type === 'gameReset') {
      this.calledNumbers = [];
      this.approvedClaims = [];
      this.status = 'waiting';
      this.saveState();
      if (this.onGameReset) this.onGameReset();
    } else if (data.type === 'gameEnded') {
      if (this.onGameEnded) this.onGameEnded();
    } else if (data.type === 'claimResult') {
      if (data.approvedClaims) this.approvedClaims = data.approvedClaims;
      this.saveState();
      if (this.onClaimResult) this.onClaimResult(data);
    } else if (data.type === 'playerClaimed') {
       if (this.onPlayerClaimed) this.onPlayerClaimed(data);
    } else if (data.type === 'joinApproved') {
      this.calledNumbers = data.calledNumbers;
      this.approvedClaims = data.approvedClaims || [];
      this.status = data.status;
      this.saveState();
      if (this.onJoinApproved) this.onJoinApproved();
    } else if (data.type === 'joinRejected') {
      this.isRejected = true;
      if (this.onJoinRejected) this.onJoinRejected();
    }
  }

  // --- ACTIONS (Called by UI) ---
  public callNumber(num: number) {
    if (!this.isHost) return;
    if (!this.calledNumbers.includes(num)) {
      this.calledNumbers.push(num);
      this.saveState();
      this.broadcast({ type: 'numberCalled', number: num });
    }
  }

  public resetGame() {
    if (!this.isHost) return;
    this.calledNumbers = [];
    this.approvedClaims = [];
    this.status = 'waiting';
    this.saveState();
    this.broadcast({ type: 'gameReset' });
  }

  public endGame() {
    if (!this.isHost) return;
    this.broadcast({ type: 'gameEnded' });
    setTimeout(() => {
      localStorage.removeItem('tambola_game_state');
      this.disconnect();
    }, 500);
  }

  public syncTickets(tickets: any[], ticketStates: any[] = []) {
    if (this.isHost) return;
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'updateTickets', tickets, ticketStates });
    }
  }

  public claimDividend(ticketIndex: number, pattern: string, ticket: any) {
    if (this.isHost) {
      // Host handles their own claim locally
      const claim = {
        playerSocketId: this.peer?.id || 'host',
        playerName: 'Host',
        ticketIndex,
        pattern,
        ticket
     };
     if (this.onPlayerClaimed) this.onPlayerClaimed(claim);
     this.broadcast({ type: 'playerClaimed', ...claim });
    } else {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'claimDividend', ticketIndex, pattern, ticket });
      }
    }
  }

  public verifyClaim(playerSocketId: string, ticketIndex: number, pattern: string, isValid: boolean) {
    if (!this.isHost) return;
    
    let playerName = 'Host';
    if (playerSocketId !== (this.peer?.id || 'host')) {
      playerName = this.players.find(p => p.socketId === playerSocketId)?.name || 'Player';
    }

    if (isValid && !this.approvedClaims.some(c => c.pattern === pattern)) {
      this.approvedClaims.push({ pattern, playerName });
    }
    
    this.saveState();
    const result = { type: 'claimResult', playerSocketId, playerName, ticketIndex, pattern, isValid, approvedClaims: this.approvedClaims };
    
    // Broadcast result to everyone
    this.broadcast(result);
    // Also trigger locally
    if (this.onClaimResult) this.onClaimResult(result);
  }

  public disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.hostConnection = null;
    this.connections.clear();
  }
}

export const gameState = GameState.getInstance();
