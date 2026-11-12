import { type Lang, plural } from '../i18n.ts';

type Sex = 'female' | 'male' | 'unknown';

function bornTaglineEn(sex: Sex): string {
  switch (sex) {
    case 'female':
      return 'It’s a girl!';
    case 'male':
      return 'It’s a boy!';
    case 'unknown':
      return 'Here at last!';
  }
}

function bornTaglineIt(sex: Sex): string {
  switch (sex) {
    case 'female':
      return 'È nata!';
    case 'male':
      return 'È nato!';
    case 'unknown':
      return 'È arrivato!';
  }
}

function bornTitleIt(sex: Sex): string {
  return sex === 'female' ? 'Benvenuta' : 'Benvenuto';
}

function bornOnIt(formattedDatetime: string, sex: Sex): string {
  return `${sex === 'female' ? 'Nata' : 'Nato'} il ${formattedDatetime}`;
}

/** The icon an iPhone shows beside a control that a step names. */
export type StepIcon = 'share' | 'more' | 'pageMenu' | 'addToHome';

/** Words a step quotes from the iPhone's screen, such as a button's name, with the icon shown beside them there, if any. */
export interface NamedControl {
  name: string;
  icon?: StepIcon;
}

/** One step of an instruction: its words in order, with the controls it names marked. */
export type StepText = readonly (string | NamedControl)[];

function step(...parts: (string | NamedControl)[]): StepText {
  return parts;
}

function named(name: string, icon?: StepIcon): NamedControl {
  return icon ? { name, icon } : { name };
}

/**
 * The copy of a Site's Public page, in every language in `Lang`. English sets
 * the shape; every other language must match it, so a missing entry is a type
 * error. Smaller than baby-loader's dictionary, which also carries per-OS
 * "notifications are blocked" troubleshooting copy.
 */
