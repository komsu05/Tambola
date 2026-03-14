import { navigate } from '../main';
import { gameState } from '../store/GameState';
import { TambolaEngine, TambolaValidator } from '../utils/GameLogic';
import { TicketGenerator, Ticket } from '../utils/TicketGenerator';
import { CustomAlert } from '../utils/CustomAlert';
import { CustomPrompt } from '../utils/CustomPrompt';

export function HostPlayerView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'host-player-container fade-in';

  let voiceEnabled = true;
  let isPlaying = false;
  let timerInterval = 4000;
  let intervalId: any = null;
  const engine = new TambolaEngine();
  
  let myTickets: Ticket[] = [];
  let ticketStates: { selected: boolean, locked: boolean }[][][] = [];
  let disqualifiedTickets: boolean[] = [];
  
  // Elements
  let currentNumberDisplay: HTMLElement;
  let previousNumberDisplay: HTMLElement;
  let playPauseBtn: HTMLElement;
  let voiceBtn: HTMLElement;
  let ticketsContainer: HTMLElement;

  const renderSetupForm = () => {
    container.innerHTML = `
      <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem; text-align: center;">
        <h2 style="color: var(--primary-color); margin-bottom: 1rem;">Host & Play Setup</h2>
        <input type="text" id="host-id-input" placeholder="Room/Host ID" value="${Math.floor(1000 + Math.random() * 9000)}" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1.2rem; text-align: center; font-weight: bold; letter-spacing: 2px;">
        
        <select id="ticket-count" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1.1rem; text-align: center;">
          <option value="1">1 Ticket</option>
          <option value="2" selected>2 Tickets</option>
          <option value="3">3 Tickets</option>
          <option value="4">4 Tickets</option>
          <option value="5">5 Tickets</option>
          <option value="6">6 Tickets</option>
        </select>

        <button id="btn-create" class="primary-btn" style="margin-top: 1rem;">Start Game</button>
        <button id="btn-cancel" class="primary-btn" style="background:#666;">Back</button>
      </div>
    `;

    container.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('home'));
    
    container.querySelector('#btn-create')?.addEventListener('click', () => {
      const roomIdInput = container.querySelector('#host-id-input') as HTMLInputElement;
      const roomId = roomIdInput.value;
      const count = parseInt((container.querySelector('#ticket-count') as HTMLSelectElement).value, 10);
      
      if (!roomId) {
        CustomAlert("Missing Input", "Please enter a Room ID", "error");
        return;
      }
      
      const btn = container.querySelector('#btn-create') as HTMLButtonElement;
      const originalText = btn.innerText;
      btn.innerText = "Creating Room...";
      btn.disabled = true;

      gameState.onHostCreated = () => {
        const fullSet = TicketGenerator.generateSetOf6();
        myTickets = fullSet.slice(0, count);
        disqualifiedTickets = myTickets.map(() => false);
        ticketStates = myTickets.map(() =>
          Array.from({length: 3}, () =>
            Array.from({length: 9}, () => ({ selected: false, locked: false }))
          )
        );

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

  const renderUI = () => {
    container.innerHTML = `
      <header class="host-header" style="background: var(--primary-color); color: white; padding: 0.8rem; width: 100%; text-align: center;">
        <h3 style="margin: 0; font-size: 1.1rem;">Room ID: ${gameState.hostId} | Host</h3>
      </header>

      <div class="hud" style="width: 100%; padding: 1rem; text-align: center; border-bottom: 1px solid #ddd;">
        <div style="font-size: 0.9rem; color: var(--text-light);">Click for next number</div>
        
        <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; margin: 1rem 0;">
          <div style="text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Previous</div>
            <div id="prev-num" style="font-size: 1.5rem; font-weight: bold; color: var(--text-main);">-</div>
          </div>
          <div id="curr-num" style="font-size: 4rem; font-weight: 800; color: var(--primary-color); min-width: 80px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); cursor: pointer;">
            -
          </div>
          <div style="text-align: center; opacity: 0;">
            <div style="font-size: 0.8rem;">Next</div>
            <div style="font-size: 1.5rem;">-</div>
          </div>
        </div>

        <div class="controls" style="display: flex; justify-content: center; gap: 1.5rem; font-size: 1.5rem; color: var(--text-light);">
          <i id="btn-play-pause" class="fa-solid fa-play" style="cursor: pointer; color: var(--primary-color);"></i>
          <i id="btn-voice" class="fa-solid fa-volume-high" style="cursor: pointer;"></i>
          <i id="btn-settings" class="fa-solid fa-gear" style="cursor: pointer;"></i>
        </div>
      </div>

      <div id="tickets-container" style="padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; height: 400px; width: 100%;">
      </div>

      <div style="padding: 1rem;">
         <button id="btn-back" class="primary-btn" style="width: 100%; background: #666;"><i class="fa-solid fa-arrow-left"></i> End Game / Leave</button>
      </div>
    `;

    currentNumberDisplay = container.querySelector('#curr-num')!;
    previousNumberDisplay = container.querySelector('#prev-num')!;
    playPauseBtn = container.querySelector('#btn-play-pause')!;
    voiceBtn = container.querySelector('#btn-voice')!;
    ticketsContainer = container.querySelector('#tickets-container')!;

    renderTickets();
    bindEvents();
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
    
    currentNumberDisplay.style.transform = 'scale(1.2)';
    setTimeout(() => { currentNumberDisplay.style.transform = 'scale(1)'; }, 200);

    speakNumber(nextNum);
    gameState.callNumber(nextNum); // Broadcasts to other players and triggers onNumberCalled
    
    // Lock ticket marks
    lockTickets();
    renderTickets();
  };

  const lockTickets = () => {
    for (let t = 0; t < ticketStates.length; t++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          if (ticketStates[t][r][c].selected) {
            ticketStates[t][r][c].locked = true;
          }
        }
      }
    }
  };

  const renderTickets = () => {
    ticketsContainer.innerHTML = '';
    myTickets.forEach((ticket, tIndex) => {
      const isBogey = disqualifiedTickets[tIndex];

      const ticketEl = document.createElement('div');
      ticketEl.style.backgroundColor = isBogey ? '#ffebee' : 'white';
      ticketEl.style.border = isBogey ? '2px solid red' : '2px solid var(--text-main)';
      ticketEl.style.borderRadius = '8px';
      ticketEl.style.overflow = 'hidden';
      ticketEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      ticketEl.style.flexShrink = '0'; // Prevents flexbox from squishing the ticket height
      ticketEl.style.opacity = isBogey ? '0.6' : '1';
      
      const headerDiv = document.createElement('div');
      headerDiv.style.background = isBogey ? 'red' : 'var(--text-main)';
      headerDiv.style.color = 'white';
      headerDiv.style.padding = '0.3rem 0.5rem';
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'center';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.fontSize = '0.8rem';
      titleSpan.style.fontWeight = 'bold';
      titleSpan.style.letterSpacing = '1px';
      titleSpan.innerText = `TICKET ${tIndex + 1} ${isBogey ? '(DISQUALIFIED)' : ''}`;
      headerDiv.appendChild(titleSpan);

      if (!isBogey) {
        const availablePatterns = [
          "Early 5", "Top Row", "Middle Row", "Bottom Row", "Full House"
        ].filter(p => !gameState.approvedClaims.includes(p));

        if (availablePatterns.length > 0) {
          const claimContainer = document.createElement('div');
          claimContainer.style.display = 'flex';
          claimContainer.style.gap = '0.3rem';
          
          const optionsHtml = availablePatterns.map(p => `<option value="${p}">${p}</option>`).join('');
          claimContainer.innerHTML = `
            <select class="claim-select" style="padding: 0.1rem; border-radius: 3px; font-size: 0.7rem; color: black;">
              ${optionsHtml}
            </select>
            <button class="btn-claim" style="padding: 0.1rem 0.4rem; font-size: 0.7rem; border-radius: 3px; border: none; background: var(--primary-color); color: white; cursor: pointer; font-weight: bold;">Claim</button>
          `;
          
          claimContainer.querySelector('.btn-claim')?.addEventListener('click', () => {
             const pattern = (claimContainer.querySelector('.claim-select') as HTMLSelectElement).value;
             gameState.claimDividend(tIndex, pattern, ticket);
             CustomAlert("Claim Sent", `Claim for ${pattern} on Ticket ${tIndex + 1} sent to Host for verification!`, "info");
          });
          
          headerDiv.appendChild(claimContainer);
        } else {
          const infoSpan = document.createElement('span');
          infoSpan.style.fontSize = '0.7rem';
          infoSpan.style.fontStyle = 'italic';
          infoSpan.innerText = 'All prizes claimed';
          headerDiv.appendChild(infoSpan);
        }
      }

      ticketEl.appendChild(headerDiv);
      
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(9, 1fr)';
      
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          const val = ticket[r][c];
          const cell = document.createElement('div');
          // Removed aspect ratio and reduced padding for maximum density
          cell.style.border = '1px solid #ddd';
          cell.style.display = 'flex';
          cell.style.alignItems = 'center';
          cell.style.justifyContent = 'center';
          cell.style.fontSize = '1.1rem';
          cell.style.fontWeight = '700';
          cell.style.padding = '2px 0';
          cell.style.color = 'var(--text-main)';
          cell.style.cursor = (val && !isBogey) ? 'pointer' : 'default';
          cell.style.userSelect = 'none';
          
          if (val) {
            cell.innerText = val.toString();
            const state = ticketStates[tIndex][r][c];
            
            if (state.selected) {
              cell.style.backgroundColor = isBogey ? '#ef9a9a' : 'var(--primary-color)';
              cell.style.color = 'white';
            } else {
              cell.style.backgroundColor = isBogey ? 'transparent' : '#fae1e1';
            }

            cell.addEventListener('click', () => {
              if (!state.locked && !isBogey) {
                state.selected = !state.selected;
                renderTickets();
              }
            });
          } else {
            cell.style.backgroundColor = isBogey ? 'transparent' : '#f9f9f9';
          }
          
          grid.appendChild(cell);
        }
      }
      ticketEl.appendChild(grid);

      ticketsContainer.appendChild(ticketEl);
    });
  };

  const startTimer = () => {
    if (isPlaying) return;
    isPlaying = true;
    playPauseBtn.className = 'fa-solid fa-pause';
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

  const bindEvents = () => {
    playPauseBtn.addEventListener('click', () => {
      isPlaying ? pauseTimer() : startTimer();
    });

    currentNumberDisplay.addEventListener('click', () => {
      if (!isPlaying) callNextNumber();
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

    gameState.onNumberCalled = (num: number) => {
      // already locked synchronously in callNextNumber, but good for defensive sync
      lockTickets();
      renderTickets();
    };

    gameState.onClaimResult = (result: any) => {
      if (result.isValid) {
        renderTickets();
      }
      if (gameState.peer && result.playerSocketId === gameState.peer.id) {
        if (result.isValid) {
          CustomAlert("Claim Approved!", `Congratulations! Your claim for ${result.pattern} on Ticket ${result.ticketIndex + 1} was APPROVED!`, "success");
        } else {
          CustomAlert("Bogey!", `Your claim for ${result.pattern} on Ticket ${result.ticketIndex + 1} was REJECTED by Host. Ticket is Disqualified.`, "error");
          disqualifiedTickets[result.ticketIndex] = true;
          renderTickets();
        }
      } else {
        if (result.isValid) {
          CustomAlert("Prize Claimed!", `Player ${result.playerName} has successfully claimed ${result.pattern}!`, "info");
        }
      }
    };

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
