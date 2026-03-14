export function CustomPrompt(
  title: string, 
  message: string, 
  defaultValue: string = '', 
  placeHolder: string = '', 
  type: string = 'text', 
  onConfirm: (value: string | null) => void
) {
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

  modal.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease-out;">
      <h3 style="color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.3rem;">${title}</h3>
      <p style="font-size: 1rem; color: #555; margin-bottom: 1.5rem; line-height: 1.4;">${message}</p>
      <input type="${type}" id="prompt-input" value="${defaultValue}" placeholder="${placeHolder}" style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 1px solid #ccc; font-size: 1.1rem; text-align: center; margin-bottom: 1.5rem; outline: none;">
      <div style="display: flex; gap: 1rem;">
        <button id="prompt-btn-cancel" class="primary-btn" style="flex: 1; background: #666; border-radius: 8px;">Cancel</button>
        <button id="prompt-btn-ok" class="primary-btn" style="flex: 1; border-radius: 8px;">OK</button>
      </div>
    </div>
  `;
  
  const okBtn = modal.querySelector('#prompt-btn-ok') as HTMLButtonElement;
  const cancelBtn = modal.querySelector('#prompt-btn-cancel') as HTMLButtonElement;
  const input = modal.querySelector('#prompt-input') as HTMLInputElement;
  
  // Focus the input when modal opens
  setTimeout(() => input.focus(), 100);

  const close = (value: string | null) => {
    modal.style.animation = 'fadeOut 0.2s ease-out forwards';
    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      onConfirm(value);
    }, 200);
  };
  
  okBtn.addEventListener('click', () => close(input.value));
  cancelBtn.addEventListener('click', () => close(null));
  
  input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      close(input.value);
    }
  });
  
  document.body.appendChild(modal);
}
