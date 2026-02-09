/**
 * Time Range Parser Tests
 * 
 * Tests for time range parsing and date window conversion
 */

import { describe, it, expect } from 'vitest';
import {
  parseTimeRangeFromInput,
  parseDateRangeString,
  intentToAbsoluteDateWindow,
  isDateWithinWindow,
  filterPapersByDateWindow,
  validateTimeRange,
  isStrictTimeRange,
  describeTimeWindow,
} from '../../apps/api/src/services/paper-search/time-range-parser';
import type { AbsoluteDateWindow, ResolvedPaper } from '../../apps/api/src/services/paper-search/types';

describe('Time Range Parser', () => {
  describe('parseTimeRangeFromInput', () => {
    it('should parse "last N months" pattern', () => {
      const result = parseTimeRangeFromInput('Find papers from the last 6 months');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('months');
      expect(result?.value).toBe(6);
      expect(result?.strict).toBe(true);
    });
    
    it('should parse "last N years" pattern', () => {
      const result = parseTimeRangeFromInput('Papers from last 2 years');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('years');
      expect(result?.value).toBe(2);
    });
    
    it('should parse "last N days" pattern', () => {
      const result = parseTimeRangeFromInput('Research from the last 30 days');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('days');
      expect(result?.value).toBe(30);
    });
    
    it('should parse "last N weeks" pattern', () => {
      const result = parseTimeRangeFromInput('papers in the last 4 weeks');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('weeks');
      expect(result?.value).toBe(4);
    });
    
    it('should parse "this month" pattern', () => {
      const result = parseTimeRangeFromInput('Papers from this month');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('months');
      expect(result?.value).toBe(1);
    });
    
    it('should parse "this year" pattern', () => {
      const result = parseTimeRangeFromInput('Research this year');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('years');
      expect(result?.value).toBe(1);
    });
    
    it('should parse "since Month YYYY" pattern', () => {
      const result = parseTimeRangeFromInput('Papers since January 2024');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('absolute');
      expect(result?.startYear).toBe(2024);
      expect(result?.startMonth).toBe(0); // January is 0
    });

    it('should parse explicit single year constraints', () => {
      const result = parseTimeRangeFromInput('Find time series papers released in 2026');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('absolute');
      expect(result?.startYear).toBe(2026);
      expect(result?.endYear).toBe(2026);
      expect(result?.strict).toBe(true);
    });

    it('should parse explicit year ranges in natural language', () => {
      const result = parseTimeRangeFromInput('Research between 2024 and 2026');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('absolute');
      expect(result?.startYear).toBe(2024);
      expect(result?.endYear).toBe(2026);
      expect(result?.strict).toBe(true);
    });
    
    it('should parse "recent papers" as flexible pattern', () => {
      const result = parseTimeRangeFromInput('Find recent papers on AI');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('months');
      expect(result?.value).toBe(12);
      expect(result?.strict).toBe(false); // Flexible
    });
    
    it('should parse "new papers" as flexible pattern', () => {
      const result = parseTimeRangeFromInput('Show new papers');
      expect(result).toBeDefined();
      expect(result?.unit).toBe('months');
      expect(result?.value).toBe(6);
      expect(result?.strict).toBe(false);
    });
    
    it('should return null for queries without time patterns', () => {
      const result = parseTimeRangeFromInput('AI agents research');
      expect(result).toBeNull();
    });
  });
  
  describe('parseDateRangeString', () => {
    it('should parse "last-N-months" format', () => {
      const intent = parseDateRangeString('last-12-months');
      expect(intent).toBeDefined();
      expect(intent?.unit).toBe('months');
      expect(intent?.value).toBe(12);
      expect(intent?.strict).toBe(true);
    });
    
    it('should parse "last-N-years" format', () => {
      const intent = parseDateRangeString('last-2-years');
      expect(intent).toBeDefined();
      expect(intent?.unit).toBe('years');
      expect(intent?.value).toBe(2);
    });
    
    it('should parse year range "YYYY-YYYY"', () => {
      const intent = parseDateRangeString('2020-2023');
      expect(intent).toBeDefined();
      expect(intent?.unit).toBe('absolute');
      expect(intent?.startYear).toBe(2020);
      expect(intent?.endYear).toBe(2023);
      expect(intent?.strict).toBe(true);
    });
    
    it('should parse single year "YYYY"', () => {
      const intent = parseDateRangeString('2023');
      expect(intent).toBeDefined();
      expect(intent?.unit).toBe('absolute');
      expect(intent?.startYear).toBe(2023);
      expect(intent?.endYear).toBe(2023);
    });
    
    it('should return null for invalid format', () => {
      const intent = parseDateRangeString('invalid-format');
      expect(intent).toBeNull();
    });
  });
  
  describe('intentToAbsoluteDateWindow', () => {
    const referenceDate = new Date('2024-06-15');
    
    it('should convert "months" intent to date window', () => {
      const intent = { unit: 'months' as const, value: 6, strict: true };
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.strict).toBe(true);
      expect(window.endDate).toBe('2024-06-15');
      // Should be 6 months before
      expect(window.startDate).toBe('2023-12-15');
    });
    
    it('should convert "years" intent to date window', () => {
      const intent = { unit: 'years' as const, value: 2, strict: true };
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.endDate).toBe('2024-06-15');
      expect(window.startDate).toBe('2022-06-15');
    });
    
    it('should convert "days" intent to date window', () => {
      const intent = { unit: 'days' as const, value: 30, strict: true };
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.endDate).toBe('2024-06-15');
      expect(window.startDate).toBe('2024-05-16');
    });
    
    it('should convert "weeks" intent to date window', () => {
      const intent = { unit: 'weeks' as const, value: 4, strict: true };
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.endDate).toBe('2024-06-15');
      expect(window.startDate).toBe('2024-05-18');
    });
    
    it('should convert absolute date intent', () => {
      const intent = {
        unit: 'absolute' as const,
        startYear: 2023,
        startMonth: 0, // January
        endYear: 2023,
        endMonth: 11, // December
        strict: true,
      };
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.startDate).toBe('2023-01-01');
      expect(window.endDate).toBe('2023-12-31');
    });
    
    it('should use current date if no reference date provided', () => {
      const intent = { unit: 'months' as const, value: 6, strict: true };
      const window = intentToAbsoluteDateWindow(intent);
      
      expect(window).toBeDefined();
      expect(window.endDate).toBeTruthy();
      expect(window.startDate).toBeTruthy();
    });
    
    it('should preserve strict flag', () => {
      const strictIntent = { unit: 'months' as const, value: 6, strict: true };
      const flexibleIntent = { unit: 'months' as const, value: 12, strict: false };
      
      const strictWindow = intentToAbsoluteDateWindow(strictIntent, referenceDate);
      const flexibleWindow = intentToAbsoluteDateWindow(flexibleIntent, referenceDate);
      
      expect(strictWindow.strict).toBe(true);
      expect(flexibleWindow.strict).toBe(false);
    });
  });
  
  describe('isDateWithinWindow', () => {
    const window: AbsoluteDateWindow = {
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      strict: true,
    };
    
    it('should return true for date within window', () => {
      expect(isDateWithinWindow('2023-06-15', window)).toBe(true);
    });
    
    it('should return true for start date (inclusive)', () => {
      expect(isDateWithinWindow('2023-01-01', window)).toBe(true);
    });
    
    it('should return true for end date (inclusive)', () => {
      expect(isDateWithinWindow('2023-12-31', window)).toBe(true);
    });
    
    it('should return false for date before window', () => {
      expect(isDateWithinWindow('2022-12-31', window)).toBe(false);
    });
    
    it('should return false for date after window', () => {
      expect(isDateWithinWindow('2024-01-01', window)).toBe(false);
    });
    
    it('should handle year-only dates in strict mode', () => {
      expect(isDateWithinWindow('2023', window)).toBe(false); // Undated
    });
    
    it('should accept year-only dates in flexible mode', () => {
      const flexibleWindow = { ...window, strict: false };
      expect(isDateWithinWindow('2023', flexibleWindow)).toBe(true);
    });
    
    it('should return false for invalid date format', () => {
      expect(isDateWithinWindow('not-a-date', window)).toBe(false);
    });
    
    it('should handle null date in strict mode', () => {
      expect(isDateWithinWindow(null, window)).toBe(false);
    });
    
    it('should accept null date in flexible mode', () => {
      const flexibleWindow = { ...window, strict: false };
      expect(isDateWithinWindow(null, flexibleWindow)).toBe(true);
    });
  });
  
  describe('filterPapersByDateWindow', () => {
    const window: AbsoluteDateWindow = {
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      strict: true,
    };
    
    const papers: ResolvedPaper[] = [
      {
        id: '1',
        title: 'Paper 1',
        authors: ['A'],
        abstract: 'Abstract',
        url: 'https://example.com/1',
        source: 'arxiv',
        publicationDate: '2023-06-15',
        included: true,
      },
      {
        id: '2',
        title: 'Paper 2',
        authors: ['B'],
        abstract: 'Abstract',
        url: 'https://example.com/2',
        source: 'arxiv',
        publicationDate: '2022-12-31',
        included: true,
      },
      {
        id: '3',
        title: 'Paper 3',
        authors: ['C'],
        abstract: 'Abstract',
        url: 'https://example.com/3',
        source: 'arxiv',
        publicationDate: null,
        included: true,
      },
    ];
    
    it('should filter papers within date window', () => {
      const filtered = filterPapersByDateWindow(papers, window);
      
      expect(filtered).toHaveLength(3);
      expect(filtered[0].included).toBe(true);
      expect(filtered[1].included).toBe(false);
      expect(filtered[1].exclusionReason).toContain('outside date range');
      expect(filtered[2].included).toBe(false);
      expect(filtered[2].exclusionReason).toContain('missing publication date');
    });
    
    it('should include undated papers in flexible mode', () => {
      const flexibleWindow = { ...window, strict: false };
      const filtered = filterPapersByDateWindow(papers, flexibleWindow);
      
      const undatedPaper = filtered.find(p => p.id === '3');
      expect(undatedPaper?.included).toBe(true);
    });
    
    it('should set exclusion reasons correctly', () => {
      const filtered = filterPapersByDateWindow(papers, window);
      
      const oldPaper = filtered.find(p => p.id === '2');
      expect(oldPaper?.exclusionReason).toContain('2022-12-31');
      
      const undatedPaper = filtered.find(p => p.id === '3');
      expect(undatedPaper?.exclusionReason).toContain('missing publication date');
    });
  });
  
  describe('validateTimeRange', () => {
    it('should prioritize dateRangeParam over userInput', () => {
      const result = validateTimeRange('last 6 months', 'last-12-months');
      
      expect(result.isValid).toBe(true);
      expect(result.absoluteDateWindow).toBeDefined();
      // Should use dateRangeParam (12 months) not userInput (6 months)
    });
    
    it('should use userInput if no dateRangeParam', () => {
      const result = validateTimeRange('last 6 months');
      
      expect(result.isValid).toBe(true);
      expect(result.absoluteDateWindow).toBeDefined();
    });
    
    it('should return no window if neither provided', () => {
      const result = validateTimeRange();
      
      expect(result.isValid).toBe(true);
      expect(result.absoluteDateWindow).toBeUndefined();
    });
    
    it('should return no window if no time pattern found', () => {
      const result = validateTimeRange('AI agents research');
      
      expect(result.isValid).toBe(true);
      expect(result.absoluteDateWindow).toBeUndefined();
    });
  });
  
  describe('isStrictTimeRange', () => {
    it('should return true for strict time ranges', () => {
      const strictWindow: AbsoluteDateWindow = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        strict: true,
      };
      expect(isStrictTimeRange(strictWindow)).toBe(true);
    });
    
    it('should return false for flexible time ranges', () => {
      const flexibleWindow: AbsoluteDateWindow = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        strict: false,
      };
      expect(isStrictTimeRange(flexibleWindow)).toBe(false);
    });
  });
  
  describe('describeTimeWindow', () => {
    it('should describe time window correctly', () => {
      const window: AbsoluteDateWindow = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        strict: true,
      };
      
      const description = describeTimeWindow(window);
      expect(description).toContain('2023-01-01');
      expect(description).toContain('2023-12-31');
      expect(description).toContain('strict');
    });
    
    it('should indicate flexible mode', () => {
      const window: AbsoluteDateWindow = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        strict: false,
      };
      
      const description = describeTimeWindow(window);
      expect(description).toContain('flexible');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle leap year dates', () => {
      const window: AbsoluteDateWindow = {
        startDate: '2024-02-29',
        endDate: '2024-03-01',
        strict: true,
      };
      
      expect(isDateWithinWindow('2024-02-29', window)).toBe(true);
    });
    
    it('should handle month boundaries correctly', () => {
      const intent = { unit: 'months' as const, value: 1, strict: true };
      const referenceDate = new Date('2024-03-31');
      const window = intentToAbsoluteDateWindow(intent, referenceDate);
      
      expect(window.endDate).toBe('2024-03-31');
      // Should handle month with different number of days
      expect(window.startDate).toBeTruthy();
    });
  });
});
