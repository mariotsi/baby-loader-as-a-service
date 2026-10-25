import type { Lang } from '../i18n.ts';
import type { RouteErrorCode } from '../routeError.ts';

/**
 * The words for every error a Platform page shows: a route's refusal and a
 * Site settings error, in every language in `Lang`. English sets the shape;
 * every other language must match it, so a missing entry is a type error.
 * `errorText.ts` decides which entry an error gets.
 */
const en = {
  generic: 'Something went wrong.',
  route: {
    rateLimited: 'Too many attempts, try again in a minute.',
    invalidEmail: 'Enter a valid email address.',
    passwordTooLong: (max: number) => `Password must be at most ${max} characters.`,
    passwordRules: 'Password rules not met yet: check the list under the password.',
    emailTaken: 'An account with this email already exists.',
    wrongCredentials: 'Invalid email or password.',
    notAuthenticated: 'Your session has ended: log in again.',
    notFound: 'Not found.',
    pushNotConfigured: 'VAPID keys are not configured on the server.',
    invalidRequest: 'Invalid request.',
    unknownSite: 'Unknown site.',
  } satisfies Record<RouteErrorCode, string | ((max: number) => string)>,

  /** A Site settings error in the form's status message: a field's name and what is wrong with it. */
  sentence: (field: string, problem: string) => `${field} ${problem}.`,
  fields: {
    slug: 'Site address',
    babyName: 'Name',
    sex: 'Sex',
    dueDate: 'Due date',
    birth: 'Birth',
    'birth.details': 'Birth details',
    'birth.details.datetime': 'Birth date & time',
    'birth.details.weightGrams': 'Weight',
    'birth.details.lengthCm': 'Length',
    milestones: 'Milestones',
    languages: 'Languages',
    timezone: 'Timezone',
    'theme.palette': 'Palette',
    'theme.font': 'Font',
    'privacy.showName': 'Show name',
    'privacy.showSex': 'Show sex',
    pageName: 'Page name',
  } as Record<string, string>,
  notificationTitle: 'Title',
  message: 'Message',
  /** "Milestone 2 label": `part` is one of `milestoneParts`. */
  milestone: (n: number, part: string) => `Milestone ${n} ${part}`,
  milestoneParts: { emoji: 'emoji', label: 'label', date: 'date', place: 'place' } as Record<string, string>,
  problems: {
    required: 'is required',
    tooManyItems: (max: string | number) => `can have at most ${max}`,
    tooManyChars: (max: string | number) => `must be at most ${max} characters`,
    between: (min: string | number, max: string | number) => `must be between ${min} and ${max}`,
    atMost: (max: string | number) => `must be at most ${max}`,
    atLeast: (min: string | number) => `must be at least ${min}`,
    invalidDate: 'is not a valid date',
    inFuture: 'cannot be in the future',
    invalidOption: 'is not one of the options',
    singleEmoji: 'must be a single emoji',
    slugFormat: 'must be 3-32 lowercase letters, numbers or hyphens, with no hyphen at either end',
    unknownField: 'is not a known field',
    slugTaken: 'is already taken',
    slugReserved: 'is reserved',
    wholeGrams: 'must be a whole number of grams',
    wrongType: 'has the wrong type',
  },

  /** The words under a field, telling how to fix it. */
  inline: {
    milestoneIn: (language: string) => `Write this Milestone in ${language}.`,
    milestoneLabel: 'Give this Milestone a label.',
    pickEmoji: 'Pick an emoji.',
    pickPlace: 'Pick a place from the list, or clear the field.',
    pickDay: 'Pick the day.',
    noSuchDay: "That day doesn't exist. Pick another.",
    keepTo: (max: string | number) => `Keep it to ${max} characters.`,
  },
  checkMarkedFields: 'Check the fields marked in red.',
};

export type ErrorsCopy = typeof en;

const it: ErrorsCopy = {
  generic: 'Qualcosa è andato storto.',
  route: {
    rateLimited: 'Troppi tentativi, riprova tra un minuto.',
    invalidEmail: 'Inserisci un indirizzo email valido.',
    passwordTooLong: (max) => `La password può avere al massimo ${max} caratteri.`,
    passwordRules: 'La password non rispetta ancora tutte le regole: controlla l’elenco sotto.',
    emailTaken: 'Esiste già un account con questa email.',
    wrongCredentials: 'Email o password non validi.',
    notAuthenticated: 'La sessione è scaduta: accedi di nuovo.',
    notFound: 'Non trovato.',
    pushNotConfigured: 'Le chiavi VAPID non sono configurate sul server.',
    invalidRequest: 'Richiesta non valida.',
    unknownSite: 'Sito sconosciuto.',
  },

  // A colon keeps each problem free of the field's gender: "Data prevista: campo obbligatorio."
  sentence: (field, problem) => `${field}: ${problem}.`,
  fields: {
    slug: 'Indirizzo del sito',
    babyName: 'Nome',
    sex: 'Sesso',
    dueDate: 'Data prevista',
    birth: 'Nascita',
    'birth.details': 'Dettagli della nascita',
    'birth.details.datetime': 'Data e ora di nascita',
    'birth.details.weightGrams': 'Peso',
    'birth.details.lengthCm': 'Lunghezza',
    milestones: 'Tappe',
    languages: 'Lingue',
    timezone: 'Fuso orario',
    'theme.palette': 'Palette',
    'theme.font': 'Carattere',
    'privacy.showName': 'Mostra il nome',
    'privacy.showSex': 'Mostra il sesso',
    pageName: 'Nome della pagina',
  },
  notificationTitle: 'Titolo',
  message: 'Messaggio',
  milestone: (n, part) => `Tappa ${n}, ${part}`,
  milestoneParts: { emoji: 'emoji', label: 'etichetta', date: 'data', place: 'luogo' },
  problems: {
    required: 'campo obbligatorio',
    tooManyItems: (max) => `al massimo ${max}`,
    tooManyChars: (max) => `al massimo ${max} caratteri`,
    between: (min, max) => `deve essere tra ${min} e ${max}`,
    atMost: (max) => `deve essere al massimo ${max}`,
    atLeast: (min) => `deve essere almeno ${min}`,
    invalidDate: 'non è una data valida',
    inFuture: 'non può essere nel futuro',
    invalidOption: 'non è tra le opzioni',
    singleEmoji: 'deve essere una sola emoji',
    slugFormat: 'da 3 a 32 lettere minuscole, numeri o trattini, senza trattino all’inizio o alla fine',
    unknownField: 'campo sconosciuto',
    slugTaken: 'già in uso',
    slugReserved: 'riservato',
    wholeGrams: 'deve essere un numero intero di grammi',
    wrongType: 'tipo non valido',
  },

  inline: {
    milestoneIn: (language) => `Scrivi questa tappa in ${language}.`,
    milestoneLabel: 'Dai un nome a questa tappa.',
    pickEmoji: 'Scegli un’emoji.',
    pickPlace: 'Scegli un luogo dall’elenco o svuota il campo.',
    pickDay: 'Scegli il giorno.',
    noSuchDay: 'Quel giorno non esiste. Scegline un altro.',
    keepTo: (max) => `Al massimo ${max} caratteri.`,
  },
  checkMarkedFields: 'Controlla i campi segnati in rosso.',
};

export const errorsCopy: Record<Lang, ErrorsCopy> = { it, en };
