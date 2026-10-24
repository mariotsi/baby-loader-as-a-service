import type { Migration } from '../lib/migrations.ts';

/** The emoji every existing Milestone gets, until its Owner picks one. */
const EMOJI = '✨';

type OldMilestone = { label: string | Record<string, string>; date: string; emoji?: string };

/**
 * Gives each Milestone an emoji and turns its label into one text per
 * Language: the old label goes under every Language its Site speaks, so the
 * Site stays valid until the Owner translates it. Deployments before
 * Milestone labels per Language cannot read the result, an exception to the
 * rule in migrations.ts taken while production has no Owners.
 */
export const addMilestoneEmojiAndLabels: Migration = {
  id: '0005-add-milestone-emoji-and-labels',
  async up(db) {
    const sites = db.collection<{ languages: string[]; milestones: OldMilestone[] }>('sites');
    const outdated = sites.find({
      $or: [{ 'milestones.label': { $type: 'string' } }, { milestones: { $elemMatch: { emoji: { $exists: false } } } }],
    });
    for await (const site of outdated) {
      const milestones = site.milestones.map(({ label, date, emoji }) => ({
        emoji: emoji ?? EMOJI,
        label: typeof label === 'string' ? Object.fromEntries(site.languages.map((lang) => [lang, label])) : label,
        date,
      }));
      await sites.updateOne({ _id: site._id }, { $set: { milestones } });
    }
  },
};
