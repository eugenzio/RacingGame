import { UIManagerInterface } from '../UIState';

export abstract class BaseScreen {
  element: HTMLElement;
  protected uiManager: UIManagerInterface;

  constructor(manager: UIManagerInterface) {
    this.uiManager = manager;
    this.element = document.createElement('div');
    this.element.className = 'screen hidden';
  }

  show(data?: any): void {
    this.element.classList.remove('hidden');
    // slight delay for transition
    setTimeout(() => this.element.classList.add('active'), 10);
    this.onShow(data);
  }

  hide(): void {
    this.element.classList.remove('active');
    setTimeout(() => this.element.classList.add('hidden'), 300);
  }

  // Hook for subclasses
  protected onShow(data?: any): void {}

  protected createButton(text: string, onClick: () => void, isSecondary = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = isSecondary ? 'btn btn-secondary' : 'btn';
    btn.onclick = onClick;
    return btn;
  }

  protected createInput(placeholder: string, type = 'text'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    return input;
  }
}
