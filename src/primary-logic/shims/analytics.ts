/**
 * OCADE ships no analytics.
 *
 * The donor's model-provider table carried a metadata type so every provider
 * choice could be reported to a hosted sink. The table itself is worth keeping;
 * the reporting is not. The type survives as a local shape so the ported table
 * still typechecks, and nothing reads it.
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = Record<
  string,
  string | number | boolean | undefined
>;
