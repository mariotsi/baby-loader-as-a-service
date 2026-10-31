const WELCOME_KEY = 'new-site-welcome';

/** Marks `slug` as just created, for Site settings to greet the Owner once. */
export function saveWelcome(slug: string) {
  try {
    sessionStorage.setItem(WELCOME_KEY, slug);
  } catch {
    // Without storage there is no greeting, and nothing else depends on it.
  }
}

/** Whether `slug` was just created. It answers yes once. */
export function takeWelcome(slug: string): boolean {
  try {
    if (sessionStorage.getItem(WELCOME_KEY) !== slug) {
      return false;
    }
    sessionStorage.removeItem(WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}
