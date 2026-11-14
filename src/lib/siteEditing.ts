import { createStore, type StoreApi } from 'zustand/vanilla';
import { birthDay, instantIn, localIn, withBirth } from './birthAnnouncement.ts';
import type { DeliveryResult } from './notificationDelivery.ts';
import type { Site } from './site.ts';
import {
  type BirthDraft,
  type DraftBirth,
  draftOfSite,
  draftProblems,
  lastValidSettings,
  type MediaDraft,
  type MilestoneDraft,
  type SiteDraft,
  settingsOfDraft,
  storedMedia,
  writtenTexts,
} from './siteDraft.ts';
import {
  type BirthDetails,
  type BirthMedia,
  type CalendarDay,
  type Milestone,
  parseBirthPreview,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
  siteSettingsOf,
} from './siteSettings.ts';

/**
 * Site editing (see GLOSSARY.md): a Site draft open in the editor together
 * with the Site as last saved. The editor's form holds the draft, as its
 * values, and the draft as last saved, as its default values (ADR-0012). This
 * module holds the rest: a store with the Site as the server last answered
 * it, which runs the two saves (the Site settings, and the Birth from its
 * dialog), and the rules both forms ask it about: what is unsaved, what stops
 * a save, and what a form holds once a save went through. Free of React and
 * of the browser's `fetch`: it reaches the server through a SiteEditingPort,
 * so every save sequence runs in the `unit` tests. One store per open editor.
 */

/** What the editor's form holds: the Site draft, and the Birth video beside it. */
export type EditorValues = SiteDraft & {
  /** The Birth video: the file saved, a file picked and not yet uploaded, or none. */
  video: MediaDraft;
};

/** A save the server took: the Site as saved, and how the Birth notification went if the save announced the birth. */
export type Written = { ok: true; site: Site; notification: DeliveryResult | 'failed' | null };

/**
 * Why a save did not go through: Site settings errors, found here or by the
 * server, or a refusal. `refused` is the route's error, which `routeErrorText`
 * words, and undefined when no answer came. `stale` when the Site changed in
 * another tab since this one read it.
 */
export type SaveFailure = { ok: false; errors: SiteSettingsError[] } | { ok: false; refused: unknown; stale: boolean };

/** How the last save went, until the next one starts. Site settings errors show as marks on the fields, not here. */
export type SaveReport =
  | { saved: true; notification: DeliveryResult | 'failed' | null }
  | { saved: false; refused: unknown };

/** What setting the Birth sends, beside the `updatedAt` the tab last read. */
export interface BirthBody {
  updatedAt: string;
  babyName: string;
  sex: SiteSettingsInput['sex'];
  details: NonNullable<SiteSettingsInput['birth']['details']>;
  birthVideo: BirthMedia | null;
}

/**
 * The server as Site editing reaches it. No call throws: a network failure or
 * an answer that cannot be read comes back as a refusal.
 */
export interface SiteEditingPort {
  /** Saves every Site setting but the Birth. */
  saveSettings(body: { updatedAt: string; settings: Omit<SiteSettingsInput, 'birth'> }): Promise<Written | SaveFailure>;
  /** Sets the Birth, announcing it when the Site was Waiting. */
  setBirth(body: BirthBody): Promise<Written | SaveFailure>;
  /** Goes back to the Countdown. */
  clearBirth(body: { updatedAt: string }): Promise<Written | SaveFailure>;
  /** Stores a picked file and answers the media a save may send. */
  upload(file: File): Promise<{ ok: true; media: BirthMedia } | { ok: false; refused: unknown }>;
}

export interface SiteEditingState {
  /** The Site as last saved: where a Birth save starts from, and the `updatedAt` every save sends back. */
  stored: Site;
  /** The Birth as last saved: only a Birth save changes it. */
  birth: BirthDraft;
  /** Whether the last save found the Site changed in another tab, which only a reload brings here. */
  stale: boolean;
  lastSave: SaveReport | null;

