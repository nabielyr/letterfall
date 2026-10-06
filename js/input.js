// Keyboard input without a visible text box.
// Desktop (and iOS) deliver real keys on `keydown`; we handle and preventDefault
// them. Android virtual keyboards report key "Unidentified" (229) instead, so
// those keystrokes reach a hidden <input> and are recovered by diffing its value.
const SENTINEL = ' '; // keeps something to delete so Backspace still fires an input event
const LETTER = /^[a-z]$/;

export function createInput(el, handlers) {
  let last = SENTINEL;
  let composing = false;

  function resetField() {
    el.value = SENTINEL;
    el.setSelectionRange(SENTINEL.length, SENTINEL.length);
    last = SENTINEL;
  }

  function emitChars(str) {
    for (const ch of str.toLowerCase()) {
      if (LETTER.test(ch)) handlers.onChar?.(ch);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    if (key.length === 1) {
      const ch = key.toLowerCase();
      if (!LETTER.test(ch)) return;
      e.preventDefault();
      if (!e.repeat) handlers.onChar?.(ch);
      return;
    }
    switch (key) {
      case 'Backspace':
        e.preventDefault();
        handlers.onBackspace?.();
        break;
      case 'Escape':
        e.preventDefault();
        handlers.onEscape?.();
        break;
      case 'Enter':
        e.preventDefault();
        handlers.onEnter?.();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        handlers.onArrow?.(key === 'ArrowLeft' ? -1 : 1);
        break;
      default:
        break; // "Unidentified" etc. falls through to the hidden input below
    }
  });

  el.addEventListener('input', () => {
    const value = el.value;
    let common = 0;
    while (common < last.length && common < value.length && last[common] === value[common]) common++;
    for (let i = common; i < last.length; i++) handlers.onBackspace?.();
    emitChars(value.slice(common));
    last = value;
    if (!composing) resetField();
  });
  el.addEventListener('compositionstart', () => {
    composing = true;
  });
  el.addEventListener('compositionend', () => {
    composing = false;
    resetField();
  });

  resetField();

  return {
    // Must be called from a user gesture for mobile browsers to open the keyboard.
    focus() {
      el.focus({ preventScroll: true });
      resetField();
    },
    blur() {
      el.blur();
    },
  };
}
