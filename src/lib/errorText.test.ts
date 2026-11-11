import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  assert.equal(routeErrorText({ code: 'wrongCredentials' }, 'en'), 'Invalid email or password.');
  assert.equal(routeErrorText({ code: 'wrongCredentials' }, 'it'), 'Email o password non validi.');
  assert.equal(
    routeErrorText({ code: 'passwordTooLong', params: { max: 128 } }, 'it'),
    'La password può avere al massimo 128 caratteri.'
  );
});

test('anything that is not a known code reads as the generic error', () => {
  assert.equal(routeErrorText(undefined, 'en'), 'Something went wrong.');
  assert.equal(routeErrorText('Not found.', 'it'), 'Qualcosa è andato storto.');
  assert.equal(routeErrorText({ code: 'nope' }, 'en'), 'Something went wrong.');
  assert.equal(routeErrorText({ code: 'toString' }, 'en'), 'Something went wrong.');
});

test('a response body reads as its Site settings errors, else its route error', () => {
  const taken = { errors: [{ path: 'slug', code: 'slugTaken' }] };
  assert.equal(responseErrorText(taken, 'en'), 'Site address is already taken.');
  assert.equal(responseErrorText(taken, 'it'), 'Indirizzo del sito: già in uso.');
  assert.equal(
    responseErrorText({ error: { code: 'rateLimited' } }, 'en'),
    'Too many attempts, try again in a minute.'
  );
  assert.equal(responseErrorText(null, 'en'), 'Something went wrong.');
});

test('Site settings errors name their field and problem in each language', () => {
  const errors = [
    { path: settingsPath('birth.details.weightGrams'), code: 'invalidType' as const },
    { path: settingsPath('milestones.1.label.it'), code: 'required' as const },
    { path: settingsPath('birth.details.lengthCm'), code: 'outOfRange' as const, params: { min: 20, max: 70 } },
  ];
  assert.equal(
    describeSiteSettingsErrors(errors, 'en'),
    'Weight must be a whole number of grams. Milestone 2 label (Italian) is required. Length must be between 20 and 70.'
  );
  assert.equal(
    describeSiteSettingsErrors(errors, 'it'),
    'Peso: deve essere un numero intero di grammi. Tappa 2, etichetta (italiano): campo obbligatorio. Lunghezza: deve essere tra 20 e 70.'
  );
});

test('an inline error names the Language only when the Site speaks more than one', () => {
  const missing = { path: settingsPath('milestones.0.label.it'), code: 'required' as const };
  assert.equal(inlineErrorText(missing, ['it', 'en'], 'en'), 'Write this Milestone in Italian.');
  assert.equal(inlineErrorText(missing, ['it', 'en'], 'it'), 'Scrivi questa tappa in italiano.');
  assert.equal(inlineErrorText(missing, ['it'], 'it'), 'Dai un nome a questa tappa.');
});

test('the editor shows a Milestone’s errors and a text’s in one Language under the field, the rest in words', () => {
  for (const path of ['milestones.2.date', 'milestones.0.label.it', 'milestones.1.place', 'pageName.en']) {
    assert.equal(errorPlace(settingsPath(path), 'editor'), 'field', path);
  }
  for (const path of ['dueDate', 'babyName', 'milestones', 'languages.0', 'timezone']) {
    assert.equal(errorPlace(settingsPath(path), 'editor'), 'status', path);
  }
});

test('the Birth dialog shows its own errors and points to the rest of the page', () => {
  const dialog = { birthDialog: { asksIdentity: false } };
  for (const path of ['birth.details.datetime', 'birth.details.weightGrams', 'birth.details.message.it']) {
    assert.equal(errorPlace(settingsPath(path), dialog), 'field', path);
  }
  assert.equal(errorPlace(settingsPath('birth.details.photo'), dialog), 'status');
  assert.equal(errorPlace(settingsPath('babyName'), dialog), 'elsewhere');
  assert.equal(errorPlace(settingsPath('sex'), dialog), 'elsewhere');
  assert.equal(errorPlace(settingsPath('milestones.0.date'), dialog), 'elsewhere');

  const asking = { birthDialog: { asksIdentity: true } };
  assert.equal(errorPlace(settingsPath('babyName'), asking), 'field');
  assert.equal(errorPlace(settingsPath('sex'), asking), 'status');
});

test('a new Site’s errors name the Site setting they are about', () => {
  assert.equal(settingOf(settingsPath('settings.dueDate')), 'dueDate');
  assert.equal(settingOf(settingsPath('slug')), 'slug');
});