  /**
   * Saves every Site setting in `sent` but the Birth, uploading a picked
   * Birth video first. The form checks `sent` before it calls (`problemsOf`)
   * and moves what it holds on the answer (`afterSave`).
   */
  save(sent: EditorValues): Promise<Written | SaveFailure>;
  /**
   * Saves `next` as the Birth, with the name, the Sex and the Birth video the
   * page holds, or goes back to the Countdown when `next` is not born. The
   * page's other changes are not sent. A failure is the dialog's to show: the
   * page reports nothing of its own.
   */
  saveBirth(page: Pick<EditorValues, 'babyName' | 'sex' | 'video'>, next: BirthDraft): Promise<Written | SaveFailure>;
}

export type SiteEditing = StoreApi<SiteEditingState>;

/** A draft with the Site it is a draft of: what the rules here are asked about. */
export interface Held {
  draft: SiteDraft;
  video: MediaDraft;
  stored: Site;
  birth: BirthDraft;
}

/** What a form holds, beside the Site as `saved`. */
export function holding({ video, ...draft }: EditorValues, saved: Pick<SiteEditingState, 'stored' | 'birth'>): Held {
  return { draft, video, stored: saved.stored, birth: saved.birth };
}

/** A saved Site as the editor's form starts. */
export function editorValuesOf(site: Site): EditorValues {
  return { ...draftOfSite(site), video: site.birthVideo };
}

export function createSiteEditing(site: Site, port: SiteEditingPort): SiteEditing {
  return createStore<SiteEditingState>()((set, get) => {
    /** A media field as a save sends it: a picked file is uploaded first, and a failed upload stops the save. */
    async function uploaded(
      media: MediaDraft
    ): Promise<{ ok: true; media: BirthMedia | null } | { ok: false; refused: unknown; stale: boolean }> {
      if (!(media instanceof File)) {
        return { ok: true, media };
      }
      const answer = await port.upload(media);
      return answer.ok ? answer : { ...answer, stale: false };
    }

    /** Runs a save, then holds the Site it wrote, or that the Site changed elsewhere. */
    async function during(run: () => Promise<Written | SaveFailure>): Promise<Written | SaveFailure> {
      set({ lastSave: null, stale: false });
      const answer = await run();
      if (answer.ok) {
        set({
          stored: answer.site,
          birth: birthDraftOf(answer.site),
          lastSave: { saved: true, notification: answer.notification },
        });
      } else {
        set({ stale: 'refused' in answer && answer.stale });
      }
      return answer;
    }

    return {
      stored: site,
      birth: birthDraftOf(site),
      stale: false,
      lastSave: null,

      async save(sent) {
        const held = holding(sent, get());
        const answer = await during(async () => {
          const video = await uploaded(held.video);
          if (!video.ok) {
            return video;
          }
          const { birth: _, ...settings } = { ...settingsOf(held), birthVideo: video.media };
          return port.saveSettings({ updatedAt: held.stored.updatedAt, settings });
        });
        if (!answer.ok && 'refused' in answer) {
          set({ lastSave: { saved: false, refused: answer.refused } });
        }
        return answer;
      },

      saveBirth(page, next) {
        const { updatedAt, timezone } = get().stored;
        return during(async () => {
          const birth = birthSettings(next, timezone);
          if (!birth.born) {
            return port.clearBirth({ updatedAt });
          }
          const photo = await uploaded(next.photo);
          if (!photo.ok) {
            return photo;
          }
          const video = await uploaded(page.video);
          if (!video.ok) {
            return video;
          }
          return port.setBirth({
            updatedAt,
            babyName: page.babyName,
            sex: page.sex,
            details: { ...birth.details, photo: photo.media },
            birthVideo: video.media,
          });
        });
      },
    };
  });
}

/**
 * What the editor's form holds once a save of `sent` wrote `written`: the
 * draft as saved (its new default values), and the Birth video. What the
 * Owner typed while the save was on its way is in `now` and stays unsaved,
 * a video picked meanwhile included.
 */
