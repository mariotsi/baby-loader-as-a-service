import { type RefObject, useEffect, useRef } from 'react';
import {
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  set,
  type UseFormReturn,
  useWatch,
} from 'react-hook-form';
import { describeSiteSettingsErrors, type ErrorForm, errorPlace, inlineErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import type { SiteSettingsError } from '@/lib/siteSettings';

/**
 * What the Site editor and the Birth dialog share as forms on React Hook Form
 * (ADR-0012): how Site settings errors become a form's errors, what a form's
 * status message says of them, and how they follow the Owner's edits.
 */

/** Where a form keeps the errors no field of its own shows, by where it says them. */
const APART = ['status', 'elsewhere'] as const;

interface Sorting {
  /** The form, which says where it shows the error at a path (`errorPlace`). */
  form: ErrorForm;
  /** The form's field that shows the error at `path`, when the form shows it under a field. */
  nameOf: (path: string) => string;
  /** The Site's Languages: with more than one, an error on a text in one Language names it. */
  languages: readonly Lang[];
  lang: Lang;
}

/**
 * Site settings errors as a form holds them. One the form shows under a field
 * sits under that field's name, worded for it; any other sits under `status`
 * or `elsewhere`, worded as a sentence for the form's status message.
 */
export function settingsErrors<T extends FieldValues>(
  found: SiteSettingsError[],
  { form, nameOf, languages, lang }: Sorting
): FieldErrors<T> {
  const errors: Record<string, unknown> = {};
  for (const error of found) {
    const place = errorPlace(error.path, form);
    const [name, message] =
      place === 'field'
        ? [nameOf(error.path), inlineErrorText(error, languages, lang)]
        : [`${place}.${error.path.replaceAll('.', '_')}`, describeSiteSettingsErrors([error], lang)];
    set(errors, name, { type: error.code, message } satisfies FieldError);
  }
  return errors as FieldErrors<T>;
}

function isError(node: unknown): node is FieldError {
  return typeof (node as FieldError | null)?.type === 'string';
}

/** Every error in `errors` with the name it sits under: `milestones.0.date`, `status.dueDate`. */
export function errorsByName(errors: object, prefix = ''): [name: string, error: FieldError][] {
  return Object.entries(errors).flatMap(([key, node]): [string, FieldError][] => {
    if (!node || typeof node !== 'object' || key === 'root') {
      return [];
    }
    return isError(node) ? [[prefix + key, node]] : errorsByName(node, `${prefix}${key}.`);
  });
}

/** Sets each of `errors` on `form`, as for those the server found after the form's own check passed. */
export function markErrors<T extends FieldValues>(form: Pick<UseFormReturn<T>, 'setError'>, errors: FieldErrors<T>) {
  for (const [name, error] of errorsByName(errors)) {
    form.setError(name as Path<T>, error);
  }
}

/** What a form's status message draws on: whether a field is marked, and the sentences no field shows. */
export function errorSummary(errors: object): { marked: boolean; status: string[]; elsewhere: string[] } {
  const all = errorsByName(errors);
  const sentences = (place: (typeof APART)[number]) =>
    all.filter(([name]) => name.startsWith(`${place}.`)).map(([, error]) => error.message ?? '');
  return {
    marked: all.some(([name]) => !APART.some((place) => name.startsWith(`${place}.`))),
    status: sentences('status'),
    elsewhere: sentences('elsewhere'),
  };
}

/**
 * Checks the fields in error again whenever what the form holds changes, so
 * an error goes as soon as its rule is met. Nothing new turns red: only the
 * names already in error are asked about. A Site settings rule can depend on
 * another field (a label on the Languages, the name on the Birth), which is
 * why the form does this itself and sets `reValidateMode: 'onSubmit'`.
 * `also` is anything else the form's rules read, such as the page's values
 * under the Birth dialog.
 */
export function useRecheckErrors<T extends FieldValues>(form: UseFormReturn<T>, also?: unknown) {
  const { control, trigger } = form;
  const values = useWatch({ control });
  const errors = useRef(form.formState.errors);
  errors.current = form.formState.errors;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `values` and `also` are what the rules read; they say when to check again.
  useEffect(() => {
    const names = errorsByName(errors.current).map(([name]) => name as Path<T>);
    if (names.length > 0) {
      void trigger(names);
    }
  }, [values, also, trigger]);
}

/** After each refused submit, moves the focus to the first field in error inside `within`, in the page's order. */
export function useFocusFirstError(submitCount: number, within: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (submitCount > 0) {
      within.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [submitCount, within]);
}
