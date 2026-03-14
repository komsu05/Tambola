import Peer, { DataConnection } from 'peerjs';
import { CustomAlert } from '../utils/CustomAlert';

export type Player = {
  socketId: string; // Keeping name as socketId for UI compatibility, but it's the peer ID
  name: string;
  tickets: any[];
};

export class GameState {
  private static instance: GameState;
  
  public peer: Peer | null = null;
  public hostId: string = '';
  public playerName: string = '';
  public calledNumbers: number[] = [];
  public approvedClaims: string[] = [];
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
  public onPlayerClaimed: ((claim: any) => void) | null = null;
  public onClaimResult: ((result: any) => void) | null = null;
  public onJoinRequested: ((peerId: string, playerName: string, ticketCount: number) => void) | null = null;
  public onJoinApproved: (() => void) | null = null;
  public onJoinRejected: (() => void) | null = null;
  public onJoinError: ((errorMsg: string) => void) | null = null;
  public onHostCreated: (() => void) | null = null;
  public onHostError: ((errorMsg: string) => void) | null = null;
  
  private constructor() {
    // Initialization is deferred to createRoom / joinRoom
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  // --- HOST LOGIC ---
  public createRoom(requestedHostId: string) {
    this.isHost = true;
    this.hostId = requestedHostId;
    
    // Create a Peer with the specific host ID so players can find us
    this.peer = new Peer(requestedHostId);
    
    this.peer.on('open', (id) => {
      console.log('Host Peer ID is: ' + id);
      if (this.onHostCreated) this.onHostCreated();
    });

    this.peer.on('connection', (conn) => {
      this.connections.set(conn.peer, conn);
      console.log('Player connected: ' + conn.peer);
      
      conn.on('data', (data: any) => {
        this.handleMessageFromPlayer(conn.peer, data);
      });
      
      conn.on('close', () => {
        this.connections.delete(conn.peer);
      });
    });
    
    this.peer.on('error', (err) => {
      console.error('PeerJS Host Error:', err);
      if (err.type === 'unavailable-id') {
        CustomAlert('Room Taken', 'This Room ID is already taken. Please try another.', 'error');
        if (this.onHostError) this.onHostError('Room ID taken');
      } else {
        if (this.onHostError) this.onHostError(err.message);
      }
    });
  }

  private handleMessageFromPlayer(peerId: string, data: any) {
      if (data.type === 'joinRequest') {
      if (this.onJoinRequested) {
        this.onJoinRequested(peerId, data.playerName, data.ticketCount);
      } else {
        this.approveJoin(peerId, data.playerName);
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
    }
  }

  public approveJoin(peerId: string, playerName: string) {
    const player: Player = { socketId: peerId, name: playerName, tickets: [] };
    this.players.push(player);
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
  public joinRoom(hostId: string, playerName: string, ticketCount: number) {
    this.isHost = false;
    this.hostId = hostId;
    this.playerName = playerName;
    
    // Create a client peer with random ID
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      console.log('My Player Peer ID is: ' + id);
      
      // Connect to the host
      this.hostConnection = this.peer!.connect(hostId);
      
      this.hostConnection.on('open', () => {
        console.log('Connected to host!');
        // Say hello with request
        this.hostConnection!.send({ type: 'joinRequest', playerName, ticketCount });
      });
      
      this.hostConnection.on('data', (data: any) => {
        this.handleMessageFromHost(data);
      });
      
      this.hostConnection.on('close', () => {
        console.log('Connection to host lost.');
        if (!this.isRejected) {
          CustomAlert('Connection to Host lost!', 'The Host has disconnected or ended the game.', 'error');
        }
      });
    });
    
    this.peer.on('error', (err) => {
      console.error('PeerJS Player Error:', err);
      if (err.type === 'peer-unavailable') {
        CustomAlert("Error", "Host not found. Ensure the Host has created the room first.", "error");
        if (this.onJoinError) this.onJoinError("Host not found");
      }
    });
  }

  private handleMessageFromHost(data: any) {
    if (data.type === 'numberCalled') {
      this.calledNumbers.push(data.number);
      if (this.onNumberCalled) this.onNumberCalled(data.number);
    } else if (data.type === 'gameReset') {
      this.calledNumbers = [];
      this.approvedClaims = [];
      this.status = 'waiting';
      if (this.onGameReset) this.onGameReset();
    } else if (data.type === 'claimResult') {
      if (data.approvedClaims) this.approvedClaims = data.approvedClaims;
      if (this.onClaimResult) this.onClaimResult(data);
    } else if (data.type === 'playerClaimed') {
       if (this.onPlayerClaimed) this.onPlayerClaimed(data);
    } else if (data.type === 'joinApproved') {
      this.calledNumbers = data.calledNumbers;
      this.approvedClaims = data.approvedClaims || [];
      this.status = data.status;
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
      this.broadcast({ type: 'numberCalled', number: num });
    }
  }

  public resetGame() {
    if (!this.isHost) return;
    this.calledNumbers = [];
    this.approvedClaims = [];
    this.status = 'waiting';
    this.broadcast({ type: 'gameReset' });
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

    if (isValid && !this.approvedClaims.includes(pattern)) {
      this.approvedClaims.push(pattern);
    }
    
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
  }
}

export const gameState = GameState.getInstance();
