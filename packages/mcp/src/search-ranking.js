const tokenSplitPattern = /[^a-z0-9+#.-]+/i;
const queryAliases = {
  cc: ["claude", "claude-code"],
  claude: ["claude-code"],
  gh: ["github"],
  ms: ["microsoft"],
  msteams: ["teams", "microsoft-teams"],
  repo: ["repository", "github"],
  repos: ["repository", "github"],
};

const searchReasonPriority = [
  "title phrase",
  "slug phrase",
  "source-backed",
  "trusted package",
  "safety notes",
  "privacy notes",
  "title term",
  "slug term",
  "tag match",
  "keyword match",
  "category match",
  "category term",
  "platform match",
  "installable",
  "reviewed",
];

export function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function tokenizeSearchQuery(query) {
  return normalizeSearchText(query)
    .split(tokenSplitPattern)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12);
}

function expandedTokenCandidates(token) {
  return [token, ...(queryAliases[token] || [])];
}

function valueList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function normalizedSet(value) {
  return new Set(valueList(value).map(normalizeSearchText).filter(Boolean));
}

export function entrySearchText(entry) {
  return [
    entry.category,
    entry.slug,
    entry.title,
    entry.description,
    entry.cardDescription,
    entry.author,
    entry.submittedBy,
    entry.brandName,
    entry.brandDomain,
    entry.verificationStatus,
    entry.downloadTrust,
    entry.documentationUrl,
    entry.repoUrl,
    entry.githubUrl,
    entry.sourceUrl,
    ...(entry.trustSignals?.sourceUrls || []),
    ...(entry.platforms || []),
    ...(entry.supportLevels || []),
    ...valueList(entry.safetyNotes),
    ...valueList(entry.privacyNotes),
    ...(entry.tags || []),
    ...(entry.keywords || []),
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");
}

function entryWordSet(entry) {
  return new Set(
    entrySearchText(entry)
      .split(tokenSplitPattern)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function candidateMatchesText(candidate, haystack, words) {
  if (candidate.length <= 2) {
    return [...words].some(
      (word) => word === candidate || word.startsWith(candidate),
    );
  }
  return haystack.includes(candidate) || [...words].some((word) => word.startsWith(candidate));
}

function valueMatchesCandidate(value, candidate) {
  const normalized = normalizeSearchText(value);
  return candidateMatchesText(
    candidate,
    normalized,
    new Set(
      normalized
        .split(tokenSplitPattern)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  );
}

function setMatchesCandidates(values, candidates) {
  return [...values].some((value) =>
    candidates.some((candidate) => valueMatchesCandidate(value, candidate)),
  );
}

function entryPackageTrust(entry) {
  return (
    entry.downloadTrust ||
    entry.trustSignals?.packageTrust ||
    (entry.downloadUrl ? "external" : "none")
  );
}

function entrySourceStatus(entry) {
  const explicit = normalizeSearchText(entry.trustSignals?.sourceStatus);
  if (explicit) return explicit;
  const sourceUrls = [
    entry.documentationUrl,
    entry.repoUrl,
    entry.githubUrl,
    entry.sourceUrl,
    ...(entry.trustSignals?.sourceUrls || []),
  ].filter((value) => String(value || "").trim());
  return sourceUrls.length ? "available" : "missing";
}

function hasSafetyNotes(entry) {
  return Boolean(
    entry.trustSignals?.hasSafetyNotes || valueList(entry.safetyNotes).length,
  );
}

function hasPrivacyNotes(entry) {
  return Boolean(
    entry.trustSignals?.hasPrivacyNotes || valueList(entry.privacyNotes).length,
  );
}

function rankedSearchReasons(reasons) {
  const priority = new Map(searchReasonPriority.map((reason, index) => [reason, index]));
  return [...reasons]
    .sort((left, right) => (priority.get(left) ?? 999) - (priority.get(right) ?? 999))
    .slice(0, 8);
}

export function matchesSearchQuery(entry, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = entrySearchText(entry);
  const tokens = tokenizeSearchQuery(normalizedQuery);
  if (!tokens.length) return false;
  const words = entryWordSet(entry);

  if (
    normalizedQuery.length > 2
      ? haystack.includes(normalizedQuery)
      : candidateMatchesText(normalizedQuery, haystack, words)
  ) {
    return true;
  }

  return tokens.every((token) =>
    expandedTokenCandidates(token).some((candidate) =>
      candidateMatchesText(candidate, haystack, words),
    ),
  );
}

export function scoreSearchEntry(entry, query) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = tokenizeSearchQuery(normalizedQuery);
  if (!tokens.length) return { score: 0, reasons: [] };

  const title = normalizeSearchText(entry.title);
  const slug = normalizeSearchText(entry.slug);
  const category = normalizeSearchText(entry.category);
  const tags = normalizedSet(entry.tags);
  const keywords = normalizedSet(entry.keywords);
  const platforms = normalizedSet(entry.platforms);
  const haystack = entrySearchText(entry);
  const words = entryWordSet(entry);
  const reasons = new Set();
  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 90;
    reasons.add("title phrase");
  }
  if (slug.includes(normalizedQuery)) {
    score += 65;
    reasons.add("slug phrase");
  }
  if (category === normalizedQuery) {
    score += 45;
    reasons.add("category match");
  }

  for (const token of tokens) {
    const candidates = expandedTokenCandidates(token);
    if (candidates.some((candidate) => valueMatchesCandidate(title, candidate))) {
      score += 35;
      reasons.add("title term");
    }
    if (candidates.some((candidate) => valueMatchesCandidate(slug, candidate))) {
      score += 28;
      reasons.add("slug term");
    }
    if (setMatchesCandidates(tags, candidates)) {
      score += 24;
      reasons.add("tag match");
    }
    if (setMatchesCandidates(keywords, candidates)) {
      score += 18;
      reasons.add("keyword match");
    }
    if (candidates.some((candidate) => valueMatchesCandidate(category, candidate))) {
      score += 12;
      reasons.add("category term");
    }
    if (setMatchesCandidates(platforms, candidates)) {
      score += 16;
      reasons.add("platform match");
    }
    if (candidates.some((candidate) => candidateMatchesText(candidate, haystack, words))) {
      score += 4;
    }
    if ([...words].some((word) => candidates.some((candidate) => word.startsWith(candidate)))) {
      score += 2;
    }
  }

  if (entry.installable || entry.downloadUrl) {
    score += 4;
    reasons.add("installable");
  }
  if (entrySourceStatus(entry) === "available") {
    score += 8;
    reasons.add("source-backed");
  }
  if (
    entryPackageTrust(entry) === "first-party" ||
    entry.packageVerified ||
    entry.trustSignals?.packageVerified
  ) {
    score += 8;
    reasons.add("trusted package");
  }
  if (hasSafetyNotes(entry)) {
    score += 4;
    reasons.add("safety notes");
  }
  if (hasPrivacyNotes(entry)) {
    score += 4;
    reasons.add("privacy notes");
  }
  if (entry.claimStatus === "verified" || entry.reviewedBy) {
    score += 4;
    reasons.add("reviewed");
  }

  return { score, reasons: rankedSearchReasons(reasons) };
}

export function rankSearchEntries(entries, query) {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      ...scoreSearchEntry(entry, query),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const dateCompare = String(right.entry.dateAdded || "").localeCompare(
        String(left.entry.dateAdded || ""),
      );
      if (dateCompare !== 0) return dateCompare;
      return left.index - right.index;
    })
    .map(({ entry, score, reasons }) => ({ entry, score, reasons }));
}
