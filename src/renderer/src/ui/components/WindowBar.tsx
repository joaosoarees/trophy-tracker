/**
 * The top of a screen that has no tab bar: where the window is dragged from,
 * under the system's own buttons. It takes no room where the system draws
 * its own title bar.
 */
export function WindowBar() {
  return (
    <div aria-hidden className="window-bar bg-background sticky top-0 z-10" />
  );
}
