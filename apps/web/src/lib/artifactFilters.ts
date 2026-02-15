const HIDDEN_ARTIFACT_NAMES = new Set(['search-results.json', 'video-probe.json']);

export function isHiddenArtifactName(name: string | undefined | null): boolean {
  if (!name) return false;
  return HIDDEN_ARTIFACT_NAMES.has(name.toLowerCase());
}

