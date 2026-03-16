import { navigate } from '../main';
import { gameState } from '../store/GameState';
import { TicketGenerator, Ticket } from '../utils/TicketGenerator';
import { CustomAlert } from '../utils/CustomAlert';

export function PlayerView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'player-container fade-in';

  let myTickets: Ticket[] = [];
  // store state of clicked cells: locked (boolean) or selected (boolean)
  // maps ticketIndex -> rowIndex -> colIndex -> { selected: boolean, locked: boolean }
  let ticketStates: { selected: boolean, locked: boolean }[][][] = [];
  let disqualifiedTickets: boolean[] = [];
  let isReconnecting = false;

  const savePlayerState = () => {
    const data = {
      tickets: myTickets,
      states: ticketStates,
      disqualified: disqualifiedTickets
    };
    localStorage.setItem('tambola_player_data', JSON.stringify(data));
  };

  const loadPlayerState = () => {
    const saved = localStorage.getItem('tambola_player_data');
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

  const renderJoinForm = () => {
    // Check for existing session
    const hasRecovered = loadPlayerState();

    container.innerHTML = `
      <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem;">
        <h2 style="color: var(--primary-color)">Join Game</h2>
        <input type="text" id="host-id" placeholder="Host ID" value="${gameState.hostId}" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
        <input type="text" id="player-name" placeholder="Your Name" value="${gameState.playerName || 'Player'}" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
        <select id="ticket-count" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
          <option value="1">1 Ticket</option>
          <option value="2">2 Tickets</option>
          <option value="3">3 Tickets</option>
          <option value="4">4 Tickets</option>
          <option value="5">5 Tickets</option>
          <option value="6">6 Tickets</option>
        </select>
        <button id="btn-join" class="primary-btn">${hasRecovered ? 'Reconnect Game' : 'Join Game'}</button>
        <button id="btn-back" class="primary-btn" style="background:#666;">Back</button>
      </div>
    `;

    container.querySelector('#btn-back')?.addEventListener('click', () => navigate('home'));
    container.querySelector('#btn-join')?.addEventListener('click', () => {
      const hostId = (container.querySelector('#host-id') as HTMLInputElement).value;
      const playerName = (container.querySelector('#player-name') as HTMLInputElement).value;
      const count = parseInt((container.querySelector('#ticket-count') as HTMLSelectElement).value, 10);

      if (!hostId) {
        CustomAlert("Missing Input", "Please enter Host ID", "error");
        return;
      }

      const btn = container.querySelector('#btn-join') as HTMLButtonElement;
      const originalText = btn.innerText;
      btn.innerText = "Connecting...";
      btn.disabled = true;

      gameState.onJoinApproved = () => {
        if (!hasRecovered || myTickets.length === 0) {
          const fullSet = TicketGenerator.generateSetOf6();
          myTickets = fullSet.slice(0, count);
          initTicketStates();
        }
        gameState.syncTickets(myTickets, ticketStates);
        renderTickets();
        savePlayerState();
      };

      gameState.onJoinRejected = () => {
        CustomAlert("Host Denied", "Your join request was rejected by the Host.", "error");
        btn.innerText = originalText;
        btn.disabled = false;
        gameState.disconnect();
      };

      gameState.onJoinError = (msg) => {
        btn.innerText = originalText;
        btn.disabled = false;
        gameState.disconnect();
      };

      gameState.joinRoom(hostId, playerName, count, myTickets, ticketStates);
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

  gameState.onNumberCalled = (num: number) => {
    // When a new number is called, lock all currently selected numbers
    for (let t = 0; t < ticketStates.length; t++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          if (ticketStates[t][r][c].selected) {
            ticketStates[t][r][c].locked = true;
          }
        }
      }
    }
    savePlayerState();
    renderTicketsUIOnly();
  };

  gameState.onGameReset = () => {
    CustomAlert("Game Restarted", "A new game has started! Your tickets have been regenerated.", "info", () => {
      // Regenerate tickets
      const fullSet = TicketGenerator.generateSetOf6();
      myTickets = fullSet.slice(0, myTickets.length || 1);
      initTicketStates();
      savePlayerState();

      // Sync new tickets to host
      gameState.syncTickets(myTickets, ticketStates);
      renderTickets();
    });
  };

  gameState.onGameEnded = () => {
    CustomAlert("Game Ended", "The host has ended the game.", "info", () => {
      localStorage.removeItem('tambola_player_data');
      localStorage.removeItem('tambola_game_state');
      navigate('home-player'); // Go back to join page
    });
  };

  gameState.onConnectionLost = () => {
    if (isReconnecting) return;
    isReconnecting = true;

    const banner = document.createElement('div');
    banner.id = 'recon-banner';
    Object.assign(banner.style, {
      position: 'fixed', bottom: '0', left: '0', width: '100%',
      backgroundColor: '#ff9800', color: 'white', padding: '0.5rem',
      textAlign: 'center', zIndex: '5000', fontSize: '0.8rem'
    });
    banner.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Host Connection Lost. Reconnecting...';
    document.body.appendChild(banner);

    const retryInterval = setInterval(() => {
      if (!isReconnecting) {
        clearInterval(retryInterval);
        return;
      }
      console.log("Attempting to reconnect...");
      gameState.joinRoom(gameState.hostId, gameState.playerName, myTickets.length, myTickets, ticketStates);
    }, 5000);

    const originalJoinApproved = gameState.onJoinApproved;
    gameState.onJoinApproved = () => {
      isReconnecting = false;
      clearInterval(retryInterval);
      const b = document.getElementById('recon-banner');
      if (b) b.remove();
      CustomAlert("Reconnected", "Back online!", "success");
      if (originalJoinApproved) originalJoinApproved();
      renderTicketsUIOnly();
    };
  };

  gameState.onClaimResult = (result: any) => {
    if (result.isValid) {
      renderTicketsUIOnly();
    }
    if (gameState.peer && result.playerSocketId === gameState.peer.id) {
      if (result.isValid) {
        CustomAlert("Claim Approved!", `Congratulations! Your claim for ${result.pattern} was APPROVED!`, "success");
      } else {
        CustomAlert("Bogey!", `Your claim for ${result.pattern} was REJECTED. Ticket is Disqualified.`, "error");
        disqualifiedTickets[result.ticketIndex] = true;
        savePlayerState();
        renderTicketsUIOnly();
      }
    } else {
      if (result.isValid) {
        CustomAlert("Prize Claimed!", `${result.playerName} won ${result.pattern}!`, "info");
      }
    }
  };

  let showClaimHeadings = false; // Hidden by default

  const renderTickets = () => {
    container.style.cssText = `
      flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 100vh;
    `;

    container.innerHTML = `
      <header id="player-header" style="
        background: var(--primary-color); color: white; display: flex;
        align-items: center; justify-content: space-between; padding: 0 0.8rem;
        height: 45px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      ">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button id="btn-exit" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div style="font-size: 0.6rem; line-height: 1;">ROOM<br><strong>${gameState.hostId}</strong></div>
        </div>

        <h3 style="margin:0; font-size: 0.9rem; font-weight:700;">${gameState.playerName.toUpperCase()}</h3>

        <div style="display:flex; gap: 0.8rem; align-items: center;">
          <i id="btn-fullscreen" class="fa-solid fa-expand" style="cursor: pointer; font-size: 1.1rem;"></i>
          <i id="claim-icon" class="fa-solid fa-tag" style="cursor: pointer; font-size: 1.1rem; opacity: 0.5;"></i>
        </div>
      </header>

      <div id="tickets-container" style="
        padding: 4px; display: flex; flex-direction: column;
        gap: 8px; overflow-y: auto; flex: 1;
        background: #f0f2f5;
      "></div>
    `;

    container.querySelector('#btn-exit')?.addEventListener('click', () => {
      CustomAlert("Exit Game?", "Do you want to leave this game?", "info", () => {
        gameState.disconnect();
        localStorage.removeItem('tambola_player_data');
        localStorage.removeItem('tambola_game_state');
        window.location.reload();
      });
    });

    container.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });

    container.querySelector('#claim-icon')?.addEventListener('click', () => {
      showClaimHeadings = !showClaimHeadings;
      (container.querySelector('#claim-icon') as HTMLElement).style.opacity = showClaimHeadings ? '1' : '0.5';
      renderTicketsUIOnly();
    });

    renderTicketsUIOnly();
  };

  const renderTicketsUIOnly = () => {
    const tContainer = container.querySelector('#tickets-container') as HTMLElement;
    if (!tContainer) return;
    tContainer.innerHTML = '';

    myTickets.forEach((ticket, tIndex) => {
      const isBogey = disqualifiedTickets[tIndex];

      const ticketEl = document.createElement('div');
      ticketEl.style.backgroundColor = 'white';
      ticketEl.style.border = isBogey ? '2px solid #ff5252' : '1px solid #ddd';
      ticketEl.style.borderRadius = '12px';
      ticketEl.style.overflow = 'hidden';
      ticketEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      ticketEl.style.opacity = isBogey ? '0.7' : '1';

      const headerDiv = document.createElement('div');
      headerDiv.style.background = isBogey ? '#ff5252' : '#f8f9fa';
      headerDiv.style.color = isBogey ? 'white' : 'var(--text-main)';
      headerDiv.style.padding = '0.5rem 0.8rem';
      headerDiv.style.display = showClaimHeadings ? 'flex' : 'none';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'center';
      headerDiv.style.borderBottom = '1px solid #eee';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontSize = '0.8rem';
      titleSpan.style.fontWeight = 'bold';
      titleSpan.innerText = `TICKET #${tIndex + 1} ${isBogey ? '(BOGEY)' : ''}`;
      headerDiv.appendChild(titleSpan);

      if (!isBogey) {
        const availablePatterns = [
          "Early 5", "Top Row", "Middle Row", "Bottom Row", "Full House"
        ].filter(p => !gameState.approvedClaims.some(c => c.pattern === p));

        if (availablePatterns.length > 0) {
          const claimContainer = document.createElement('div');
          claimContainer.style.display = 'flex';
          claimContainer.style.gap = '0.5rem';

          const optionsHtml = availablePatterns.map(p => `<option value="${p}">${p}</option>`).join('');
          claimContainer.innerHTML = `
            <select class="claim-select" style="padding: 2px; border-radius: 4px; font-size: 0.7rem; border: 1px solid #ccc;">
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
          cell.style.cursor = (val && !isBogey) ? 'pointer' : 'default';

          if (val) {
            cell.innerText = val.toString();
            const state = ticketStates[tIndex][r][c];
            if (state.selected) {
              cell.style.backgroundColor = 'var(--primary-color)';
              cell.style.color = 'white';
            } else {
              cell.style.backgroundColor = '#fae1e1';
              cell.style.color = 'var(--text-main)';
              if (isNearComplete && c === unselectedCol && !isBogey) {
                cell.classList.add('near-complete');
              }
            }

            cell.addEventListener('click', () => {
              if (!state.locked && !isBogey) {
                state.selected = !state.selected;
                savePlayerState();
                gameState.syncTickets(myTickets, ticketStates);
                renderTicketsUIOnly();
              }
            });
          } else {
            cell.style.backgroundColor = '#f4f4f4';
          }
          grid.appendChild(cell);
        }
      }
      ticketEl.appendChild(grid);
      tContainer.appendChild(ticketEl);
    });
  };

  renderJoinForm();
  return container;
}
