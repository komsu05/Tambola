export function CustomAlert(title: string, message: string = '', type: 'info' | 'error' | 'success' = 'info', onOk?: () => void) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  modal.style.animation = 'fadeIn 0.2s ease-out';
  
  // Icon based on type
  let iconHtml = '';
  let color = 'var(--text-main)';
  if (type === 'error') {
    iconHtml = '<i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: #d32f2f; margin-bottom: 1rem;"></i>';
    color = '#d32f2f';
  } else if (type === 'success') {
    iconHtml = '<i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: #2e7d32; margin-bottom: 1rem;"></i>';
    color = '#2e7d32';
  } else {
    iconHtml = '<i class="fa-solid fa-circle-info" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 1rem;"></i>';
    color = 'var(--primary-color)';
  }

  modal.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease-out;">
      ${iconHtml}
      <h3 style="color: ${color}; margin-bottom: 0.5rem; font-size: 1.3rem;">${title}</h3>
      ${message ? `<p style="font-size: 1rem; color: #555; margin-bottom: 1.5rem; line-height: 1.4;">${message}</p>` : ''}
      <button id="alert-btn-ok" class="primary-btn" style="width: 100%; border-radius: 8px;">OK</button>
    </div>
  `;
  
  const okBtn = modal.querySelector('#alert-btn-ok') as HTMLButtonElement;
  okBtn.focus();
  
  const close = () => {
    modal.style.animation = 'fadeOut 0.2s ease-out forwards';
    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      if (onOk) onOk();
    }, 200);
  };
  
  okBtn.addEventListener('click', close);
  
  document.body.appendChild(modal);
}
