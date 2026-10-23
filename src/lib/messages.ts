import type { Lang } from './i18n';

/**
 * Core user-facing copy for a Site's Public page. Deliberately smaller than
 * baby-loader's dictionary (which also covers detailed per-OS "notifications
 * are blocked" troubleshooting copy) — that richer copy is a good candidate
 * to port over in a later pass, it just isn't needed to prove out the
 * multi-Site architecture itself.
 */
const en = {
  waitingTagline: 'Expecting',
  waitingTitle: 'We are waiting for',
  /** Stands in for the name when there is none or Privacy settings hide it. */
  someone: 'someone',
  duePrefix: 'Due date:',
  daysLeft: (n: number): string => (n === 1 ? 'day to go' : 'days to go'),
  daysLate: (n: number): string => (n === 1 ? 'day late' : 'days late'),
  dueToday: 'Due today',
  lateNote: 'Taking their time...',
  weekOf: (week: number): string => `Week ${week} of 40`,
  milestonesTitle: 'Milestones',
  languageLabel: 'Language',

  bornTagline: 'Here at last',
  bornTitle: 'Welcome',
  bornOn: (formattedDatetime: string) => `Born on ${formattedDatetime}`,
  weightLabel: 'Weight',
  lengthLabel: 'Length',

  sexFemale: 'It’s a girl',
  sexMale: 'It’s a boy',

  checking: 'Checking notification status...',
  subscribedBorn: 'Notifications are on for this device',
  subscribedWaiting: 'Birth notification is on for this device',
  unsubscribe: 'Turn off',
  subscribeBorn: 'Get the next updates',
  subscribeWaiting: 'Notify me when they arrive',
  subscribing: 'Turning on...',

  subscribeOk: 'You are all set.',
  unsubscribeOk: 'Notifications turned off.',
  errorGeneric: 'Something went wrong.',
  errorUnsupported: 'Your browser does not support push notifications.',
  errorDenied: 'Notifications are blocked in your browser settings.',
};

export type Messages = typeof en;

const it: Messages = {
  waitingTagline: 'In attesa',
  waitingTitle: 'Stiamo aspettando',
  someone: 'qualcuno',
  duePrefix: 'Arrivo previsto:',
  daysLeft: (n: number): string => (n === 1 ? 'giorno rimanente' : 'giorni rimanenti'),
  daysLate: (n: number): string => (n === 1 ? 'giorno in ritardo' : 'giorni in ritardo'),
  dueToday: 'Arriva oggi',
  lateNote: 'Se la sta prendendo comoda...',
  weekOf: (week: number): string => `Settimana ${week} di 40`,
  milestonesTitle: 'Tappe',
  languageLabel: 'Lingua',

  bornTagline: 'È arrivato/a',
  bornTitle: 'Benvenuto/a',
  bornOn: (formattedDatetime: string) => `Nato/a il ${formattedDatetime}`,
  weightLabel: 'Peso',
  lengthLabel: 'Lunghezza',

  sexFemale: 'È una femmina',
  sexMale: 'È un maschio',

  checking: 'Controllo stato notifiche...',
  subscribedBorn: 'Notifiche attive su questo dispositivo',
  subscribedWaiting: 'Notifica della nascita attiva su questo dispositivo',
  unsubscribe: 'Disattiva',
  subscribeBorn: 'Ricevi i prossimi aggiornamenti',
  subscribeWaiting: 'Avvisami alla nascita',
  subscribing: 'Attivazione...',

  subscribeOk: 'Iscrizione completata.',
  unsubscribeOk: 'Notifiche disattivate.',
  errorGeneric: 'Qualcosa è andato storto.',
  errorUnsupported: 'Il tuo browser non supporta le notifiche push.',
  errorDenied: 'Le notifiche sono bloccate nelle impostazioni del browser.',
};

export const messages: Record<Lang, Messages> = { it, en };