const en = {
  waitingTagline: 'Expecting',
  waitingTitle: 'We are waiting for',
  /** Stands in for the name when there is none or Privacy settings hide it. */
  someone: 'someone',
  /** Stands in for the name in the Birth dialog's preview, until the Owner gives it. */
  littleOne: (_sex: Sex) => 'little one',
  duePrefix: 'Due date:',
  daysLeft: (n: number): string => plural('en', n, { one: 'day to go', other: 'days to go' }),
  daysLate: (n: number): string => plural('en', n, { one: 'day late', other: 'days late' }),
  dueToday: 'Due today',
  lateNote: 'Taking their time...',
  babyLate: 'Room service? I’m staying.',
  mumLate: 'Checkout was last week.',
  weekOf: (week: number): string => (week > 40 ? `Week ${week}` : `Week ${week} of 40`),
  milestonesTitle: 'Milestones',
  /** Names the link from a Milestone's Place to Google Maps. */
  openInMaps: (address: string): string => `Open ${address} in Google Maps`,

  bornTagline: bornTaglineEn,
  bornTitle: (_sex: Sex) => 'Welcome',
  bornOn: (formattedDatetime: string, _sex: Sex) => `Born on ${formattedDatetime}`,
  ageLabel: (n: number) => plural('en', n, { one: 'day of life', other: 'days of life' }),
  share: 'Share this page',
  /** Said where the browser cannot share, after copying the page's link instead. */
  linkCopied: 'Link copied',
  weightLabel: 'Weight',
  lengthLabel: 'Length',
  replayWelcome: 'Replay the welcome',
  /** The Birth video, full screen. */
  reveal: {
    label: 'Welcome to the world',
    close: 'Close video',
    turnOnSound: 'Turn on sound',
  },

  checking: 'Checking notification status...',
  subscribedBorn: 'Notifications active on this device',
  subscribedWaiting: 'Notifications active on this device',
  unsubscribe: 'Turn off notifications',
  unsubscribeLink: 'Turn them off',
  unsubscribeTitle: 'Turn off notifications?',
  unsubscribeDescription: 'You will stop receiving notifications from this page on this device.',
  keepNotifications: 'Keep notifications on',
  subscribeBorn: 'Get the next updates',
  subscribeWaiting: (sex: Sex): string =>
    ({
      female: 'Notify me when she arrives',
      male: 'Notify me when he arrives',
      unknown: 'Notify me when they arrive',
    })[sex],
  subscribing: 'Turning on...',

  subscribeOk: 'You are all set.',
  unsubscribeOk: 'Notifications turned off.',
  notificationOpen: 'Open',
  notificationDismiss: 'Dismiss',
  errorGeneric: 'Something went wrong.',
  errorUnsubscribe: 'Could not turn off notifications. Please try again.',
  errorUnsupported: 'Your browser does not support push notifications.',
  errorDenied: 'Notifications are blocked in your browser settings.',
  notificationsHelpTitle: 'How to enable notifications',
  iosHomeScreen: 'On iPhone, web notifications work only after you add this page to your Home Screen as a web app.',
  /**
   * The steps that add the page to an iPhone's Home Screen. Each marks the
   * words the Visitor looks for on the iPhone, with the icon they carry there:
   * every language marks the same icons in the same order.
   */
  iosStepsGeneric: step(
    'Open this page in ',
    named('Safari'),
    ' and use its ',
    named('Share', 'share'),
    ' menu to add it to your Home Screen. If ',
    named('Open as Web App'),
    ' appears, enable it. The Apple guide below shows the steps for your version.'
  ),
  iosOpenApp: step('Go to your Home Screen and open the new app shown below. Turn notifications on from there'),
  iosOpenSafari: step('Open this page in ', named('Safari')),
  iosShare: step('Tap ', named('Share', 'share')),
  iosMenu26: step(
    'Tap ',
    named('More', 'more'),
    ', then ',
    named('Share', 'share'),
    '. With the Top or Bottom tab layout, tap ',
    named('Share', 'share'),
    ' directly'
  ),
  iosMenu27: step(
    'Tap ',
    named('Page Menu', 'pageMenu'),
    ', then ',
    named('Share', 'share'),
    '. With the Top or Bottom tab layout, tap ',
    named('Share', 'share'),
    ' directly'
  ),
  iosAddHome: step('Scroll down and choose ', named('Add to Home Screen', 'addToHome')),
  iosEnableApp: step('Turn on ', named('Open as Web App')),
  iosAdd: step('Tap ', named('Add')),
  androidUnsupported: 'This browser does not support push notifications. Open this page in Chrome to turn them on.',
  iosHomeScreenLink: 'See how to add this page to your Home Screen',
  iosVersion: 'Your browser does not support push notifications. Web notifications need iOS 16.4 or later.',
  iosDenied: 'Notifications are blocked for this web app. Check its notification settings in iPhone Settings.',
  iosSettingsLink: 'Open Apple’s notification guide',
  androidDenied: 'Notifications are blocked for this page in Chrome. Allow them in the site settings.',
  androidSettingsLink: 'Open Chrome’s notification guide',
};

export type PublicPageCopy = typeof en;

