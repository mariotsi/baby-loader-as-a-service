import { expect, test } from 'vitest';
import {
  describeSiteSettingsErrors,
  errorPlace,
  inlineErrorText,
  responseErrorText,
  routeErrorText,
  settingOf,
} from './errorText.ts';
import { settingsPath } from './siteSettings.ts';

test('a route error code reads in the page’s language', () => {
  expect(routeErrorText({ code: 'wrongCredentials' }, 'en')).toBe('Invalid email or password.');
  expect(routeErrorText({ code: 'wrongCredentials' }, 'it')).toBe('Email o password non validi.');
  expect(routeErrorText({ code: 'passwordTooLong', params: { max: 128 } }, 'it')).toBe(
    'La password può avere al massimo 128 caratteri.'
  );
});

test('anything that is not a known code reads as the generic error', () => {
  expect(routeErrorText(undefined, 'en')).toBe('Something went wrong.');
  expect(routeErrorText('Not found.', 'it')).toBe('Qualcosa è andato storto.');
  expect(routeErrorText({ code: 'nope' }, 'en')).toBe('Something went wrong.');
  expect(routeErrorText({ code: 'toString' }, 'en')).toBe('Something went wrong.');
});

test('a response body reads as its Site settings errors, else its route error', () => {
  const taken = { errors: [{ path: 'slug', code: 'slugTaken' }] };
  expect(responseErrorText(taken, 'en')).toBe('Site address is already taken.');
  expect(responseErrorText(taken, 'it')).toBe('Indirizzo del sito: già in uso.');
  expect(responseErrorText({ error: { code: 'rateLimited' } }, 'en')).toBe('Too many attempts, try again in a minute.');
  expect(responseErrorText(null, 'en')).toBe('Something went wrong.');
});

test('Site settings errors name their field and problem in each language', () => {
  const errors = [
    { path: settingsPath('birth.details.weightGrams'), code: 'invalidType' as const },
    { path: settingsPath('milestones.1.label.it'), code: 'required' as const },
    { path: settingsPath('birth.details.lengthCm'), code: 'outOfRange' as const, params: { min: 20, max: 70 } },
  ];
  expect(describeSiteSettingsErrors(errors, 'en')).toBe(
    'Weight must be a whole number of grams. Milestone 2 label (Italian) is required. Length must be between 20 and 70.'
  );
  expect(describeSiteSettingsErrors(errors, 'it')).toBe(
    'Peso: deve essere un numero intero di grammi. Tappa 2, etichetta (italiano): campo obbligatorio. Lunghezza: deve essere tra 20 e 70.'
  );
});

test('an inline error names the Language only when the Site speaks more than one', () => {
  const missing = { path: settingsPath('milestones.0.label.it'), code: 'required' as const };
  expect(inlineErrorText(missing, ['it', 'en'], 'en')).toBe('Write this Milestone in Italian.');
  expect(inlineErrorText(missing, ['it', 'en'], 'it')).toBe('Scrivi questa tappa in italiano.');
  expect(inlineErrorText(missing, ['it'], 'it')).toBe('Dai un nome a questa tappa.');
});

test('the editor shows a Milestone’s errors and a text’s in one Language under the field, the rest in words', () => {
  for (const path of ['milestones.2.date', 'milestones.0.label.it', 'milestones.1.place', 'pageName.en']) {
    expect(errorPlace(settingsPath(path), 'editor'), path).toBe('field');
  }
  for (const path of ['dueDate', 'babyName', 'milestones', 'languages.0', 'timezone']) {
    expect(errorPlace(settingsPath(path), 'editor'), path).toBe('status');
  }
});

test('the Birth dialog shows its own errors and points to the rest of the page', () => {
  const dialog = { birthDialog: { asksIdentity: false } };
  for (const path of ['birth.details.datetime', 'birth.details.weightGrams', 'birth.details.message.it']) {
    expect(errorPlace(settingsPath(path), dialog), path).toBe('field');
  }
  expect(errorPlace(settingsPath('birth.details.photo'), dialog)).toBe('status');
  expect(errorPlace(settingsPath('babyName'), dialog)).toBe('elsewhere');
  expect(errorPlace(settingsPath('sex'), dialog)).toBe('elsewhere');
  expect(errorPlace(settingsPath('milestones.0.date'), dialog)).toBe('elsewhere');

  const asking = { birthDialog: { asksIdentity: true } };
  expect(errorPlace(settingsPath('babyName'), asking)).toBe('field');
  expect(errorPlace(settingsPath('sex'), asking)).toBe('status');
});

test('a new Site’s errors name the Site setting they are about', () => {
  expect(settingOf(settingsPath('settings.dueDate'))).toBe('dueDate');
  expect(settingOf(settingsPath('slug'))).toBe('slug');
});
