import { navigate } from '../main';

export function HomeView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'home-container fade-in';
  
  container.innerHTML = `
    <header class="home-header">
      <i class="fa-solid fa-ticket fa-3x logo-icon"></i>
      <h1 class="main-title">Tambola Portal</h1>
      <p class="subtitle">Play anywhere, anytime.</p>
    </header>
    
    <main class="home-buttons">
      <button class="primary-btn" id="btn-host">
        <i class="fa-solid fa-crown"></i> Tambola Host
      </button>
      <button class="primary-btn" id="btn-host-player">
        <i class="fa-solid fa-chess-king"></i> Host Player
      </button>
      <button class="primary-btn" id="btn-player">
        <i class="fa-solid fa-user"></i> Tambola Player
      </button>
    </main>
  `;

  container.querySelector('#btn-host')?.addEventListener('click', () => navigate('host'));
  container.querySelector('#btn-host-player')?.addEventListener('click', () => navigate('hostPlayer'));
  container.querySelector('#btn-player')?.addEventListener('click', () => navigate('player'));

  return container;
}
