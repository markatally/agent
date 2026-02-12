import { describe, expect, it } from 'vitest';
import {
  getMediaObjectFit,
  getViewportContainerStyle,
  resolveAspectRatio,
} from '../viewportSizing';

describe('viewport sizing helpers', () => {
  it('resolves aspect ratio from source dimensions', () => {
    expect(resolveAspectRatio({ width: 1920, height: 1080 })).toBeCloseTo(16 / 9);
    expect(resolveAspectRatio({ width: 1000, height: 1000 })).toBeCloseTo(1);
  });

  it('falls back to default ratio when source dimensions are invalid', () => {
    expect(resolveAspectRatio(null)).toBeCloseTo(16 / 9);
    expect(resolveAspectRatio({ width: 0, height: 800 })).toBeCloseTo(16 / 9);
    expect(resolveAspectRatio({ width: 800, height: 0 })).toBeCloseTo(16 / 9);
  });

  it('maps object-fit by mode deterministically', () => {
    expect(getMediaObjectFit('fit')).toBe('contain');
    expect(getMediaObjectFit('fill')).toBe('cover');
    expect(getMediaObjectFit('pixel')).toBe('none');
  });

  it('returns ratio-based style in FIT mode when not fillHeight', () => {
    const style = getViewportContainerStyle({
      mode: 'fit',
      sourceDimensions: { width: 1200, height: 800 },
      fillHeight: false,
    });

    expect(style.aspectRatio).toBeCloseTo(1.5);
  });

  it('returns minHeight style in FILL mode when fillHeight is true', () => {
    const style = getViewportContainerStyle({
      mode: 'fill',
      sourceDimensions: { width: 1200, height: 800 },
      fillHeight: true,
      minHeight: 140,
    });

    expect(style).toEqual({ minHeight: 140, flex: 1, overflow: 'hidden' });
  });

  it('returns scroll-friendly style in PIXEL mode', () => {
    const style = getViewportContainerStyle({
      mode: 'pixel',
      sourceDimensions: { width: 1200, height: 800 },
      fillHeight: true,
      minHeight: 180,
    });

    expect(style).toEqual({ minHeight: 180 });
    expect(style).not.toHaveProperty('aspectRatio');
  });
});
