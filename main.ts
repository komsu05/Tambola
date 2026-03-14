import './style.css';
import { HomeView } from './views/HomeView';
import { HostView } from './views/HostView';
import { HostPlayerView } from './views/HostPlayerView';
import { PlayerView } from './views/PlayerView';

const app = document.querySelector<HTMLDivElement>('#app')!;

export function navigate(path: string, params: any = {}) {
  app.innerHTML = '';
  switch (path) {
    case 'home':
      app.appendChild(HomeView());
      break;
    case 'host':
      app.appendChild(HostView());
      break;
    case 'hostPlayer':
      app.appendChild(HostPlayerView());
      break;
    case 'player':
      app.appendChild(PlayerView());
      break;
    default:
      app.appendChild(HomeView());
  }
}

// Initial Navigation
navigate('home');
