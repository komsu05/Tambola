import { navigate } from '../main';
import { gameState } from '../store/GameState';
import { TambolaEngine, TambolaValidator } from '../utils/GameLogic';
import { TicketGenerator, Ticket } from '../utils/TicketGenerator';
import { CustomAlert } from '../utils/CustomAlert';
import { CustomPrompt } from '../utils/CustomPrompt';
import { VoiceUtils } from '../utils/VoiceUtils';

export function HostPlayerView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'host-player-container fade-in';

  let voiceEnabled = true;
  let voiceLanguage: 'en' | 'te' | 'both' = 'en'; // Default to English Only
  let isPlaying = false;
  let timerInterval = 5000; // Default 5 seconds
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

  const saveHostPlayerState = () => {
    const data = {
      tickets: myTickets,
      states: ticketStates,
      disqualified: disqualifiedTickets
    };
    localStorage.setItem('tambola_hostplayer_data', JSON.stringify(data));
  };

  const loadHostPlayerState = () => {
    const saved = localStorage.getItem('tambola_hostplayer_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        myTickets = data.tickets || [];
        ticketStates = data.states || [];
        disqualifiedTickets = data.disqualified || [];
        return true;
      } catch (e) { console.error(e); }
    }
    return false;
  };

  const renderSetupForm = () => {
    const hasRecovered = loadHostPlayerState();
    container.innerHTML = `
      <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem; text-align: center;">
        <h2 style="color: var(--primary-color); margin-bottom: 1rem;">Host & Play</h2>
        <input type="text" id="host-id-input" placeholder="Room/Host ID" value="${gameState.hostId || Math.floor(1000 + Math.random() * 9000)}" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1.2rem; text-align: center; font-weight: bold; letter-spacing: 2px;">
        
        <select id="ticket-count" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1.1rem; text-align: center;">
          <option value="1">1 Ticket</option>
          <option value="2" selected>2 Tickets</option>
          <option value="3">3 Tickets</option>
          <option value="4">4 Tickets</option>
          <option value="5">5 Tickets</option>
          <option value="6">6 Tickets</option>
        </select>

        <button id="btn-create" class="primary-btn" style="margin-top: 1rem;">${hasRecovered ? 'Resume Room' : 'Start Game'}</button>
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
      btn.innerText = "Starting...";
      btn.disabled = true;

      gameState.onHostCreated = () => {
        if (!hasRecovered || myTickets.length === 0) {
          const fullSet = TicketGenerator.generateSetOf6();
          myTickets = fullSet.slice(0, count);
          initTicketStates();
        }
        renderUI();
        saveHostPlayerState();
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

  const initTicketStates = () => {
    disqualifiedTickets = myTickets.map(() => false);
    ticketStates = myTickets.map(() =>
      Array.from({ length: 3 }, () =>
        Array.from({ length: 9 }, () => ({ selected: false, locked: false }))
      )
    );
  };

  const renderUI = () => {
    container.innerHTML = `
      <header class="host-header" style="background: var(--primary-color); color: white; padding: 1rem; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; flex-direction: column;">
          <h2 style="margin: 0; font-size: 1.1rem;">Host <i class="fa-solid fa-user-plus"></i> Play</h2>
          <div style="font-size: 0.75rem; opacity: 0.9;">Room: ${gameState.hostId}</div>
        </div>
        <button id="btn-restart" class="primary-btn" style="background: rgba(255,255,255,0.2); border: 1px solid white; padding: 0.4rem 0.8rem; font-size: 0.75rem;">
          <i class="fa-solid fa-rotate-right"></i> Restart
        </button>
      </header>

      <div class="hud" style="width: 100%; padding: 0.8rem; text-align: center; border-bottom: 1px solid #eee;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 2rem;">
          <div style="text-align: center;">
            <div style="font-size: 0.7rem; color: #999;">Prev</div>
            <div id="prev-num" style="font-size: 1.2rem; font-weight: bold; color: #666;">-</div>
          </div>
          <div id="curr-num" style="font-size: 4rem; font-weight: 800; color: var(--primary-color); min-width: 90px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); cursor: pointer;">
            -
          </div>
          <div style="text-align: center; opacity:0;">
            <div style="font-size: 0.7rem;">Next</div>
            <div style="font-size: 1.2rem;">-</div>
          </div>
        </div>

        <div class="controls" style="display: flex; justify-content: center; gap: 2rem; font-size: 1.6rem; color: #aaa; margin-top: 0.5rem;">
          <i id="btn-play-pause" class="fa-solid fa-play" style="cursor: pointer; color: var(--primary-color);"></i>
          <i id="btn-voice" class="fa-solid fa-volume-high" style="cursor: pointer;"></i>
          <i id="btn-fullscreen" class="fa-solid fa-expand" style="cursor: pointer;"></i>
          <i id="btn-settings" class="fa-solid fa-gear" style="cursor: pointer;"></i>
        </div>
      </div>

      <div class="tabs" style="display: flex; width: 100%; gap: 10px; padding: 0.5rem 1rem; background: #f8f9fa;">
        <button id="tab-tickets" class="primary-btn" style="flex: 1; border-radius: 8px; padding: 0.5rem; font-size: 0.8rem;">
           <i class="fa-solid fa-users"></i> PLAYERS
        </button>
        <button id="tab-prizes" class="primary-btn" style="flex: 1; border-radius: 8px; padding: 0.5rem; font-size: 0.8rem;">
           <i class="fa-solid fa-gift"></i> PRIZES
        </button>
      </div>

      <div id="tickets-container" style="padding: 0.5rem; display: flex; flex-direction: column; gap: 0.8rem; overflow-y: auto; flex: 1; width: 100%; background: #f0f2f5;">
      </div>

      <div style="padding: 0.8rem;">
         <button id="btn-back" class="primary-btn" style="width: 100%; background: #444; height: 45px;"><i class="fa-solid fa-circle-xmark"></i> End Game</button>
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
      utterance.rate = 0.95;
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

  const callNextNumber = () => {
    const nextNum = engine.drawNextNumber();
    if (nextNum === null) {
      pauseTimer();
      CustomAlert("Game Over", "All numbers drawn!", "info");
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
    gameState.callNumber(nextNum);

    lockTickets();
    saveHostPlayerState();
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
      ticketEl.style.backgroundColor = 'white';
      ticketEl.style.border = isBogey ? '2px solid #ff5252' : '1px solid #ddd';
      ticketEl.style.borderRadius = '12px';
      ticketEl.style.overflow = 'hidden';
      ticketEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      ticketEl.style.opacity = isBogey ? '0.7' : '1';
      ticketEl.style.flexShrink = '0';

      const headerDiv = document.createElement('div');
      headerDiv.style.background = isBogey ? '#ff5252' : '#f8f9fa';
      headerDiv.style.color = isBogey ? 'white' : 'var(--text-main)';
      headerDiv.style.padding = '0.5rem 0.8rem';
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'center';
      headerDiv.style.borderBottom = '1px solid #eee';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontSize = '0.75rem';
      titleSpan.style.fontWeight = 'bold';
      titleSpan.innerText = `MY TICKET #${tIndex + 1} ${isBogey ? '(BOGEY)' : ''}`;
      headerDiv.appendChild(titleSpan);

      if (!isBogey) {
        const availablePatterns = [
          "Early 5", "Top Row", "Middle Row", "Bottom Row", "Full House"
        ].filter(p => !gameState.approvedClaims.some(c => c.pattern === p));

        if (availablePatterns.length > 0) {
          const claimContainer = document.createElement('div');
          claimContainer.style.display = 'flex';
          claimContainer.style.gap = '0.4rem';

          const optionsHtml = availablePatterns.map(p => `<option value="${p}">${p}</option>`).join('');
          claimContainer.innerHTML = `
            <select class="claim-select" style="padding: 2px; border-radius: 4px; font-size: 0.7rem;">
              ${optionsHtml}
            </select>
            <button class="btn-claim" style="padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; border: none; background: var(--primary-color); color: white; cursor: pointer; font-weight: bold;">Claim</button>
          `;

          claimContainer.querySelector('.btn-claim')?.addEventListener('click', () => {
            const pattern = (claimContainer.querySelector('.claim-select') as HTMLSelectElement).value;
            gameState.claimDividend(tIndex, pattern, ticket);
            CustomAlert("Claim Sent", `Claim for ${pattern} sent!`, "info");
          });

          headerDiv.appendChild(claimContainer);
        }
      }

      ticketEl.appendChild(headerDiv);

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(9, 1fr)';
      grid.style.padding = '4px';
      grid.style.gap = '2px';

      for (let r = 0; r < 3; r++) {
        // Find if this row is near completion (4 out of 5 numbers selected)
        let rowNumbers = 0;
        let selectedCount = 0;
        let unselectedCol = -1;

        for (let c = 0; c < 9; c++) {
          if (ticket[r][c]) {
            rowNumbers++;
            if (ticketStates[tIndex][r][c].selected) {
              selectedCount++;
            } else {
              unselectedCol = c;
            }
          }
        }
        const isNearComplete = (rowNumbers === 5 && selectedCount === 4);

        for (let c = 0; c < 9; c++) {
          const val = ticket[r][c];
          const cell = document.createElement('div');
          cell.style.aspectRatio = '1';
          cell.style.display = 'flex';
          cell.style.alignItems = 'center';
          cell.style.justifyContent = 'center';
          cell.style.fontSize = '1.1rem';
          cell.style.fontWeight = '800';
          cell.style.borderRadius = '4px';
          cell.style.color = 'var(--text-main)';
          cell.style.cursor = (val && !isBogey) ? 'pointer' : 'default';

          if (val) {
            cell.innerText = val.toString();
            const state = ticketStates[tIndex][r][c];
            if (state.selected) {
              cell.style.backgroundColor = 'var(--primary-color)';
              cell.style.color = 'white';
            } else {
              cell.style.backgroundColor = '#fae1e1';
              if (isNearComplete && c === unselectedCol && !isBogey) {
                cell.classList.add('near-complete');
              }
            }

            cell.addEventListener('click', () => {
              if (!state.locked && !isBogey) {
                state.selected = !state.selected;
                saveHostPlayerState();
                renderTickets();
              }
            });
          } else {
            cell.style.backgroundColor = '#f4f4f4';
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
    intervalId = setInterval(callNextNumber, timerInterval);
  };

  const pauseTimer = () => {
    isPlaying = false;
    playPauseBtn.className = 'fa-solid fa-play';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
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

      // Regenerate tickets
      const fullSet = TicketGenerator.generateSetOf6();
      myTickets = fullSet.slice(0, myTickets.length || 1);

      initTicketStates();
      saveHostPlayerState();
      renderTickets();
      CustomAlert("Restarted", "Board cleared and tickets regenerated.", "info");
    });

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      pauseTimer();
      gameState.endGame();
      navigate('home');
    });

    container.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
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
        <div style="background: white; padding: 1.5rem; border-radius: 16px; width: 92%; max-width: 400px; max-height: 85vh; overflow-y: auto;">
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
      if (claims.length === 0) content += '<p style="text-align: center; color: #999;">No winners yet.</p>';
      else {
        claims.forEach(claim => {
          content += `
            <div style="display: flex; justify-content: space-between; padding: 0.8rem; background: #f9f9f9; border-radius: 8px; border-left: 4px solid var(--primary-color);">
              <strong style="color: var(--primary-color);">${claim.pattern}</strong>
              <div style="font-size: 0.8rem; font-weight: 600; color: #555;">${claim.playerName}</div>
            </div>
          `;
        });
      }
      content += '</div>';
      showModal('Winners', content);
    });

    container.querySelector('#tab-tickets')?.addEventListener('click', () => {
      let content = '<div style="display: flex; flex-direction: column; gap: 0.6rem;">';
      if (gameState.players.length === 0) content += '<p style="text-align: center; color: #999;">No other players.</p>';
      else {
        gameState.players.forEach(p => {
          content += `
            <button class="player-peek-btn" data-id="${p.socketId}" style="width: 100%; padding: 0.8rem; border: 1px solid #eee; border-radius: 8px; background: white; text-align: left; display: flex; justify-content: space-between; cursor: pointer;">
              <strong>${p.name}</strong>
              <i class="fa-solid fa-chevron-right" style="color: #ccc;"></i>
            </button>
          `;
        });
      }
      content += '</div>';
      const modal = showModal('Joined Players', content);
      modal.querySelectorAll('.player-peek-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-id');
          const player = gameState.players.find(p => p.socketId === pid);
          if (player) { document.body.removeChild(modal); showPlayerTickets(player); }
        });
      });
    });

    const showPlayerTickets = (player: any) => {
      let txHtml = '';
      player.tickets.forEach((ticket: any, tIdx: number) => {
        const states = player.ticketStates ? player.ticketStates[tIdx] : null;
        txHtml += `<h4 style="margin: 1rem 0 0.5rem 0; font-size: 0.85rem; color: #555;">Ticket #${tIdx + 1}</h4>`;
        txHtml += '<div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; background: #eee; border-radius: 6px; padding: 3px;">';
        ticket.forEach((row: any, rIdx: number) => row.forEach((cell: any, cIdx: number) => {
          const isMarkedByPlayer = states ? states[rIdx][cIdx].selected : false;
          const isMarkedByHost = engine.getDrawnNumbers().includes(cell);

          let bgColor = '#f9f9f9';
          let textColor = 'black';

          if (cell && cell !== 0) {
            if (isMarkedByPlayer && isMarkedByHost) { bgColor = 'var(--primary-color)'; textColor = 'white'; }
            else if (isMarkedByPlayer) { bgColor = '#4caf50'; textColor = 'white'; } // Player Selection (Green)
            else if (isMarkedByHost) { bgColor = 'var(--primary-color)'; textColor = 'white'; }
          } else {
            bgColor = '#f4f4f4';
          }

          txHtml += `<div style="background: ${bgColor}; color: ${textColor}; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; border-radius: 3px;">${(cell === 0 || !cell) ? '' : cell}</div>`;
        }));
        txHtml += '</div>';
      });
      const m = showModal(`${player.name}'s Tickets`, txHtml || '<p>No tickets.</p>');
      const b = document.createElement('button');
      b.className = 'primary-btn'; b.style.marginTop = '1rem'; b.style.width = '100%'; b.innerText = "Back";
      b.onclick = () => { document.body.removeChild(m); container.querySelector<HTMLElement>('#tab-tickets')?.click(); };
      m.querySelector('div')?.appendChild(b);
    };

    container.querySelector('#btn-settings')?.addEventListener('click', () => {
      const content = `
        <div style="display: flex; flex-direction: column; gap: 1.2rem;">
          <div>
            <label style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.8rem;">Call Interval</label>
            <div style="display: grid; grid-template-columns: 50px 1fr 50px; border: 1px solid #ddd; border-radius: 8px; height: 45px;">
              <button id="t-m" style="border:none; background:#f5f5f5;">-</button>
              <div id="t-v" style="display:flex; align-items:center; justify-content:center; font-weight:bold;">${timerInterval / 1000}</div>
              <button id="t-p" style="border:none; background:#f5f5f5;">+</button>
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.8rem;">Language</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ddd; border-radius: 8px; height: 45px;">
              <button class="l-o" data-val="en" style="border:none; background:${voiceLanguage === 'en' ? 'var(--primary-color)' : 'white'}; color:${voiceLanguage === 'en' ? 'white' : 'black'};">A</button>
              <button class="l-o" data-val="both" style="border:none; background:${voiceLanguage === 'both' ? 'var(--primary-color)' : 'white'}; color:${voiceLanguage === 'both' ? 'white' : 'black'};">A ?</button>
              <button class="l-o" data-val="te" style="border:none; background:${voiceLanguage === 'te' ? 'var(--primary-color)' : 'white'}; color:${voiceLanguage === 'te' ? 'white' : 'black'};">?</button>
            </div>
          </div>
          <button id="s-v" class="primary-btn">Save</button>
        </div>
      `;
      const m = showModal('Settings', content);
      let tT = timerInterval / 1000; let tL = voiceLanguage;
      m.querySelector('#t-m')?.addEventListener('click', () => { if (tT > 4) { tT--; m.querySelector('#t-v')!.innerHTML = tT.toString(); } });
      m.querySelector('#t-p')?.addEventListener('click', () => { if (tT < 10) { tT++; m.querySelector('#t-v')!.innerHTML = tT.toString(); } });
      m.querySelectorAll('.l-o').forEach(o => o.addEventListener('click', () => {
        tL = o.getAttribute('data-val') as any;
        m.querySelectorAll('.l-o').forEach(x => { (x as HTMLElement).style.background = 'white'; (x as HTMLElement).style.color = 'black'; });
        (o as HTMLElement).style.background = 'var(--primary-color)'; (o as HTMLElement).style.color = 'white';
      }));
      m.querySelector('#s-v')?.addEventListener('click', () => {
        timerInterval = tT * 1000; voiceLanguage = tL; if (isPlaying) { pauseTimer(); startTimer(); }
        document.body.removeChild(m);
      });
    });

    gameState.onPlayerClaimed = (claim: any) => {
      pauseTimer();
      const valid = TambolaValidator.verifyPattern(claim.ticket, engine.getDrawnNumbers(), claim.pattern);
      const html = `
        <div style="text-align: center;">
          <p><strong>${claim.playerName}</strong> claims <strong>${claim.pattern}</strong> !</p>
          <div style="background: ${valid ? '#e8f5e9' : '#ffebee'}; padding: 1rem; border-radius: 8px; margin: 1rem 0; border: 1px solid ${valid ? '#2e7d32' : '#c62828'};">
            Auto Validator: <strong>${valid ? 'MET' : 'NOT MET'}</strong>
          </div>
          <div style="display: flex; gap: 1rem;">
            <button id="b-a" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="b-b" class="primary-btn" style="flex: 1;">Bogey</button>
          </div>
        </div>
      `;
      const m = showModal('Verify Claim', html);
      m.querySelector('#b-a')?.addEventListener('click', () => { gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, true); document.body.removeChild(m); });
      m.querySelector('#b-b')?.addEventListener('click', () => { gameState.verifyClaim(claim.playerSocketId, claim.ticketIndex, claim.pattern, false); document.body.removeChild(m); });
    };

    gameState.onJoinRequested = (id, name, count) => {
      pauseTimer();
      const html = `
        <div style="text-align: center;">
          <p><strong>${name}</strong> wants to join (${count} tickets).</p>
          <div style="display: flex; gap: 1rem;">
            <button id="j-a" class="primary-btn" style="flex: 1; background: #2e7d32;">Approve</button>
            <button id="j-r" class="primary-btn" style="flex: 1; background: #c62828;">Reject</button>
          </div>
        </div>
      `;
      const m = showModal('Join Request', html);
      m.querySelector('#j-a')?.addEventListener('click', () => { gameState.approveJoin(id, name); document.body.removeChild(m); });
      m.querySelector('#j-r')?.addEventListener('click', () => { gameState.rejectJoin(id); document.body.removeChild(m); });
    };
  };

  renderSetupForm(); // Initial render

  return container;
}
