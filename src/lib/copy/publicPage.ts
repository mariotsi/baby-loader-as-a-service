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
  duePrefix: 'Due date:',
  daysLeft: (n: number): string => plural('en', n, { one: 'day to go', other: 'days to go' }),
  daysLate: (n: number): string => plural('en', n, { one: 'day late', other: 'days late' }),
  dueToday: 'Due today',
  lateNote: 'Taking their time...',
  weekOf: (week: number): string => `Week ${week} of 40`,
  milestonesTitle: 'Milestones',
  /** Names the link from a Milestone's Place to Google Maps. */
  openInMaps: (address: string): string => `Open ${address} in Google Maps`,

  bornTagline: bornTaglineEn,
  bornTitle: (_sex: Sex) => 'Welcome',
  bornOn: (formattedDatetime: string, _sex: Sex) => `Born on ${formattedDatetime}`,
  ageLabel: (n: number) => plural('en', n, { one: 'day of life', other: 'days of life' }),
  share: 'Share this page',
  weightLabel: 'Weight',
  lengthLabel: 'Length',

  sexFemale: 'It’s a girl',
  sexMale: 'It’s a boy',

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
  errorGeneric: 'Something went wrong.',
  errorUnsubscribe: 'Could not turn off notifications. Please try again.',
  errorUnsupported: 'Your browser does not support push notifications.',
  errorDenied: 'Notifications are blocked in your browser settings.',
  iosHomeScreen: 'On iPhone, web notifications work only after you add this page to your Home Screen as a web app.',
  iosStepsClassic: 'In Safari, tap Share, choose Add to Home Screen, then tap Add.',
  iosSteps26:
    'In Safari, tap More (…), then Share. With the Top or Bottom tab layout, tap Share directly. Choose Add to Home Screen, enable Open as Web App, then tap Add.',
  iosStepsGeneric:
    'Open this page in Safari and use its Share menu to add it to your Home Screen. If Open as Web App appears, enable it. The Apple guide below shows the steps for your version.',
  iosOpenApp: 'Open the new Home Screen icon, then turn notifications on there.',
  androidUnsupported: 'This browser does not support push notifications. Open this page in Chrome to turn them on.',
  iosHomeScreenLink: 'See how to add this page to your Home Screen',
  iosVersion: 'Your browser does not support push notifications. Web notifications need iOS 16.4 or later.',
  iosDenied: 'Notifications are blocked for this web app. Check its notification settings in iPhone Settings.',
  iosSettingsLink: 'Open Apple’s notification guide',
  androidUseChrome: 'For the best notification support on Android, open this page in Chrome.',
  androidDenied: 'Notifications are blocked for this page in Chrome. Allow them in the site settings.',
  androidSettingsLink: 'Open Chrome’s notification guide',
};

export type PublicPageCopy = typeof en;

const it: PublicPageCopy = {
  waitingTagline: 'In attesa',
  waitingTitle: 'Stiamo aspettando',
  someone: 'qualcuno',
  duePrefix: 'Arrivo previsto:',
  daysLeft: (n: number): string => plural('it', n, { one: 'giorno rimanente', other: 'giorni rimanenti' }),
  daysLate: (n: number): string => plural('it', n, { one: 'giorno in ritardo', other: 'giorni in ritardo' }),
  dueToday: 'Arriva oggi',
  lateNote: 'Se la sta prendendo comoda...',
  weekOf: (week: number): string => `Settimana ${week} di 40`,
  milestonesTitle: 'Tappe',
  openInMaps: (address: string): string => `Apri ${address} in Google Maps`,

  bornTagline: bornTaglineIt,
  bornTitle: bornTitleIt,
  bornOn: bornOnIt,
  ageLabel: (n: number) => plural('it', n, { one: 'giorno di vita', other: 'giorni di vita' }),
  share: 'Condividi questa pagina',
  weightLabel: 'Peso',
  lengthLabel: 'Lunghezza',

  sexFemale: 'È una femmina',
  sexMale: 'È un maschio',

  checking: 'Controllo stato notifiche...',
  subscribedBorn: 'Notifiche attive su questo dispositivo',
  subscribedWaiting: 'Notifiche attive su questo dispositivo',
  unsubscribe: 'Disattiva le notifiche',
  unsubscribeLink: 'Disattivale',
  unsubscribeTitle: 'Disattivare le notifiche?',
  unsubscribeDescription: 'Non riceverai più le notifiche di questa pagina su questo dispositivo.',
  keepNotifications: 'Mantieni le notifiche attive',
  subscribeBorn: 'Ricevi i prossimi aggiornamenti',
  subscribeWaiting: (_sex: Sex): string => 'Avvisami alla nascita',
  subscribing: 'Attivazione...',

  subscribeOk: 'Iscrizione completata.',
  unsubscribeOk: 'Notifiche disattivate.',
  errorGeneric: 'Qualcosa è andato storto.',
  errorUnsubscribe: 'Non è stato possibile disattivare le notifiche. Riprova.',
  errorUnsupported: 'Il tuo browser non supporta le notifiche push.',
  errorDenied: 'Le notifiche sono bloccate nelle impostazioni del browser.',
  iosHomeScreen:
    'Su iPhone, le notifiche web funzionano solo dopo aver aggiunto questa pagina alla schermata Home come app web.',
  iosStepsClassic: 'In Safari, tocca Condividi, scegli Aggiungi alla schermata Home e tocca Aggiungi.',
  iosSteps26:
    'In Safari, tocca Altro (…), poi Condividi. Con il layout dei pannelli in alto o in basso, tocca direttamente Condividi. Scegli Aggiungi alla schermata Home, attiva Apri come app web e tocca Aggiungi.',
  iosStepsGeneric:
    'Apri questa pagina in Safari e usa il menu Condividi per aggiungerla alla schermata Home. Se compare Apri come app web, attivalo. La guida Apple qui sotto mostra i passaggi per la tua versione.',
  iosOpenApp: 'Apri la nuova icona sulla schermata Home, poi attiva le notifiche da lì.',
  androidUnsupported: 'Questo browser non supporta le notifiche push. Apri questa pagina in Chrome per attivarle.',
  iosHomeScreenLink: 'Scopri come aggiungere questa pagina alla schermata Home',
  iosVersion: 'Il tuo browser non supporta le notifiche push. Le notifiche web richiedono iOS 16.4 o successivo.',
  iosDenied:
    'Le notifiche sono bloccate per questa web app. Controlla le impostazioni delle notifiche in Impostazioni.',
  iosSettingsLink: 'Apri la guida Apple alle notifiche',
  androidUseChrome: 'Per usare al meglio le notifiche su Android, apri questa pagina in Chrome.',
  androidDenied: 'Le notifiche sono bloccate per questa pagina in Chrome. Attivale nelle impostazioni del sito.',
  androidSettingsLink: 'Apri la guida Chrome alle notifiche',
};

export const publicPageCopy: Record<Lang, PublicPageCopy> = { it, en };
