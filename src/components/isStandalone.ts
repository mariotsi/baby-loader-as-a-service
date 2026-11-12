/**
 * Whether the page runs as an app opened from the home screen, where it has
 * no browser around it. Safari on iOS says so on `navigator.standalone`,
 * every other browser through the `display-mode` media query.
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
