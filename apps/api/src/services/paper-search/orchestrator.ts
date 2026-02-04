/**
 * Paper Search Orchestrator
 * Calls multiple PaperSearchSkills, merges and deduplicates by title/DOI,
 * cross-validates metadata, and resolves publication dates with priority:
 * 1) Publisher/DOI (CrossRef), 2) arXiv v1, 3) Semantic Scholar
 */

import type {
  PaperSearchSkill,
  RawPaperResult,
  ResolvedPaper,
  PaperSearchOrchestratorInput,
  PaperSearchOrchestratorOutput,
  AbsoluteDateWindow,
  PublicationDateSource,
  DateConfidence,
} from './types';
import { isDateWithinWindow } from './time-range-parser';

const DATE_SOURCE_PRIORITY: Record<string, number> = {
  crossref: 3,
  arxiv_v1: 2,
  semantic_scholar: 1,
};

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi || typeof doi !== 'string') return null;
  const t = doi.replace(/^https?:\/\/doi\.org\//i, '').trim();
  return t || null;
}

/** Group key for deduplication: prefer DOI, else normalized title */
function groupKey(p: RawPaperResult): string {
  const doi = normalizeDoi(p.doi);
  if (doi) return `doi:${doi.toLowerCase()}`;
  return `title:${normalizeTitle(p.title)}`;
}

/** Merge raw results: keep highest-priority source per field, resolve date by priority */
function resolveDateSource(paper: RawPaperResult): PublicationDateSource {
  if (paper.publicationDateSource) return paper.publicationDateSource;
  if (paper.source === 'arxiv') return 'arxiv_v1';
  if (paper.source === 'semantic_scholar') return 'semantic_scholar';
  if (paper.source === 'crossref') return 'crossref';
  return null;
}

function normalizeRawPaperResult(paper: RawPaperResult): RawPaperResult {
  const link = paper.link || paper.url || '';
  return {
    ...paper,
    link,
    url: paper.url || link,
  };
}

function mergeRawResults(groups: Map<string, RawPaperResult[]>): ResolvedPaper[] {
  const resolved: ResolvedPaper[] = [];
  for (const [, papers] of groups) {
    if (papers.length === 0) continue;
    const base = papers[0];
    let publicationDate: string | null = null;
    let publicationDateSource: PublicationDateSource = null;
    let publicationDateConfidence: DateConfidence = null;
    const exclusionReasons: string[] = [];
    const allDois = new Set<string>();
    const allTitles = new Set(papers.map((p) => p.title));
    papers.forEach((p) => {
      if (p.doi) allDois.add(normalizeDoi(p.doi) ?? '');
      if (p.exclusionReason) exclusionReasons.push(p.exclusionReason);
    });
    const withDates = papers
      .filter((p) => p.publicationDate)
      .map((p) => ({
        date: p.publicationDate!,
        source: resolveDateSource(p),
        priority: DATE_SOURCE_PRIORITY[resolveDateSource(p) ?? ''] ?? 0,
      }))
      .sort((a, b) => b.priority - a.priority);
    if (withDates.length > 0) {
      const best = withDates[0];
      publicationDate = best.date;
      publicationDateSource = best.source as PublicationDateSource;
      publicationDateConfidence = best.source === 'crossref' ? 'high' : best.source === 'arxiv_v1' ? 'high' : 'medium';
    } else {
      publicationDateConfidence = 'low';
    }
    let title = base.title;
    let authors = base.authors;
    let abstract = base.abstract;
    let link = base.link || base.url || '';
    let source = base.source;
    let doi = base.doi ?? null;
    let arxivId = base.arxivId ?? null;
    let semanticScholarId = base.semanticScholarId ?? null;
    let venue = base.venue ?? null;
    let citationCount = base.citationCount ?? null;
    for (const p of papers) {
      if (p.source === 'crossref' && p.publicationDate) {
        publicationDate = p.publicationDate;
        publicationDateSource = 'crossref';
        publicationDateConfidence = 'high';
      }
      if (!abstract && p.abstract) abstract = p.abstract;
      if (!venue && p.venue) venue = p.venue;
      if (citationCount == null && p.citationCount != null) citationCount = p.citationCount;
      if (!doi && p.doi) doi = p.doi;
      if (!arxivId && p.arxivId) arxivId = p.arxivId;
      if (!semanticScholarId && p.semanticScholarId) semanticScholarId = p.semanticScholarId;
      const ps = DATE_SOURCE_PRIORITY[resolveDateSource(p) ?? ''] ?? 0;
      const cs = DATE_SOURCE_PRIORITY[resolveDateSource({ ...p, source }) ?? ''] ?? 0;
      if (ps > cs) {
        title = p.title;
        authors = p.authors;
        link = p.link || p.url || link;
        source = p.source;
      }
    }
    resolved.push({
      title,
      authors: authors.length > 0 ? authors : ['Unknown'],
      abstract: abstract ?? undefined,
      link,
      source,
      doi: doi ?? null,
      arxivId: arxivId ?? null,
      semanticScholarId: semanticScholarId ?? null,
      publicationDate,
      publicationDateSource,
      publicationDateConfidence,
      venue: venue ?? null,
      citationCount: citationCount ?? null,
      exclusionReasons: exclusionReasons.length > 0 ? exclusionReasons : undefined,
    });
  }
  return resolved;
}

