import { englishName, isLang, type Lang } from '@/lib/i18n';
import type { SiteSettingsError } from '@/lib/siteSettings';

/** English copy for Site settings error codes, shown by the Dashboard forms. */

const FIELD_LABELS: Record<string, string> = {
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
};

/** " (Italian)" after the name of a text written in one Language. */
function inLanguage(code: string): string {
  return ` (${isLang(code) ? englishName(code) : code})`;
}

/** "Milestone 2 label (Italian)", or null when `field` is not a Milestone's. */
function milestoneLabel(field: string): string | null {
  const milestone = /^milestones\.(\d+)\.(emoji|label|date)(?:\.([a-z]+))?$/.exec(field);
  if (!milestone) {
    return null;
  }
  const [, index, part, code] = milestone;
  return `Milestone ${Number(index) + 1} ${part}${code ? inLanguage(code) : ''}`;
}

function fieldLabel(path: string): string {
  const field = path.replace(/^settings\./, '');
  const notification = /^messages\.[a-z]+\.(title|body)$/.exec(field);
  if (notification) {
    return notification[1] === 'title' ? 'Title' : 'Message';
  }
  const perLanguage = /^(birth\.details\.message|pageName)\.([a-z]+)$/.exec(field);
  if (perLanguage) {
    return `${perLanguage[1] === 'pageName' ? 'Page name' : 'Message'}${inLanguage(perLanguage[2])}`;
  }
  if (/^languages\.\d+$/.test(field)) {
    return 'Languages';
  }
  return milestoneLabel(field) ?? FIELD_LABELS[field] ?? field;
}

function problem({ code, params, path }: SiteSettingsError): string {
  switch (code) {
    case 'required':
      return 'is required';
    case 'tooLong':
      return path.endsWith('milestones')
        ? `can have at most ${params?.max}`
        : `must be at most ${params?.max} characters`;
    case 'outOfRange':
      if (params?.min !== undefined && params?.max !== undefined) {
        return `must be between ${params.min} and ${params.max}`;
      }
      return params?.max !== undefined ? `must be at most ${params.max}` : `must be at least ${params?.min}`;
    case 'invalidDate':
      return 'is not a valid date';
    case 'inFuture':
      return 'cannot be in the future';
    case 'invalidOption':
      return 'is not one of the options';
    case 'invalidFormat':
      return path.endsWith('emoji')
        ? 'must be a single emoji'
        : 'must be 3-32 lowercase letters, numbers or hyphens, with no hyphen at either end';
    case 'unknownField':
      return 'is not a known field';
    case 'slugTaken':
      return 'is already taken';
    case 'slugReserved':
      return 'is reserved';
    case 'invalidType':
      return path.endsWith('weightGrams') ? 'must be a whole number of grams' : 'has the wrong type';
  }
}

export function describeSiteSettingsErrors(errors: SiteSettingsError[]): string {
  return errors.map((error) => `${fieldLabel(error.path)} ${problem(error)}.`).join(' ');
}

/**
 * Whether the editor shows the error at `path` next to its field: a
 * Milestone's, or the Birth message's or Page name's in one Language. Every
 * other error goes in the form's status message.
 */
export function isInlineError(path: string): boolean {
  return /^(milestones\.\d+|birth\.details\.message|pageName)\./.test(path);
}

/**
 * The words under a field for one of its errors, telling how to fix it.
 * `languages` are the Site's: with more than one, an error on a text in one
 * Language names that Language.
 */
export function inlineErrorText({ path, code, params }: SiteSettingsError, languages: readonly Lang[]): string {
  const language = /\.([a-z]+)$/.exec(path)?.[1];
  const named = languages.length > 1 && language && isLang(language) ? englishName(language) : null;
  if (/^milestones\.\d+\.label\./.test(path) && code === 'required') {
    return named ? `Write this Milestone in ${named}.` : 'Give this Milestone a label.';
  }
  if (/^milestones\.\d+\.emoji$/.test(path)) {
    return 'Pick an emoji.';
  }
  if (/^milestones\.\d+\.date$/.test(path)) {
    return code === 'required' ? 'Pick the day.' : "That day doesn't exist. Pick another.";
  }
  if (code === 'tooLong') {
    return `Keep it to ${params?.max} characters.`;
  }
  return `${fieldLabel(path)} ${problem({ path, code, params })}.`;
}
