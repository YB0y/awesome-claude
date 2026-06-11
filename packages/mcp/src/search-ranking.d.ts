export type SearchRankingEntry = {
  category?: string;
  slug?: string;
  title?: string;
  description?: string;
  cardDescription?: string;
  author?: string;
  submittedBy?: string;
  brandName?: string;
  brandDomain?: string;
  verificationStatus?: string;
  downloadTrust?: string | null;
  documentationUrl?: string;
  repoUrl?: string;
  githubUrl?: string;
  sourceUrl?: string;
  platforms?: string[];
  supportLevels?: string[];
  safetyNotes?: string[] | string;
  privacyNotes?: string[] | string;
  tags?: string[];
  keywords?: string[];
  dateAdded?: string;
  installable?: boolean;
  downloadUrl?: string;
  packageVerified?: boolean;
  claimStatus?: string;
  reviewedBy?: string;
  trustSignals?: {
    sourceStatus?: string;
    sourceUrls?: string[];
    packageTrust?: string | null;
    packageVerified?: boolean;
    hasSafetyNotes?: boolean;
    hasPrivacyNotes?: boolean;
  };
};

export type SearchEntryScore = {
  score: number;
  reasons: string[];
};

export type RankedSearchEntry<TEntry extends SearchRankingEntry = SearchRankingEntry> =
  SearchEntryScore & {
    entry: TEntry;
  };

export function normalizeSearchText(value: unknown): string;
export function tokenizeSearchQuery(query: string): string[];
export function entrySearchText(entry: SearchRankingEntry): string;
export function matchesSearchQuery(entry: SearchRankingEntry, query: string): boolean;
export function scoreSearchEntry(entry: SearchRankingEntry, query: string): SearchEntryScore;
export function rankSearchEntries<TEntry extends SearchRankingEntry>(
  entries: ReadonlyArray<TEntry>,
  query: string,
): RankedSearchEntry<TEntry>[];