const it: PublicPageCopy = {
  waitingTagline: 'In attesa',
  waitingTitle: 'Stiamo aspettando',
  someone: 'qualcuno',
  littleOne: (sex: Sex) => (sex === 'female' ? 'piccola' : 'piccolo'),
  duePrefix: 'Arrivo previsto:',
  daysLeft: (n: number): string => plural('it', n, { one: 'giorno rimanente', other: 'giorni rimanenti' }),
  daysLate: (n: number): string => plural('it', n, { one: 'giorno in ritardo', other: 'giorni in ritardo' }),
  dueToday: 'Arriva oggi',
  lateNote: 'Se la sta prendendo comoda...',
  babyLate: 'Servizio in camera? Io resto qui.',
  mumLate: 'Il checkout era la settimana scorsa.',
  weekOf: (week: number): string => (week > 40 ? `Settimana ${week}` : `Settimana ${week} di 40`),
  milestonesTitle: 'Tappe',
  openInMaps: (address: string): string => `Apri ${address} in Google Maps`,

  bornTagline: bornTaglineIt,
  bornTitle: bornTitleIt,
  bornOn: bornOnIt,
  ageLabel: (n: number) => plural('it', n, { one: 'giorno di vita', other: 'giorni di vita' }),
  share: 'Condividi questa pagina',
  linkCopied: 'Link copiato',
  weightLabel: 'Peso',
  lengthLabel: 'Lunghezza',
  replayWelcome: 'Riguarda il benvenuto',
  reveal: {
    label: 'Il nostro benvenuto',
    close: 'Chiudi il video',
    turnOnSound: 'Attiva audio',
  },

  checking: 'Controllo stato notifiche...',
  subscribedBorn: 'Notifiche attive su questo dispositivo',
  subscribedWaiting: 'Notifiche attive su questo dispositivo',
  unsubscribe: 'Disattiva le notifiche',
  unsubscribeLink: 'Disattivale',
  unsubscribeTitle: 'Disattivare le notifiche?',
  unsubscribeDescription: 'Non riceverai più le notifiche di questa pagina su questo dispositivo.',
  keepNotifications: 'Mantieni le notifiche attive',
  subscribeBorn: 'Ricevi i prossimi aggiornamenti',
  subscribeWaiting: (): string => 'Avvisami alla nascita',
  subscribing: 'Attivazione...',

  subscribeOk: 'Iscrizione completata.',
  unsubscribeOk: 'Notifiche disattivate.',
  notificationOpen: 'Apri',
  notificationDismiss: 'Chiudi',
  errorGeneric: 'Qualcosa è andato storto.',
  errorUnsubscribe: 'Non è stato possibile disattivare le notifiche. Riprova.',
  errorUnsupported: 'Il tuo browser non supporta le notifiche push.',
  errorDenied: 'Le notifiche sono bloccate nelle impostazioni del browser.',
  notificationsHelpTitle: 'Come attivare le notifiche',
  iosHomeScreen:
    'Su iPhone, le notifiche web funzionano solo dopo aver aggiunto questa pagina alla schermata Home come app web.',
  iosStepsGeneric: step(
    'Apri questa pagina in ',
    named('Safari'),
    ' e usa il menu ',
    named('Condividi', 'share'),
    ' per aggiungerla alla schermata Home. Se compare ',
    named('Apri come app web'),
    ', attivalo. La guida Apple qui sotto mostra i passaggi per la tua versione.'
  ),
  iosOpenApp: step('Vai alla schermata Home e apri la nuova app mostrata qui sotto. Attiva le notifiche da lì'),
  iosOpenSafari: step('Apri questa pagina in ', named('Safari')),
  iosShare: step('Tocca ', named('Condividi', 'share')),
  iosMenu26: step(
    'Tocca ',
    named('Altro', 'more'),
    ', poi ',
    named('Condividi', 'share'),
    '. Con il layout dei pannelli in alto o in basso, tocca direttamente ',
    named('Condividi', 'share')
  ),
  iosMenu27: step(
    'Tocca ',
    named('Menu pagina', 'pageMenu'),
    ', poi ',
    named('Condividi', 'share'),
    '. Con il layout dei pannelli in alto o in basso, tocca direttamente ',
    named('Condividi', 'share')
  ),
  iosAddHome: step('Scorri verso il basso e scegli ', named('Aggiungi alla schermata Home', 'addToHome')),
  iosEnableApp: step('Attiva ', named('Apri come app web')),
  iosAdd: step('Tocca ', named('Aggiungi')),
  androidUnsupported: 'Questo browser non supporta le notifiche push. Apri questa pagina in Chrome per attivarle.',
  iosHomeScreenLink: 'Scopri come aggiungere questa pagina alla schermata Home',
  iosVersion: 'Il tuo browser non supporta le notifiche push. Le notifiche web richiedono iOS 16.4 o successivo.',
  iosDenied:
    'Le notifiche sono bloccate per questa web app. Controlla le impostazioni delle notifiche in Impostazioni.',
  iosSettingsLink: 'Apri la guida Apple alle notifiche',
  androidDenied: 'Le notifiche sono bloccate per questa pagina in Chrome. Attivale nelle impostazioni del sito.',
  androidSettingsLink: 'Apri la guida Chrome alle notifiche',
};

export const publicPageCopy: Record<Lang, PublicPageCopy> = { it, en };
