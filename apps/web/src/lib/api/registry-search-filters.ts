import type { SearchDocument } from "@heyclaude/registry";
import {
  matchesSearchQuery,
  rankSearchEntries as rankSharedSearchEntries,
  scoreSearchEntry as scoreSharedSearchEntry,
  type RankedSearchEntry as SharedRankedSearchEntry,
} from "@heyclaude/mcp/search-ranking";

export type BooleanFilterValue = "all" | "true" | "false";

export type DownloadTrustFilterValue = "all" | "first-party" | "external" | "none";

export type ClaimStatusFilterValue = "all" | "unclaimed" | "pending" | "verified";

export type SourceStatusFilterValue = "all" | "available" | "missing";

export type RegistrySearchFilterState = {
  query: string;
  category: string;
  platform: string;
  installable: BooleanFilterValue;
  hasSafetyNotes: BooleanFilterValue;
  hasPrivacyNotes: BooleanFilterValue;
  downloadTrust: DownloadTrustFilterValue;
  claimStatus: ClaimStatusFilterValue;
  sourceStatus: SourceStatusFilterValue;
};

export type RegistrySearchFilterDimension =
  | "query"
  | "category"
  | "platform"
  | "installable"
  | "hasSafetyNotes"
  | "hasPrivacyNotes"
  | "downloadTrust"
  | "claimStatus"
  | "sourceStatus";

export function matchesQuery(entry: SearchDocument, query: string) {
  return matchesSearchQuery(entry, query);
}

export function matchesPlatform(entry: SearchDocument, platform: string) {
  if (!platform) return true;
  return (entry.platforms ?? []).some((item) => String(item).trim().toLowerCase() === platform);
}

export function matchesBooleanFilter(value: boolean, filter: BooleanFilterValue) {
  if (filter === "all") return true;
  return filter === "true" ? value : !value;
}

export function hasSafetyNotes(entry: SearchDocument) {
  return Boolean(entry.trustSignals?.hasSafetyNotes || entry.safetyNotes?.length);
}

export function hasPrivacyNotes(entry: SearchDocument) {
  return Boolean(entry.trustSignals?.hasPrivacyNotes || entry.privacyNotes?.length);
}

export function isInstallable(entry: SearchDocument) {
  return Boolean(entry.installable || entry.downloadUrl);
}

export function packageTrustValue(entry: SearchDocument) {
  return entry.downloadTrust || (entry.downloadUrl ? "external" : "none");
}

export function sourceStatusValue(entry: SearchDocument) {
  return entry.trustSignals?.sourceStatus || "missing";
}

export function claimStatusValue(entry: SearchDocument) {
  return entry.claimStatus || "unclaimed";
}

export function entryMatchesFilters(
  entry: SearchDocument,
  filters: RegistrySearchFilterState,
  except?: ReadonlySet<RegistrySearchFilterDimension>,
) {
  const skip = (dimension: RegistrySearchFilterDimension) => except?.has(dimension) === true;

  if (!skip("category") && filters.category && entry.category !== filters.category) {
    return false;
  }
  if (!skip("platform") && !matchesPlatform(entry, filters.platform)) {
    return false;
  }
  if (!skip("installable") && !matchesBooleanFilter(isInstallable(entry), filters.installable)) {
    return false;
  }
  if (
    !skip("hasSafetyNotes") &&
    !matchesBooleanFilter(hasSafetyNotes(entry), filters.hasSafetyNotes)
  ) {
    return false;
  }
  if (
    !skip("hasPrivacyNotes") &&
    !matchesBooleanFilter(hasPrivacyNotes(entry), filters.hasPrivacyNotes)
  ) {
    return false;
  }
  if (
    !skip("downloadTrust") &&
    filters.downloadTrust !== "all" &&
    packageTrustValue(entry) !== filters.downloadTrust
  ) {
    return false;
  }
  if (
    !skip("claimStatus") &&
    filters.claimStatus !== "all" &&
    claimStatusValue(entry) !== filters.claimStatus
  ) {
    return false;
  }
  if (
    !skip("sourceStatus") &&
    filters.sourceStatus !== "all" &&
    sourceStatusValue(entry) !== filters.sourceStatus
  ) {
    return false;
  }
  if (!skip("query") && !matchesQuery(entry, filters.query)) {
    return false;
  }
  return true;
}

export function filterEntries(
  entries: ReadonlyArray<SearchDocument>,
  filters: RegistrySearchFilterState,
) {
  return entries.filter((entry) => entryMatchesFilters(entry, filters));
}

export type RankedSearchEntry = {
  entry: SearchDocument;
  score: number;
  reasons: string[];
};

export function scoreSearchEntry(
  entry: SearchDocument,
  query: string,
): Omit<RankedSearchEntry, "entry"> {
  return scoreSharedSearchEntry(entry, query);
}

export function rankSearchEntries(
  entries: ReadonlyArray<SearchDocument>,
  query: string,
): RankedSearchEntry[] {
  return rankSharedSearchEntries(entries, query) as SharedRankedSearchEntry<SearchDocument>[];
}
