import { navigate } from '../main';
import { gameState } from '../store/GameState';
import { TambolaEngine, TambolaValidator } from '../utils/GameLogic';
import { CustomAlert } from '../utils/CustomAlert';
import { CustomPrompt } from '../utils/CustomPrompt';

export function HostView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'host-container fade-in';

  let voiceEnabled = true;
  let isPlaying = false;
  let timerInterval = 4000;
  let intervalId: any = null;
  const engine = new TambolaEngine();
  
  // HUD Elements
  let currentNumberDisplay: HTMLElement;
  let previousNumberDisplay: HTMLElement;
  let playPauseBtn: HTMLElement;
  let voiceBtn: HTMLElement;
  let boardGrid: HTMLElement;

  const renderUI = () => {
    container.innerHTML = `
      <header class="host-header" style="background: var(--primary-color); color: white; padding: 1rem; width: 100%; display: flex; flex-direction: column; align-items: center;">
        <h2 style="margin: 0;">Tambola Host</h2>
        <div style="font-size: 0.9rem; margin-top: 5px;">Room ID: ${gameState.hostId || 'Not Set'}</div>
      </header>

      <div class="hud" style="width: 100%; padding: 1rem; text-align: center;">
        <div style="font-size: 0.9rem; color: var(--text-light);">Click for next number</div>
        
        <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; margin: 1rem 0;">
          <div style="text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Previous</div>
            <div id="prev-num" style="font-size: 1.5rem; font-weight: bold; color: var(--text-main);">-</div>
          </div>
          <div id="curr-num" style="font-size: 4rem; font-weight: 800; color: var(--primary-color); min-width: 80px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); cursor: pointer;">
            -
          </div>
          <div style="text-align: center; opacity: 0;"> <!-- Placeholder to balance layout -->
            <div style="font-size: 0.8rem;">Next</div>
            <div style="font-size: 1.5rem;">-</div>
          </div>
        </div>

        <div class="controls" style="display: flex; justify-content: center; gap: 1.5rem; font-size: 1.5rem; color: var(--text-light);">
          <i id="btn-play-pause" class="fa-solid fa-play" style="cursor: pointer; color: var(--primary-color);"></i>
          <i class="fa-solid fa-share-nodes" style="cursor: pointer;"></i>
          <i id="btn-voice" class="fa-solid fa-volume-high" style="cursor: pointer;"></i>
          <i id="btn-settings" class="fa-solid fa-gear" style="cursor: pointer;"></i>
        </div>
      </div>

      <div class="tabs" style="display: flex; width: 100%; gap: 10px; padding: 0 1rem; margin-bottom: 1rem;">
        <button class="primary-btn" style="flex: 1; border-radius: 4px; padding: 0.5rem; font-size: 0.9rem;">
           <i class="fa-solid fa-ticket"></i> TICKETS
        </button>
        <button class="primary-btn" style="flex: 1; border-radius: 4px; padding: 0.5rem; font-size: 0.9rem;">
           <i class="fa-solid fa-gift"></i> PRIZES
        </button>
      </div>

      <div id="board-grid" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; width: 100%; padding: 0 1rem; margin-bottom: 2rem;">
        <!-- Generated dynamically -->
      </div>
      
      <div style="padding: 1rem;">
         <button id="btn-back" class="primary-btn" style="width: 100%; background: #666;"><i class="fa-solid fa-arrow-left"></i> End / Back</button>
      </div>
    `;

    currentNumberDisplay = container.querySelector('#curr-num')!;
    previousNumberDisplay = container.querySelector('#prev-num')!;
    playPauseBtn = container.querySelector('#btn-play-pause')!;
    voiceBtn = container.querySelector('#btn-voice')!;
    boardGrid = container.querySelector('#board-grid')!;

    renderBoard();
    bindEvents();
  };

  const renderBoard = () => {
    boardGrid.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
      const cell = document.createElement('div');
      cell.innerText = i.toString();
      cell.style.border = '1px solid var(--primary-color)';
      cell.style.aspectRatio = '1';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.fontSize = '0.9rem';
      cell.style.fontWeight = '600';
      cell.style.color = 'var(--text-main)';
      cell.style.backgroundColor = 'white';

      const drawnNumbers = engine.getDrawnNumbers();
      if (drawnNumbers.includes(i)) {
        cell.style.backgroundColor = 'var(--primary-color)';
        cell.style.color = 'white';
        // Add cross for the current one
        if (drawnNumbers[drawnNumbers.length - 1] === i) {
          cell.style.textDecoration = 'line-through';
          cell.style.textDecorationThickness = '2px';
        }
      }

      boardGrid.appendChild(cell);
    }
  };

  const speakNumber = (num: number) => {
    if (!voiceEnabled) return;
    let text = num.toString();
    if (num > 9) {
      const chars = text.split('');
      text = `${chars[0]} ${chars[1]}, ${num}`;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const callNextNumber = () => {
    const nextNum = engine.drawNextNumber();
    if (nextNum === null) {
      pauseTimer();
      CustomAlert("Game Over", "All 90 numbers have been drawn!", "info");
      return;
    }

    const drawnNumbers = engine.getDrawnNumbers();
    if (drawnNumbers.length > 1) {
      previousNumberDisplay.innerText = drawnNumbers[drawnNumbers.length - 2].toString();
    }
    currentNumberDisplay.innerText = nextNum.toString();
    
    // Animate display
    currentNumberDisplay.style.transform = 'scale(1.2)';
    setTimeout(() => { currentNumberDisplay.style.transform = 'scale(1)'; }, 200);

    renderBoard();
    speakNumber(nextNum);
    
    // Broadcast to players
    gameState.callNumber(nextNum);
  };

  const startTimer = () => {
    if (isPlaying) return;
    isPlaying = true;
    playPauseBtn.className = 'fa-solid fa-pause';
    // Call one immediately
    callNextNumber();
    intervalId = setInterval(() => {
      callNextNumber();
    }, timerInterval);
  };

  const pauseTimer = () => {
    isPlaying = false;
    playPauseBtn.className = 'fa-solid fa-play';
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const toggleVoice = () => {
    voiceEnabled = !voiceEnabled;
    voiceBtn.className = voiceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  };

  const renderSetupForm = () => {
    container.innerHTML = `
      <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem; text-align: center;">
        <h2 style="color: var(--primary-color); margin-bottom: 1rem;">Host Setup</h2>
        <p style="color: #666; margin-bottom: 1.5rem;">Create a new Room ID for players to join.</p>
        <input type="text" id="host-id-input" placeholder="Room/Host ID" value="${Math.floor(1000 + Math.random() * 9000)}" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1.2rem; text-align: center; font-weight: bold; letter-spacing: 2px;">
        <button id="btn-create" class="primary-btn" style="margin-top: 1rem;">Create Room</button>
        <button id="btn-cancel" class="primary-btn" style="background:#666;">Back</button>
      </div>
    `;

    container.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('home'));
    
    container.querySelector('#btn-create')?.addEventListener('click', () => {
      const roomIdInput = container.querySelector('#host-id-input') as HTMLInputElement;
      const roomId = roomIdInput.value;
      
      if (!roomId) {
        CustomAlert("Missing Input", "Please enter a Room ID", "error");
        return;
      }
      
      const btn = container.querySelector('#btn-create') as HTMLButtonElement;
      const originalText = btn.innerText;
      btn.innerText = "Creating Room...";
      btn.disabled = true;

      gameState.onHostCreated = () => {
        renderUI();
      };

      gameState.onHostError = (msg) => {
        btn.innerText = originalText;
        btn.disabled = false;
        roomIdInput.focus();
        gameState.disconnect();
      };

      gameState.createRoom(roomId);
    });
  };

  const bindEvents = () => {
    playPauseBtn.addEventListener('click', () => {
      isPlaying ? pauseTimer() : startTimer();
    });

    currentNumberDisplay.addEventListener('click', () => {
      // Manual call next number if paused
      if (!isPlaying) {
        callNextNumber();
      }
    });

    voiceBtn.addEventListener('click', toggleVoice);

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      pauseTimer();
      gameState.disconnect();
      navigate('home');
    });

    container.querySelector('#btn-settings')?.addEventListener('click', () => {
      CustomPrompt("Timer Settings", "Enter timer interval in seconds (4-10):", (timerInterval/1000).toString(), "Seconds", "number", (val) => {
        if (val) {
          const secs = parseInt(val, 10);
          if (secs >= 4 && secs <= 10) {
            timerInterval = secs * 1000;
            if (isPlaying) {
              pauseTimer();
              startTimer();
            }
          } else {
            CustomAlert("Invalid Input", "Must be between 4 and 10 seconds.", "error");
          }
        }
      });
    });

    gameState.onPlayerClaimed = (claim: any) => {
      pauseTimer();
      const isValidAlgorithmically = TambolaValidator.verifyPattern(claim.ticket, engine.getDrawnNumbers(), claim.pattern);
      
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '1000';
      
      modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; width: 90%; max-width: 400px; text-align: center;">
          <h3 style="color: var(--primary-color); margin-bottom: 1rem;"><i class="fa-solid fa-shield-halved"></i> Verify Claim</h3>
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;"><strong>${claim.playerName}</strong> claims <strong>${claim.pattern}</strong> !</p>
          <div style="background: ${isValidAlgorithmically ? '#e8f5e9' : '#ffebee'}; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
            Auto Validator: <strong style="color: ${isValidAlgorithmically ? '#2e7d32' : '#c62828'};">${isValidAlgorithmically ? 'PATTERN MET <i class="fa-solid fa-check"></i>' : 'PATTERN NOT MET <i class="fa-solid fa-xmark"></i>'}</strong>
          </div>
          <p style="font-size: 0.9rem; color: #666; margin-bottom: 1.5rem;">If Bogey, the player's ticket will be disqualified.</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="btn-approve" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="btn-bogey" class="primary-btn" style="flex: 1;">Bogey</button>
          </div>
        </div>
      `;
      
      
      modal.querySelector('#btn-approve')?.addEventListener('click', () => {
        gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, true);
        document.body.removeChild(modal);
      });
      
      modal.querySelector('#btn-bogey')?.addEventListener('click', () => {
        gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, false);
        document.body.removeChild(modal);
      });
      
      document.body.appendChild(modal);
    };

    gameState.onClaimResult = (result: any) => {
      if (result.isValid) {
        CustomAlert("Prize Claimed!", `Player ${result.playerName} has successfully claimed ${result.pattern}!`, "info");
      }
    };

    gameState.onJoinRequested = (peerId: string, playerName: string, ticketCount: number) => {
      pauseTimer();
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '1000';
      
      modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; width: 90%; max-width: 400px; text-align: center;">
          <h3 style="color: var(--primary-color); margin-bottom: 1rem;"><i class="fa-solid fa-user-plus"></i> Join Request</h3>
          <p style="font-size: 1.1rem; margin-bottom: 1.5rem;"><strong>${playerName}</strong> wants to join with <strong>${ticketCount} tickets</strong>.</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="btn-approve-join" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="btn-reject-join" class="primary-btn" style="flex: 1; background: #c62828;">Reject</button>
          </div>
        </div>
      `;
      
      modal.querySelector('#btn-approve-join')?.addEventListener('click', () => {
        gameState.approveJoin(peerId, playerName);
        document.body.removeChild(modal);
      });
      
      modal.querySelector('#btn-reject-join')?.addEventListener('click', () => {
        gameState.rejectJoin(peerId);
        document.body.removeChild(modal);
      });
      
      document.body.appendChild(modal);
    };
  };

  renderSetupForm(); // Initial render

  return container;
}