export interface OrchestratorDeps {
  getSkill?(id: string): PaperSearchSkill | undefined;
  skills?: PaperSearchSkill[];
  /** Optional: resolve DOI via CrossRef for papers that have DOI but no date */
  crossrefSkill?: PaperSearchSkill;
}

export function createPaperSearchOrchestrator(deps: OrchestratorDeps) {
  const { getSkill, skills, crossrefSkill } = deps;
  const skillMap = skills
    ? new Map(skills.map((skill) => [skill.id, skill]))
    : null;
  const resolveSkill = (id: string) => {
    if (skillMap) return skillMap.get(id);
    return getSkill ? getSkill(id) : undefined;
  };
  const inferredCrossrefSkill =
    crossrefSkill ||
    (skills ? skills.find((skill) => skill.id === 'crossref') : undefined);

  return async function run(
    input: PaperSearchOrchestratorInput | { query: string; options: { limit: number; sortBy?: 'relevance' | 'date' | 'citations'; dateRange?: string; absoluteDateWindow?: AbsoluteDateWindow } }
  ): Promise<PaperSearchOrchestratorOutput> {
    const query = input.query;
    const legacyOptions = 'options' in input ? input.options : undefined;
    const skillIds = 'options' in input
      ? (skills?.map((skill) => skill.id) ?? [])
      : input.skillIds;
    const limit = 'options' in input ? legacyOptions?.limit ?? 10 : input.limit;
    const sortBy = 'options' in input ? legacyOptions?.sortBy : input.sortBy;
    const dateRange = 'options' in input ? legacyOptions?.dateRange : input.dateRange;
    const absoluteDateWindow = 'options' in input
      ? legacyOptions?.absoluteDateWindow
      : input.absoluteDateWindow;
    
    // Pass both legacy dateRange AND new absoluteDateWindow to skills
    // Skills should prefer absoluteDateWindow when available for precise filtering
    const options = { 
      limit: Math.min(limit, 50), 
      sortBy: sortBy ?? 'relevance', 
      dateRange,
      absoluteDateWindow, // New: enables query-time date filtering with strict mode
    };
    const sourcesQueried: string[] = [];
    const sourcesSkipped: string[] = [];
    const exclusionReasons: string[] = [];
    const allRaw: RawPaperResult[] = [];
    const skillsToRun = skillIds.filter((id) => id !== 'crossref');
    for (const id of skillsToRun) {
      const skill = resolveSkill(id);
      if (!skill) {
        sourcesSkipped.push(id);
        exclusionReasons.push(`Skill not found: ${id}`);
        continue;
      }
      try {
        const results = await skill.search(query, options);
        sourcesQueried.push(id);
        allRaw.push(
          ...results.map((r) =>
            normalizeRawPaperResult({ ...r, source: r.source ?? id })
          )
        );
      } catch (e) {
        sourcesSkipped.push(id);
        exclusionReasons.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const byKey = new Map<string, RawPaperResult[]>();
    const titleToKey = new Map<string, string>();
    for (const p of allRaw) {
      const normalizedTitle = normalizeTitle(p.title);
      let key = groupKey(p);
      if (!normalizeDoi(p.doi) && titleToKey.has(normalizedTitle)) {
        key = titleToKey.get(normalizedTitle)!;
      }
      if (!byKey.has(key)) {
        byKey.set(key, []);
      }
      byKey.get(key)!.push(p);
      if (normalizedTitle) {
        titleToKey.set(normalizedTitle, key);
      }
    }
    let papers = mergeRawResults(byKey);
    if (inferredCrossrefSkill?.resolveByDoi) {
      const withDoi = papers.filter((p) => p.doi);
      for (const paper of withDoi) {
        try {
          const resolved = await inferredCrossrefSkill.resolveByDoi(paper.doi!);
          if (resolved?.publicationDate) {
            papers = papers.map((q) =>
              q.doi && normalizeDoi(q.doi) === normalizeDoi(paper.doi)
                ? {
                    ...q,
                    publicationDate: resolved.publicationDate ?? q.publicationDate,
                    publicationDateSource: (resolved.publicationDate ? 'crossref' : q.publicationDateSource) as PublicationDateSource,
                    publicationDateConfidence: (resolved.publicationDate ? 'high' : q.publicationDateConfidence) as DateConfidence,
                  }
                : q
            );
          }
        } catch {
          // ignore per-DOI failures
        }
      }
    }
    if (absoluteDateWindow) {
      papers = papers.filter((paper) =>
        isDateWithinWindow(paper.publicationDate, absoluteDateWindow)
      );
    }
    const sortOrder = sortBy ?? 'relevance';
    if (sortOrder === 'date') {
      papers.sort((a, b) => {
        const da = a.publicationDate ? new Date(a.publicationDate).getTime() : 0;
        const db = b.publicationDate ? new Date(b.publicationDate).getTime() : 0;
        return db - da;
      });
    } else if (sortOrder === 'citations') {
      papers.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
    } else {
      const priority: Record<string, number> = { arxiv: 3, semantic_scholar: 2, crossref: 1 };
      papers.sort((a, b) => (priority[b.source] ?? 0) - (priority[a.source] ?? 0));
    }
    papers = papers.slice(0, limit);
    return {
      papers,
      sourcesQueried,
      sourcesSkipped,
      exclusionReasons,
    };
  };
}
