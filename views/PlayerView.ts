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

  const renderJoinForm = () => {
    container.innerHTML = `
      <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem;">
        <h2 style="color: var(--primary-color)">Join Game</h2>
        <input type="text" id="host-id" placeholder="Host ID" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
        <input type="text" id="player-name" placeholder="Your Name" value="Player" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
        <select id="ticket-count" style="padding: 0.8rem; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem;">
          <option value="1">1 Ticket</option>
          <option value="2">2 Tickets</option>
          <option value="3">3 Tickets</option>
          <option value="4">4 Tickets</option>
          <option value="5">5 Tickets</option>
          <option value="6">6 Tickets</option>
        </select>
        <button id="btn-join" class="primary-btn">Join Game</button>
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
      btn.innerText = "Waiting for Host Approval...";
      btn.disabled = true;

      gameState.onJoinApproved = () => {
        // Generate tickets only after approval
        const fullSet = TicketGenerator.generateSetOf6();
        myTickets = fullSet.slice(0, count);
        initTicketStates();
        renderTickets();
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

      gameState.joinRoom(hostId, playerName, count);
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
    renderTicketsUIOnly();
  };

  gameState.onClaimResult = (result: any) => {
    if (result.isValid) {
      renderTicketsUIOnly();
    }
    if (gameState.peer && result.playerSocketId === gameState.peer.id) {
      if (result.isValid) {
        CustomAlert("Claim Approved!", `Congratulations! Your claim for ${result.pattern} on Ticket ${result.ticketIndex + 1} was APPROVED!`, "success");
      } else {
        CustomAlert("Bogey!", `Your claim for ${result.pattern} on Ticket ${result.ticketIndex + 1} was REJECTED by Host. Ticket is Disqualified.`, "error");
        disqualifiedTickets[result.ticketIndex] = true;
        renderTicketsUIOnly();
      }
    } else {
      if (result.isValid) {
        CustomAlert("Prize Claimed!", `Player ${result.playerName} has successfully claimed ${result.pattern}!`, "info");
      }
    }
  };

  let showClaimHeadings = false;

  const renderTickets = () => {
    // Fill the #app parent (max-width 480px, min-height 100vh) — no fixed positioning
    container.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 100vh;
    `;

    container.innerHTML = `
      <header id="player-header" style="
        background: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.5rem;
        height: 32px;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      ">
        <!-- Left: Exit + Room ID -->
        <div style="display:flex; align-items:center; gap:0.3rem; min-width: 65px;">
          <button id="btn-exit" title="Exit" style="
            background: none; border: none; color: white;
            font-size: 1.1rem; cursor: pointer; padding: 2px;
            line-height:1; display:flex; align-items:center;
          "><i class="fa-solid fa-arrow-left"></i></button>
          <span style="font-size: 0.55rem; opacity: 0.85; line-height:1.1;">Room:<br>${gameState.hostId}</span>
        </div>

        <!-- Centre: Player Name -->
        <h3 style="margin:0; font-size: 0.85rem; font-weight:700; letter-spacing:0.4px; text-align:center;">
          ${gameState.playerName.toUpperCase()}
        </h3>

        <!-- Right: Claim toggle icon -->
        <div style="min-width:65px; display:flex; justify-content:flex-end;">
          <button id="btn-toggle-claim" title="Toggle Claim Headings" style="
            background: none; border: none; color: white;
            font-size: 1.1rem; cursor: pointer; padding: 2px;
            line-height:1; display:flex; align-items:center;
          "><i id="claim-icon" class="fa-solid fa-tag"></i></button>
        </div>
      </header>

      <div id="tickets-container" style="
        padding: 2px; display: flex; flex-direction: column;
        gap: 2px; overflow-y: auto; flex: 1;
        height: calc(100vh - 32px);
      "></div>
    `;

    container.querySelector('#btn-exit')?.addEventListener('click', () => {
      gameState.disconnect();
      window.location.reload();
    });

    const toggleBtn = container.querySelector('#btn-toggle-claim') as HTMLButtonElement;
    toggleBtn?.addEventListener('click', () => {
      showClaimHeadings = !showClaimHeadings;
      const icon = container.querySelector('#claim-icon') as HTMLElement;
      if (icon) {
        icon.style.opacity = showClaimHeadings ? '1' : '0.45';
      }
      renderTicketsUIOnly();
    });

    // Set initial icon opacity
    const icon = container.querySelector('#claim-icon') as HTMLElement;
    if (icon) icon.style.opacity = '0.45';

    renderTicketsUIOnly();
  };

  const renderTicketsUIOnly = () => {
    const tContainer = container.querySelector('#tickets-container') as HTMLElement;
    if (!tContainer) return;
    tContainer.innerHTML = '';

    myTickets.forEach((ticket, tIndex) => {
      const isBogey = disqualifiedTickets[tIndex];

      const ticketEl = document.createElement('div');
      ticketEl.style.backgroundColor = isBogey ? '#ffebee' : 'white';
      ticketEl.style.border = isBogey ? '1px solid red' : '1px solid var(--text-main)';
      ticketEl.style.borderRadius = '4px';
      ticketEl.style.overflow = 'hidden';
      ticketEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      ticketEl.style.flexShrink = '0';
      ticketEl.style.opacity = isBogey ? '0.6' : '1';

      // Ticket heading bar — hidden by default, shown when claim icon is toggled ON
      const headerDiv = document.createElement('div');
      headerDiv.style.background = isBogey ? 'red' : 'var(--text-main)';
      headerDiv.style.color = 'white';
      headerDiv.style.padding = '0.25rem 0.5rem';
      headerDiv.style.display = showClaimHeadings ? 'flex' : 'none';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'center';
      headerDiv.style.flexShrink = '0';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontSize = '0.88rem';
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
          cell.style.border = '1px solid #eee';
          cell.style.display = 'flex';
          cell.style.alignItems = 'center';
          cell.style.justifyContent = 'center';
          cell.style.height = 'min(5.1vh, 33px)';
          cell.style.fontSize = '1rem';
          cell.style.fontWeight = '700';
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
                const wasSelected = state.selected;
                
                // If we are selecting a NEW cell, lock all other currently selected cells
                if (!wasSelected) {
                  for (let t = 0; t < ticketStates.length; t++) {
                    for (let r = 0; r < 3; r++) {
                      for (let c = 0; c < 9; c++) {
                        if (ticketStates[t][r][c].selected) {
                          ticketStates[t][r][c].locked = true;
                        }
                      }
                    }
                  }
                  state.selected = true;
                } else {
                  // If we are deselecting the current one (which isn't locked yet)
                  state.selected = false;
                }
                
                renderTicketsUIOnly();
              }
            });
          } else {
            cell.style.backgroundColor = isBogey ? 'transparent' : '#f9f9f9';
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
