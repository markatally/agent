import type { CSSProperties } from 'react';

export type ViewportSizingMode = 'fit' | 'fill' | 'pixel';

export interface SourceDimensions {
  width: number;
  height: number;
}

interface ViewportStyleOptions {
  mode: ViewportSizingMode;
  sourceDimensions?: SourceDimensions | null;
  fillHeight?: boolean;
  minHeight?: number;
  fallbackAspectRatio?: number;
}

const DEFAULT_ASPECT_RATIO = 16 / 9;

export function resolveAspectRatio(
  sourceDimensions?: SourceDimensions | null,
  fallbackAspectRatio: number = DEFAULT_ASPECT_RATIO
): number {
  if (!sourceDimensions) return fallbackAspectRatio;
  if (sourceDimensions.width <= 0 || sourceDimensions.height <= 0) return fallbackAspectRatio;
  return sourceDimensions.width / sourceDimensions.height;
}

export function getMediaObjectFit(mode: ViewportSizingMode): 'contain' | 'cover' | 'none' {
  if (mode === 'fill') return 'cover';
  if (mode === 'pixel') return 'none';
  return 'contain';
}

export function getViewportContainerStyle({
  mode,
  sourceDimensions,
  fillHeight = false,
  minHeight = 320,
  fallbackAspectRatio = DEFAULT_ASPECT_RATIO,
}: ViewportStyleOptions): CSSProperties {
  const ratio = resolveAspectRatio(sourceDimensions, fallbackAspectRatio);

  if (mode === 'pixel') {
    return fillHeight ? { minHeight } : {};
  }

  if (fillHeight) {
    return { minHeight, flex: 1, overflow: 'hidden' as const };
  }

  return { aspectRatio: ratio };
}

