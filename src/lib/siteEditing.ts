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
 * with the Site as last saved. It holds what the Owner typed and what the
 * server last answered, says what is unsaved and what stops a save, runs the
 * two saves (the Site settings, and the Birth from its dialog) and moves what
 * it holds when the server answers. Free of React and of the browser's
 * `fetch`: it reaches the server through a SiteEditingPort, so every save
 * sequence runs in the `unit` tests. One store per open editor.
 */

/** A save the server took: the Site as saved, and how the Birth notification went if the save announced the birth. */
export type Written = { ok: true; site: Site; notification: DeliveryResult | 'failed' | null };

/**
 * Why a save did not go through: Site settings errors, found here or by the
 * server, or a refusal. `refused` is the route's error, which `routeErrorText`
 * words, and undefined when no answer came. `stale` when the Site changed in
 * another tab since this one read it.
 */
export type SaveFailure = { ok: false; errors: SiteSettingsError[] } | { ok: false; refused: unknown; stale: boolean };

/** How a save went. */
export type SaveOutcome = { ok: true } | SaveFailure;

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
  /** Every field on the page but the Birth and the Birth video, as typed. */
  draft: SiteDraft;
  /** The Birth video: the file saved, a file picked and not yet uploaded, or none. */
  video: MediaDraft;
  /** The Site as last saved: where a Birth save starts from, and the `updatedAt` every save sends back. */
  stored: Site;
  /** The Birth as last saved: only a Birth save changes it. */
  birth: BirthDraft;
  /** The page as last saved: the unsaved changes are where the draft differs from it. */
  baseline: { draft: SiteDraft; birth: DraftBirth };
  /** The Site settings previews draw: as they stand, or as they last stood valid while a field is half filled. */
  preview: SiteSettings;
  saving: boolean;
  /** Whether the last save found the Site changed in another tab, which only a reload brings here. */
  stale: boolean;
  lastSave: SaveReport | null;
  /** The fields in error at the last failed save, checked again on every edit until they pass. */
  failedPaths: string[];
  /** Counts failed saves, so each one can move the focus to the first field in error. */
  failedSaves: number;

  change(patch: Partial<SiteDraft>): void;
  pickVideo(video: MediaDraft): void;
  /**
   * Saves every Site setting but the Birth, uploading a picked Birth video
   * first. What stops the save is marked and nothing is sent. What the Owner
   * types while the save is on its way stays unsaved.
   */
  save(): Promise<SaveOutcome>;
  /**
   * Saves `next` as the Birth, with the name, the Sex and the Birth video, or
   * goes back to the Countdown when `next` is not born. The page's other
   * changes stay as they are, still unsaved.
   */
  saveBirth(next: BirthDraft): Promise<SaveOutcome>;
}

export type SiteEditing = StoreApi<SiteEditingState>;

type Held = Pick<SiteEditingState, 'draft' | 'video' | 'stored' | 'birth'>;

