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
  'birth.details.message.it': 'Message (Italian)',
  'birth.details.message.en': 'Message (English)',
  milestones: 'Milestones',
  language: 'Language',
  'theme.palette': 'Palette',
  'theme.font': 'Font',
  'privacy.showName': 'Show name',
  'privacy.showSex': 'Show sex',
};

function fieldLabel(path: string): string {
  const field = path.replace(/^settings\./, '');
  const milestone = /^milestones\.(\d+)\.(label|date)$/.exec(field);
  if (milestone) {
    return `Milestone ${Number(milestone[1]) + 1} ${milestone[2]}`;
  }
  return FIELD_LABELS[field] ?? field;
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
      return 'must be 3-32 lowercase letters, numbers or hyphens, with no hyphen at either end';
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