export function afterSave(
  sent: EditorValues,
  now: EditorValues,
  written: Site
): { saved: EditorValues; video: MediaDraft } {
  return {
    saved: { ...sent, video: written.birthVideo },
    video: sameMedia(now.video, sent.video) ? written.birthVideo : now.video,
  };
}

/**
 * What the editor's form holds once a Birth save wrote `written`. `saved` is
 * the draft as saved before it: the name, the Sex, the Birth video and the
 * Birth milestone are saved now, and the page's other changes are not. The
 * form's Milestones follow the Birth milestone the server settled, with the
 * label and the emoji the Owner has not saved; one the Owner removed and has
 * not saved stays removed.
 */
export function afterBirthSave(
  saved: EditorValues,
  now: EditorValues,
  sentVideo: MediaDraft,
  written: Site
): { saved: EditorValues; milestones: MilestoneDraft[]; video: MediaDraft } {
  return {
    saved: {
      ...saved,
      babyName: written.babyName,
      sex: written.sex,
      milestones: withSavedBirthMilestone(saved.milestones, written.milestones, false),
      video: written.birthVideo,
    },
    milestones: withSavedBirthMilestone(now.milestones, written.milestones, hasBirthMilestone(saved.milestones)),
    video: sameMedia(now.video, sentVideo) ? written.birthVideo : now.video,
  };
}

/** Whether two media fields hold the same thing: the same picked file, or the same saved one. A form may hand a copy. */
function sameMedia(a: MediaDraft, b: MediaDraft): boolean {
  return a instanceof File || b instanceof File ? a === b : a?.key === b?.key;
}

/** The Birth and the Birth video beside the draft, with `b` as the Birth, its time read in the Site's saved Timezone. */
function draftBirth(held: Held, b: BirthDraft = held.birth): DraftBirth {
  return { birth: birthSettings(b, held.stored.timezone), birthVideo: held.video };
}

/** The Site settings the page stands for as typed, with the Birth as last saved. */
function settingsOf(held: Held): SiteSettingsInput {
  return settingsOfDraft(held.draft, draftBirth(held));
}

/** The Site settings `held` stands for when they pass every rule, else `previous`: what previews draw while a field is half filled. */
export function previewOf(held: Held, previous: SiteSettings, now: Date = new Date()): SiteSettings {
  return lastValidSettings(settingsOf(held), previous, now);
}

/** Whether `held` holds anything a save would change, given the draft as last `saved`. */
export function isDirty(held: Held, saved: Held): boolean {
  return !sameDraft(held.draft, draftBirth(held), saved.draft, draftBirth(saved));
}

/** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
export function problemsOf(state: Held, now: Date = new Date()): SiteSettingsError[] {
  return draftProblems(state.draft, draftBirth(state), now);
}

/**
 * The Site as saving `b` from the Birth dialog would leave it: as last saved,
 * with `b`, and the name, the Sex and the Birth video as the page holds them.
 * The time is read in the saved Timezone, which is what the Birth route reads
 * it in.
 */
function siteWithBirth(state: Held, b: BirthDraft): SiteSettings {
  const saved = siteSettingsOf(state.stored);
  if (!b.born) {
    return withBirth(saved, null);
  }
  // As typed, so not yet checked: callers read the result through parseSiteSettings or parseBirthPreview.
  const { details } = birthSettings(b, saved.timezone) as unknown as { details: BirthDetails };
  return withBirth(saved, {
    babyName: state.draft.babyName,
    sex: state.draft.sex,
    details,
    birthVideo: storedMedia(state.video),
  });
}

/** Everything that stops the Birth dialog saving `b`. */
export function birthProblems(state: Held, b: BirthDraft, now: Date = new Date()): SiteSettingsError[] {
  const checked = parseSiteSettings(siteWithBirth(state, b), now);
  return checked.ok ? [] : checked.errors;
}

