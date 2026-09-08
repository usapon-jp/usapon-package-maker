export const AUTUMN_STAMP_IDS = [
  "autumn-stamp-9798", "autumn-stamp-9799", "autumn-stamp-9800", "autumn-stamp-9801", "autumn-stamp-9802", "autumn-stamp-9803",
  "autumn-stamp-9804", "autumn-stamp-9805", "autumn-stamp-9806", "autumn-stamp-9807", "autumn-stamp-9809", "autumn-stamp-9810",
  "autumn-stamp-9811", "autumn-stamp-9812", "autumn-stamp-9813", "autumn-stamp-9814", "autumn-stamp-9815", "autumn-stamp-9816",
  "autumn-stamp-9817", "autumn-stamp-9818", "autumn-stamp-9819", "autumn-stamp-9820", "autumn-stamp-9821", "autumn-stamp-9822",
  "autumn-stamp-9823", "autumn-stamp-extra",
] as const;

export type AutumnStampId = (typeof AUTUMN_STAMP_IDS)[number];

export const AUTUMN_FREE_TRIAL_STAMP_ID = "autumn-stamp-9803" as const;

// The free GoodNotes mini pack has one existing IMG9803 stamp plus these four
// public PNGs. Keep this separate from the paid 26-piece catalog above.
export const AUTUMN_TRIAL_STAMP_IDS = [
  "autumn-trial-cover",
  "autumn-trial-sticky",
  "autumn-trial-heading",
  "autumn-trial-tape",
  AUTUMN_FREE_TRIAL_STAMP_ID,
] as const;

export type AutumnTrialStampId = (typeof AUTUMN_TRIAL_STAMP_IDS)[number];

export const AUTUMN_TRIAL_STAMP_FILES: Record<Exclude<AutumnTrialStampId, typeof AUTUMN_FREE_TRIAL_STAMP_ID>, string> = {
  "autumn-trial-cover": "autumn-trial-cover.png",
  "autumn-trial-sticky": "autumn-trial-sticky.png",
  "autumn-trial-heading": "autumn-trial-heading.png",
  "autumn-trial-tape": "autumn-trial-tape.png",
};

export const AUTUMN_STAMP_FILES: Record<AutumnStampId, string> = Object.fromEntries(
  AUTUMN_STAMP_IDS.map((id) => [id, `${id}.png`]),
) as Record<AutumnStampId, string>;

// These keys were written into saved Package Maker documents before the BOOTH set
// replaced the prototype artwork. Keep them resolvable from private Storage.
export const LEGACY_AUTUMN_STAMP_FILES = {
  "autumn-rabbit-sweet-potato-car": "autumn-rabbit-sweet-potato-car.png",
  "autumn-rabbit-acorn-hug": "autumn-rabbit-acorn-hug.png",
  "autumn-rabbit-sweet-potato": "autumn-rabbit-sweet-potato.png",
  "autumn-rabbit-chestnut": "autumn-rabbit-chestnut.png",
  "autumn-rabbit-sleeping-sweet-potato": "autumn-rabbit-sleeping-sweet-potato-no-text.png",
} as const;