export function createSiteEditing(site: Site, port: SiteEditingPort, now: () => Date = () => new Date()): SiteEditing {
  return createStore<SiteEditingState>()((set, get) => {
    /** Sets what is held and redraws the preview from it. */
    function hold(patch: Partial<SiteEditingState>) {
      set((state) => ({
        ...patch,
        preview: lastValidSettings(settingsOf({ ...state, ...patch }), state.preview, now()),
      }));
    }

    function fail(errors: SiteSettingsError[]) {
      if (errors.length > 0) {
        set((state) => ({ failedPaths: errors.map((error) => error.path), failedSaves: state.failedSaves + 1 }));
      }
    }

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

    async function during(run: () => Promise<Written | SaveFailure>): Promise<Written | SaveFailure> {
      set({ saving: true, stale: false });
      const answer = await run();
      set({ saving: false, stale: !answer.ok && 'refused' in answer && answer.stale });
      return answer;
    }

    /** What a save that went through leaves saved, beside the draft: the Site, its Birth and its Birth video. */
    function savedBeside(written: Site, sentVideo: MediaDraft) {
      const birth = birthDraftOf(written);
      return {
        stored: written,
        birth,
        // A video picked while the save was on its way is still to save.
        video: get().video === sentVideo ? written.birthVideo : get().video,
        baselineBirth: { birth: birthSettings(birth, written.timezone), birthVideo: written.birthVideo },
      };
    }

    const start: Held = { draft: draftOfSite(site), video: site.birthVideo, stored: site, birth: birthDraftOf(site) };

    return {
      ...start,
      baseline: { draft: start.draft, birth: draftBirth(start) },
      preview: lastValidSettings(settingsOf(start), site, now()),
      saving: false,
      stale: false,
      lastSave: null,
      failedPaths: [],
      failedSaves: 0,

      change(patch) {
        hold({ draft: { ...get().draft, ...patch } });
      },

      pickVideo(video) {
        hold({ video });
      },

      async save() {
        set({ lastSave: null });
        const found = problemsOf(get(), now());
        if (found.length > 0) {
          fail(found);
          return { ok: false, errors: found };
        }
        set({ failedPaths: [] });
        const sent = get();
        const answer = await during(async () => {
          const video = await uploaded(sent.video);
          if (!video.ok) {
            return video;
          }
          const { birth: _, ...settings } = { ...settingsOf(sent), birthVideo: video.media };
          return port.saveSettings({ updatedAt: sent.stored.updatedAt, settings });
        });
        if (!answer.ok) {
          if ('errors' in answer) {
            fail(answer.errors);
          } else {
            set({ lastSave: { saved: false, refused: answer.refused } });
          }
          return answer;
        }
        const { baselineBirth, ...saved } = savedBeside(answer.site, sent.video);
        hold({
          ...saved,
          baseline: { draft: sent.draft, birth: baselineBirth },
          lastSave: { saved: true, notification: null },
        });
        return { ok: true };
      },

      async saveBirth(next) {
        set({ lastSave: null });
        const sent = get();
        const { updatedAt, timezone } = sent.stored;
        const answer = await during(async () => {
          const birth = birthSettings(next, timezone);
          if (!birth.born) {
            return port.clearBirth({ updatedAt });
          }
          const photo = await uploaded(next.photo);
          if (!photo.ok) {
            return photo;
          }
          const video = await uploaded(sent.video);
          if (!video.ok) {
            return video;
          }
          return port.setBirth({
            updatedAt,
            babyName: sent.draft.babyName,
            sex: sent.draft.sex,
            details: { ...birth.details, photo: photo.media },
            birthVideo: video.media,
          });
        });
        if (!answer.ok) {
          return answer;
        }
        const written = answer.site;
        const { baselineBirth, ...saved } = savedBeside(written, sent.video);
        const { draft, baseline } = get();
        hold({
          ...saved,
          draft: {
            ...draft,
            milestones: withSavedBirthMilestone(
              draft.milestones,
              written.milestones,
              hasBirthMilestone(baseline.draft.milestones)
            ),
          },
          baseline: {
            draft: {
              ...baseline.draft,
              babyName: written.babyName,
              sex: written.sex,
              milestones: withSavedBirthMilestone(baseline.draft.milestones, written.milestones, false),
            },
            birth: baselineBirth,
          },
          failedPaths: [],
          lastSave: { saved: true, notification: answer.notification },
        });
        return { ok: true };
      },
    };
  });
}

/** The Birth and the Birth video beside the draft, with `b` as the Birth, its time read in the Site's saved Timezone. */
function draftBirth(held: Held, b: BirthDraft = held.birth): DraftBirth {
  return { birth: birthSettings(b, held.stored.timezone), birthVideo: held.video };
}

/** The Site settings the page stands for as typed, with the Birth as last saved. */
function settingsOf(held: Held): SiteSettingsInput {
  return settingsOfDraft(held.draft, draftBirth(held));
}

/** Whether the page holds anything a save would change. */
export function isDirty(state: SiteEditingState): boolean {
  return !sameDraft(state.draft, draftBirth(state), state.baseline.draft, state.baseline.birth);
}

/** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
export function problemsOf(state: Held, now: Date = new Date()): SiteSettingsError[] {
  return draftProblems(state.draft, draftBirth(state), now);
}

/**
 * The errors a form still shows: those among `found` on a field that failed
 * the last save. Nothing new turns red while the Owner fixes them.
 */
export function stillFailing(found: SiteSettingsError[], failedPaths: readonly string[]): SiteSettingsError[] {
  return failedPaths.length > 0 ? found.filter((error) => failedPaths.includes(error.path)) : [];
}

/** The errors the page still shows after a failed save. */
export function liveErrors(state: SiteEditingState, now: Date = new Date()): SiteSettingsError[] {
  return stillFailing(problemsOf(state, now), state.failedPaths);
}

/**
 * The Site as saving `b` from the Birth dialog would leave it: as last saved,
 * with `b`, and the name, the Sex and the Birth video as the page holds them.
 * The time is read in the saved Timezone, which is what the Birth route reads
 * it in.
 */
function afterBirthSave(state: Held, b: BirthDraft): SiteSettings {
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
  const checked = parseSiteSettings(afterBirthSave(state, b), now);
  return checked.ok ? [] : checked.errors;
}

/** The Site settings the Birth dialog's previews draw with `b`, name and Sex given or not, or null while a field is half filled. */
export function birthPreview(state: Held, b: BirthDraft, now: Date = new Date()): SiteSettings | null {
  return parseBirthPreview(afterBirthSave(state, b), now);
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
