// Scroll-wheel selection is limited to the two firearms. The knife remains
// directly selectable with Digit3, while scrolling from it returns to a gun.
export function wheelFirearmSlot(currentSlot, deltaY) {
  if (!Number.isFinite(deltaY) || deltaY === 0) return null;
  if (currentSlot === 1) return 2;
  if (currentSlot === 2) return 1;
  if (currentSlot === 3) return deltaY < 0 ? 2 : 1;
  return null;
}
