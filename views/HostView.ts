import { navigate } from '../main';
import { gameState } from '../store/GameState';
import { TambolaEngine, TambolaValidator } from '../utils/GameLogic';
import { CustomAlert } from '../utils/CustomAlert';
import { CustomPrompt } from '../utils/CustomPrompt';
import { VoiceUtils } from '../utils/VoiceUtils';

export function HostView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'host-container fade-in';

  let voiceEnabled = true;
  let voiceLanguage: 'en' | 'te' | 'both' = 'en'; // Default to English Only
  let isPlaying = false;
  let timerInterval = 5000; // Default 5 seconds
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
      <header class="host-header" style="background: var(--primary-color); color: white; padding: 1rem; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; flex-direction: column;">
          <h2 style="margin: 0; font-size: 1.2rem;">Tambola Host</h2>
          <div style="font-size: 0.8rem; opacity: 0.9;">Room ID: ${gameState.hostId}</div>
        </div>
        <button id="btn-restart" class="primary-btn" style="background: rgba(255,255,255,0.2); border: 1px solid white; padding: 0.4rem 0.8rem; font-size: 0.8rem;">
          <i class="fa-solid fa-rotate-right"></i> Restart
        </button>
      </header>

      <div class="hud" style="width: 100%; padding: 1rem; text-align: center;">
        <div style="font-size: 0.9rem; color: var(--text-light);">Click number for manual next</div>
        
        <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; margin: 0.5rem 0;">
          <div style="text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Previous</div>
            <div id="prev-num" style="font-size: 1.5rem; font-weight: bold; color: var(--text-main);">-</div>
          </div>
          <div id="curr-num" style="font-size: 4.5rem; font-weight: 800; color: var(--primary-color); min-width: 90px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); cursor: pointer;">
            -
          </div>
          <div style="text-align: center; opacity: 0;"> 
            <div style="font-size: 0.8rem;">Next</div>
            <div style="font-size: 1.5rem;">-</div>
          </div>
        </div>

        <div class="controls" style="display: flex; justify-content: center; gap: 2rem; font-size: 1.8rem; color: var(--text-light); margin-bottom: 0.5rem;">
          <i id="btn-play-pause" class="fa-solid fa-play" style="cursor: pointer; color: var(--primary-color);"></i>
          <i id="btn-voice" class="fa-solid fa-volume-high" style="cursor: pointer;"></i>
          <i id="btn-settings" class="fa-solid fa-gear" style="cursor: pointer;"></i>
        </div>
      </div>

      <div class="tabs" style="display: flex; width: 100%; gap: 10px; padding: 0 1rem; margin-bottom: 1rem;">
        <button id="tab-tickets" class="primary-btn" style="flex: 1; border-radius: 8px; padding: 0.6rem; font-size: 0.9rem;">
           <i class="fa-solid fa-ticket"></i> TICKETS
        </button>
        <button id="tab-prizes" class="primary-btn" style="flex: 1; border-radius: 8px; padding: 0.6rem; font-size: 0.9rem;">
           <i class="fa-solid fa-gift"></i> PRIZES
        </button>
      </div>

      <div id="board-grid" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; width: 100%; padding: 0 1rem; margin-bottom: 1.5rem;">
        <!-- Generated dynamically -->
      </div>
      
      <div style="padding: 0 1rem 1rem 1rem;">
         <button id="btn-back" class="primary-btn" style="width: 100%; background: #444; height: 45px;"><i class="fa-solid fa-circle-xmark"></i> End Game</button>
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
    const drawnNumbers = engine.getDrawnNumbers();
    for (let i = 1; i <= 90; i++) {
      const cell = document.createElement('div');
      cell.innerText = i.toString();
      cell.style.border = '1px solid #eee';
      cell.style.aspectRatio = '1';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.fontSize = '0.85rem';
      cell.style.fontWeight = '600';
      cell.style.color = '#ddd';
      cell.style.backgroundColor = 'white';
      cell.style.borderRadius = '4px';

      if (drawnNumbers.includes(i)) {
        cell.style.backgroundColor = 'var(--primary-color)';
        cell.style.color = 'white';
        cell.style.border = 'none';
        if (drawnNumbers[drawnNumbers.length - 1] === i) {
          cell.style.boxShadow = '0 0 10px var(--primary-color)';
          cell.style.transform = 'scale(1.1)';
          cell.style.zIndex = '1';
        }
      }

      boardGrid.appendChild(cell);
    }
  };

  const speakNumber = (num: number) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();

    const speakEnglish = () => {
      let text = num.toString();
      if (num > 9 && voiceLanguage !== 'both') {
        const chars = text.split('');
        text = `${chars[0]} ${chars[1]}, ${num}`;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.lang = 'en-US';
      if (voiceLanguage === 'both') {
        utterance.onend = () => setTimeout(() => speakTelugu(), 150);
      }
      window.speechSynthesis.speak(utterance);
    };

    const speakTelugu = () => {
      const teluguName = VoiceUtils.getTeluguNumberName(num);
      const teluguDigits = VoiceUtils.getTeluguDigits(num);
      const text = voiceLanguage === 'both' ? teluguName : `${teluguDigits}, ${teluguName}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      const teVoice = VoiceUtils.getTeluguVoice();
      if (teVoice) {
        utterance.voice = teVoice;
        utterance.lang = teVoice.lang;
      } else {
        utterance.lang = 'te-IN';
      }
      window.speechSynthesis.speak(utterance);
    };

    if (voiceLanguage === 'en' || voiceLanguage === 'both') speakEnglish();
    else if (voiceLanguage === 'te') speakTelugu();
  };

  // Warm up voices
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    VoiceUtils.logAvailableVoices();
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

      gameState.onHostError = () => {
        btn.innerText = originalText;
        btn.disabled = false;
        roomIdInput.focus();
        gameState.disconnect();
      };

      gameState.createRoom(roomId);
    });
  };

  const bindEvents = () => {
    playPauseBtn.addEventListener('click', () => isPlaying ? pauseTimer() : startTimer());
    currentNumberDisplay.addEventListener('click', () => { if (!isPlaying) callNextNumber(); });
    voiceBtn.addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      voiceBtn.className = voiceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    });

    container.querySelector('#btn-restart')?.addEventListener('click', () => {
      pauseTimer();
      engine.reset();
      gameState.resetGame();
      currentNumberDisplay.innerText = '-';
      previousNumberDisplay.innerText = '-';
      renderBoard();
      CustomAlert("Game Restarted", "All tickets and numbers have been cleared.", "info");
    });

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      pauseTimer();
      gameState.endGame();
      navigate('home');
    });

    // --- MODALS ---
    const showModal = (title: string, content: string) => {
      const modal = document.createElement('div');
      Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: '2000'
      });
      modal.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 16px; width: 90%; max-width: 400px; max-height: 85vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="color: var(--primary-color); margin: 0;">${title}</h3>
            <i class="fa-solid fa-xmark" id="modal-close" style="cursor: pointer; font-size: 1.5rem; color: #666;"></i>
          </div>
          ${content}
        </div>
      `;
      modal.querySelector('#modal-close')?.addEventListener('click', () => document.body.removeChild(modal));
      document.body.appendChild(modal);
      return modal;
    };

    container.querySelector('#tab-prizes')?.addEventListener('click', () => {
      const claims = gameState.approvedClaims;
      let content = '<div style="display: flex; flex-direction: column; gap: 0.8rem;">';
      if (claims.length === 0) {
        content += '<p style="text-align: center; color: #999; margin: 2rem 0;">No winners yet.</p>';
      } else {
        claims.forEach(claim => {
          content += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: #f9f9f9; border-radius: 8px; border-left: 4px solid var(--primary-color);">
              <div>
                <strong style="color: var(--primary-color);">${claim.pattern}</strong>
              </div>
              <div style="font-size: 0.9rem; font-weight: 600; color: #555;">${claim.playerName}</div>
            </div>
          `;
        });
      }
      content += '</div>';
      showModal('<i class="fa-solid fa-gift"></i> Winners List', content);
    });

    container.querySelector('#tab-tickets')?.addEventListener('click', () => {
      let content = '<div style="display: flex; flex-direction: column; gap: 0.6rem;">';
      if (gameState.players.length === 0) {
        content += '<p style="text-align: center; color: #999; margin: 2rem 0;">No players joined yet.</p>';
      } else {
        gameState.players.forEach(p => {
          content += `
            <button class="player-peek-btn" data-id="${p.socketId}" style="width: 100%; padding: 1rem; border: 1px solid #eee; border-radius: 12px; background: white; text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
              <div>
                <i class="fa-solid fa-user" style="color: var(--primary-color); margin-right: 8px;"></i>
                <strong>${p.name}</strong>
              </div>
              <i class="fa-solid fa-chevron-right" style="color: #ccc;"></i>
            </button>
          `;
        });
      }
      content += '</div>';
      const modal = showModal('<i class="fa-solid fa-users"></i> Joined Players', content);
      
      modal.querySelectorAll('.player-peek-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-id');
          const player = gameState.players.find(p => p.socketId === pid);
          if (player) {
            document.body.removeChild(modal);
            showPlayerTickets(player);
          }
        });
      });
    });

    const showPlayerTickets = (player: any) => {
      let ticketsHtml = '';
      player.tickets.forEach((ticket: any, tIdx: number) => {
        const states = player.ticketStates ? player.ticketStates[tIdx] : null;
        ticketsHtml += `<h4 style="margin: 1.2rem 0 0.6rem 0; font-size: 0.9rem; color: #555; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-ticket" style="color: var(--primary-color);"></i> Ticket #${tIdx + 1}
        </h4>`;
        
        ticketsHtml += '<div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; background: #eee; border-radius: 8px; padding: 4px; border: 1px solid #ddd;">';
        
        ticket.forEach((row: any, rIdx: number) => {
          row.forEach((cell: any, cIdx: number) => {
            const isMarkedByPlayer = states ? states[rIdx][cIdx].selected : false;
            const isMarkedByHost = engine.getDrawnNumbers().includes(cell);
            
            // Background Colors:
            // - Empty: #f9f9f9
            // - Marked by both: primary color
            // - Marked ONLY by player: #4caf50 (Green)
            // - Drawn by host only (but cell not empty): primary-color with opacity
            
            let bgColor = '#f9f9f9';
            let textColor = 'var(--text-main)';
            let borderStyle = 'none';

            if (cell && cell !== 0) {
              if (isMarkedByPlayer && isMarkedByHost) {
                bgColor = 'var(--primary-color)';
                textColor = 'white';
              } else if (isMarkedByPlayer) {
                bgColor = '#4caf50'; // Green for player selection
                textColor = 'white';
              } else if (isMarkedByHost) {
                bgColor = 'var(--primary-color)';
                textColor = 'white';
                borderStyle = '1px dashed white'; // Distinguish if host matched but player didn't click
              }
            } else {
              bgColor = '#f4f4f4';
            }
            
            ticketsHtml += `
              <div style="background: ${bgColor}; color: ${textColor}; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 4px; border: ${borderStyle};">
                ${(cell === 0 || !cell) ? '' : cell}
              </div>
            `;
          });
        });
        ticketsHtml += '</div>';
      });

      const modal = showModal(`${player.name}'s Tickets`, ticketsHtml || '<p>No tickets generated yet.</p>');
      const backBtn = document.createElement('button');
      backBtn.className = 'primary-btn';
      backBtn.style.marginTop = '1.5rem';
      backBtn.style.width = '100%';
      backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Players';
      backBtn.onclick = () => {
        document.body.removeChild(modal);
        container.querySelector<HTMLElement>('#tab-tickets')?.click();
      };
      modal.querySelector('div')?.appendChild(backBtn);
    };

    container.querySelector('#btn-settings')?.addEventListener('click', () => {
      const content = `
        <div style="display: flex; flex-direction: column; gap: 1.2rem;">
          <div>
            <label style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.8rem;">Call Interval (Seconds)</label>
            <div style="display: grid; grid-template-columns: 50px 1fr 50px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; height: 45px;">
              <button id="timer-minus" style="border: none; background: #f5f5f5; font-size: 1.2rem; cursor: pointer;">-</button>
              <div id="timer-val" style="display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; background: white;">${timerInterval / 1000}</div>
              <button id="timer-plus" style="border: none; background: #f5f5f5; font-size: 1.2rem; cursor: pointer;">+</button>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.8rem;">Voice Language</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; height: 45px;">
              <button class="lang-opt" data-val="en" style="border: none; background: ${voiceLanguage === 'en' ? 'var(--primary-color)' : 'white'}; color: ${voiceLanguage === 'en' ? 'white' : 'black'}; font-weight: 600; cursor: pointer;">A</button>
              <button class="lang-opt" data-val="both" style="border: none; background: ${voiceLanguage === 'both' ? 'var(--primary-color)' : 'white'}; color: ${voiceLanguage === 'both' ? 'white' : 'black'}; font-weight: 600; border-left: 1px solid #ddd; border-right: 1px solid #ddd; cursor: pointer;">A ?</button>
              <button class="lang-opt" data-val="te" style="border: none; background: ${voiceLanguage === 'te' ? 'var(--primary-color)' : 'white'}; color: ${voiceLanguage === 'te' ? 'white' : 'black'}; font-weight: 600; cursor: pointer;">?</button>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #888; margin-top: 4px; padding: 0 4px;">
              <span>English</span>
              <span>Both</span>
              <span>Telugu</span>
            </div>
          </div>

          <button id="set-save" class="primary-btn" style="margin-top: 0.5rem;">Done</button>
        </div>
      `;
      const modal = showModal('<i class="fa-solid fa-gear"></i> Settings', content);
      
      let tempTimer = timerInterval / 1000;
      let tempLang = voiceLanguage;

      modal.querySelector('#timer-minus')?.addEventListener('click', () => {
        if (tempTimer > 4) { tempTimer--; modal.querySelector('#timer-val')!.innerHTML = tempTimer.toString(); }
      });
      modal.querySelector('#timer-plus')?.addEventListener('click', () => {
        if (tempTimer < 10) { tempTimer++; modal.querySelector('#timer-val')!.innerHTML = tempTimer.toString(); }
      });

      modal.querySelectorAll('.lang-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          tempLang = opt.getAttribute('data-val') as any;
          modal.querySelectorAll('.lang-opt').forEach(o => {
            (o as HTMLElement).style.backgroundColor = 'white';
            (o as HTMLElement).style.color = 'black';
          });
          (opt as HTMLElement).style.backgroundColor = 'var(--primary-color)';
          (opt as HTMLElement).style.color = 'white';
        });
      });

      modal.querySelector('#set-save')?.addEventListener('click', () => {
        timerInterval = tempTimer * 1000;
        voiceLanguage = tempLang;
        if (isPlaying) { pauseTimer(); startTimer(); }
        document.body.removeChild(modal);
      });
    });

    gameState.onPlayerClaimed = (claim: any) => {
      pauseTimer();
      const isValidAlgorithmically = TambolaValidator.verifyPattern(claim.ticket, engine.getDrawnNumbers(), claim.pattern);
      const modalHtml = `
        <div style="text-align: center;">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;"><strong>${claim.playerName}</strong> claims <strong>${claim.pattern}</strong> !</p>
          <div style="background: ${isValidAlgorithmically ? '#e8f5e9' : '#ffebee'}; padding: 1rem; border-radius: 8px; margin: 1rem 0; border: 1px solid ${isValidAlgorithmically ? '#2e7d32' : '#c62828'};">
            Auto Validator: <strong style="color: ${isValidAlgorithmically ? '#2e7d32' : '#c62828'};">${isValidAlgorithmically ? 'PATTERN MET' : 'PATTERN NOT MET'}</strong>
          </div>
          <p style="font-size: 0.85rem; color: #666; margin-bottom: 1.5rem;">Verify carefully before approving.</p>
          <div style="display: flex; gap: 1rem;">
            <button id="btn-approve" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="btn-bogey" class="primary-btn" style="flex: 1;">Bogey</button>
          </div>
        </div>
      `;
      const modal = showModal('Verify Claim', modalHtml);
      modal.querySelector('#btn-approve')?.addEventListener('click', () => {
        gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, true);
        document.body.removeChild(modal);
      });
      modal.querySelector('#btn-bogey')?.addEventListener('click', () => {
        gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, false);
        document.body.removeChild(modal);
      });
    };

    gameState.onClaimResult = (result: any) => {
      if (result.isValid) {
        CustomAlert("Prize Claimed!", `${result.playerName} won ${result.pattern}!`, "success");
      }
    };

    gameState.onJoinRequested = (peerId: string, playerName: string, ticketCount: number) => {
      pauseTimer();
      const modalHtml = `
        <div style="text-align: center;">
          <p style="font-size: 1.1rem; margin-bottom: 1.5rem;"><strong>${playerName}</strong> wants to join with <strong>${ticketCount} tickets</strong>.</p>
          <div style="display: flex; gap: 1rem;">
            <button id="btn-approve-join" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="btn-reject-join" class="primary-btn" style="flex: 1; background: #c62828;">Reject</button>
          </div>
        </div>
      `;
      const modal = showModal('Join Request', modalHtml);
      modal.querySelector('#btn-approve-join')?.addEventListener('click', () => {
        gameState.approveJoin(peerId, playerName);
        document.body.removeChild(modal);
      });
      modal.querySelector('#btn-reject-join')?.addEventListener('click', () => {
        gameState.rejectJoin(peerId);
        document.body.removeChild(modal);
      });
    };
  };

  renderSetupForm();
  return container;
}
