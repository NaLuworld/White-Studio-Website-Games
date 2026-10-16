export function shouldSuppressBrowserShortcut(e, active) {
  if (!active || e.code === 'Escape') return false;
  if (e.target?.isContentEditable || e.target?.closest?.('input,textarea,select,[contenteditable]')) return false;
  return e.ctrlKey || e.altKey || e.metaKey || ['F1','F3','F5','F6','F7','F10','F11','F12','Backspace','Space','Tab'].includes(e.code);
}