/** The Site settings the Birth dialog's previews draw with `b`, name and Sex given or not, or null while a field is half filled. */
export function birthPreview(state: Held, b: BirthDraft, now: Date = new Date()): SiteSettings | null {
  return parseBirthPreview(siteWithBirth(state, b), now);
}

/** The Birth the dialog opens on: as saved, or with the date and time filled in with now when announcing. */
export function birthToEdit(state: Held, now: Date = new Date()): BirthDraft {
  const { birth, stored } = state;
  return birth.born ? birth : { ...birth, datetime: birth.datetime || localIn(now, stored.timezone) };
}

/** The saved Birth's instant, ISO 8601, or null while Waiting. */
export function bornAt(state: Held): string | null {
  return state.birth.born ? instantIn(state.birth.datetime, state.stored.timezone) : null;
}

/** The day the Birth milestone stands on: the day of birth in the Timezone as typed. Null while Waiting. */
export function birthMilestoneDay(state: Held): CalendarDay | null {
  const instant = bornAt(state);
  return instant ? birthDay(instant, state.draft.timezone) : null;
}

/**
 * Whether two drafts would save the same: the Site settings they send, the
 * Place texts not picked yet, and the Birth video picked and not yet uploaded.
 */
function sameDraft(a: SiteDraft, aBirth: DraftBirth, b: SiteDraft, bBirth: DraftBirth): boolean {
  return draftKey(a, aBirth) === draftKey(b, bBirth);
}

function draftKey(draft: SiteDraft, birth: DraftBirth): string {
  const video = birth.birthVideo;
  return JSON.stringify([
    settingsOfDraft(draft, birth),
    draft.milestones.map((m) => m.placeText),
    video instanceof File ? [video.name, video.size, video.lastModified] : null,
  ]);
}

/** A saved Site's Birth as the Birth dialog starts: its time on the wall clock in the Site's Timezone. */
function birthDraftOf(site: Pick<SiteSettings, 'birth' | 'timezone'>): BirthDraft {
  const details = site.birth.details;
  return {
    born: site.birth.born,
    datetime: details ? localIn(details.datetime, site.timezone) : '',
    weight: details?.weightGrams?.toString() ?? '',
    lengthCm: details?.lengthCm?.toString() ?? '',
    message: details?.message ?? {},
    photo: details?.photo ?? null,
  };
}

/** The Birth as Site settings hold it, from the fields as typed: the time is the wall clock in `timezone`. */
function birthSettings(b: BirthDraft, timezone: string): SiteSettingsInput['birth'] {
  if (!b.born) {
    return { born: false, details: null };
  }
  return {
    born: true,
    details: {
      datetime: instantIn(b.datetime, timezone),
      weightGrams: b.weight ? Number(b.weight) : null,
      lengthCm: b.lengthCm ? Number(b.lengthCm) : null,
      message: writtenTexts(b.message),
      photo: storedMedia(b.photo),
    },
  };
}

/**
 * A form's Milestones once the Birth is saved: the Birth milestone on the
 * day the server saved, with the Owner's unsaved label and emoji. One the
 * Owner removed and has not saved yet (`removedHere`) stays removed.
 */
function withSavedBirthMilestone(drafts: MilestoneDraft[], saved: Milestone[], removedHere: boolean): MilestoneDraft[] {
  const savedOne = saved.find((m) => m.kind === 'birth');
  if (!savedOne) {
    return drafts.filter((m) => m.kind !== 'birth');
  }
  if (hasBirthMilestone(drafts)) {
    return drafts.map((m) => (m.kind === 'birth' ? { ...m, date: savedOne.date } : m));
  }
  return removedHere ? drafts : [...drafts, { ...savedOne, placeText: savedOne.place?.address ?? '' }];
}

function hasBirthMilestone(milestones: readonly { kind?: 'birth' }[]): boolean {
  return milestones.some((m) => m.kind === 'birth');
}
