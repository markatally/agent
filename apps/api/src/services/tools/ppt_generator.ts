/**
 * PowerPoint Generator Tool
 * Creates PowerPoint presentations from structured content
 * Uses pptxgenjs open-source library
 */

import PptxGenJS from 'pptxgenjs';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import net from 'net';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../prisma';
import type { Tool, ToolResult, ToolContext } from './types';

const execFileAsync = promisify(execFile);

/**
 * Slide content structure
 */
interface Slide {
  title: string;
  content: string[];
  bullets?: string[];
  notes?: string;
  keyInsight?: string;
  source?: string;
}

/**
 * Presentation structure
 */
interface Presentation {
  title: string;
  subtitle?: string;
  author?: string;
  slides: Slide[];
}

/**
 * PowerPoint Generator Tool
 * Generates .pptx files from structured presentation content
 */
export class PptGeneratorTool implements Tool {
  private static renderToolchainStatus: 'unknown' | 'available' | 'unavailable' = 'unknown';
  private static hasLoggedDbUnavailable = false;
  private static dbReachability: 'unknown' | 'reachable' | 'unreachable' = 'unknown';

  name = 'ppt_generator';
  description = 'Generate high-quality PowerPoint (.pptx) presentations with strong visual hierarchy, strategic insights, and structured slide logic.';
  requiresConfirmation = false; // No confirmation needed for file generation
  timeout = 30000;

  private readonly theme = {
    bgDark: '0F2942',
    bgLight: 'F4F8FB',
    primary: '0C5C8F',
    secondary: '2A7EAE',
    accent: 'F59E0B',
    textDark: '1E2E3E',
    textMuted: '607080',
    white: 'FFFFFF',
    card: 'FFFFFF',
    cardBorder: 'D7E3ED',
  } as const;

  inputSchema = {
    type: 'object' as const,
    properties: {
      presentation: {
        type: 'object' as const,
        description: 'The presentation data structure',
        properties: {
          title: {
            type: 'string' as const,
            description: 'Presentation title (shown on first slide)',
          },
          subtitle: {
            type: 'string' as const,
            description: 'Optional subtitle for the title slide',
          },
          author: {
            type: 'string' as const,
            description: 'Optional author name',
          },
          slides: {
            type: 'array' as const,
            description: 'Array of slide objects with title, content, and bullets',
            items: {
              type: 'object' as const,
              properties: {
                title: {
                  type: 'string' as const,
                  description: 'Slide title',
                },
                content: {
                  type: 'array' as const,
                  description: 'Array of content paragraphs/text for slide',
                  items: { type: 'string' as const },
                },
                bullets: {
                  type: 'array' as const,
                  description: 'Optional bullet points',
                  items: { type: 'string' as const },
                },
                notes: {
                  type: 'string' as const,
                  description: 'Optional presenter notes',
                },
                keyInsight: {
                  type: 'string' as const,
                  description: 'Optional strategic insight sentence for emphasis',
                },
                source: {
                  type: 'string' as const,
                  description: 'Optional source citation text for footer',
                },
              },
              required: ['title', 'content'],
            },
          },
        },
        required: ['title', 'slides'],
      },
      filename: {
        type: 'string' as const,
        description: 'Output filename (default: presentation.pptx)',
      },
    },
    required: ['presentation'],
  };

  constructor(private context: ToolContext) {}

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const normalizedParams: Record<string, any> = { ...(params || {}) };

      // Normalize common LLM mistakes (including truncated JSON from LLM tool calls)
      if (typeof normalizedParams.presentation === 'string') {
        const raw = normalizedParams.presentation.trim();
        try {
          normalizedParams.presentation = JSON.parse(raw);
        } catch {
          // Try to repair truncated JSON (e.g. "{\"title\": \"...\"" with no closing braces)
          let repaired: unknown = null;
          for (const suffix of [',"slides":[]}', '}']) {
            try {
              repaired = JSON.parse(raw + suffix);
              break;
            } catch {
              /* try next */
            }
          }
          if (repaired && typeof repaired === 'object' && repaired !== null && 'title' in repaired) {
            const obj = repaired as Record<string, unknown>;
            if (!Array.isArray(obj.slides)) obj.slides = [];
            normalizedParams.presentation = obj;
          }
          // Otherwise keep as-is; validation below will return "Presentation data is required"
        }
      }

      if (!normalizedParams.presentation && (normalizedParams.title || normalizedParams.slides)) {
        normalizedParams.presentation = {
          title: normalizedParams.title,
          subtitle: normalizedParams.subtitle,
          author: normalizedParams.author,
          slides: normalizedParams.slides,
        };
      }

      const hasExplicitPresentationParam = normalizedParams.presentation !== undefined;

      let presentation = this.extractPresentation(normalizedParams) as Presentation;
      if (
        !presentation &&
        normalizedParams.presentation &&
        typeof normalizedParams.presentation === 'object'
      ) {
        presentation = normalizedParams.presentation as Presentation;
      }

      if (presentation && typeof (presentation as any).slides === 'string') {
        try {
          const parsedSlides = JSON.parse((presentation as any).slides);
          if (Array.isArray(parsedSlides)) {
            presentation = { ...presentation, slides: parsedSlides };
          }
        } catch {
          // Keep as-is; validation below will handle invalid structure
        }
      }

      if (presentation && Array.isArray(presentation.slides)) {
        presentation = {
          ...presentation,
          slides: presentation.slides.map((slide) => {
            if (!slide || typeof slide !== 'object') return slide;
            const normalizedSlide = { ...slide };
            if (typeof normalizedSlide.title !== 'string') {
              normalizedSlide.title = this.toSafeText(normalizedSlide.title) || 'Slide';
            }
            if (typeof normalizedSlide.notes !== 'string' && normalizedSlide.notes !== undefined) {
              normalizedSlide.notes = this.toSafeText(normalizedSlide.notes);
            }
            if (
              typeof normalizedSlide.keyInsight !== 'string' &&
              normalizedSlide.keyInsight !== undefined
            ) {
              normalizedSlide.keyInsight = this.toSafeText(normalizedSlide.keyInsight);
            }
            if (typeof normalizedSlide.source !== 'string' && normalizedSlide.source !== undefined) {
              normalizedSlide.source = this.toSafeText(normalizedSlide.source);
            }

            if (typeof normalizedSlide.content === 'string') {
              normalizedSlide.content = [normalizedSlide.content];
            }
            if (Array.isArray(normalizedSlide.content)) {
              normalizedSlide.content = normalizedSlide.content
                .map((item) => this.toSafeText(item))
                .filter(Boolean);
            }
            if (typeof normalizedSlide.bullets === 'string') {
              normalizedSlide.bullets = [normalizedSlide.bullets];
            }
            if (Array.isArray(normalizedSlide.bullets)) {
              normalizedSlide.bullets = normalizedSlide.bullets
                .map((item) => this.toSafeText(item))
                .filter(Boolean);
            }
            return normalizedSlide;
          }),
        };
      }

      if (!hasExplicitPresentationParam) {
        presentation = this.coercePresentationFromAlternatives(normalizedParams, presentation);
      }

      const filename = (normalizedParams.filename as string) || 'presentation.pptx';

      // Validate presentation structure
      if (!presentation || typeof presentation !== 'object') {
        return {
          success: false,
          output: '',
          error: 'Presentation data is required',
          duration: Date.now() - startTime,
        };
      }

      if (!presentation.title || !Array.isArray(presentation.slides)) {
        return {
          success: false,
          output: '',
          error: 'Presentation must have title and slides array',
          duration: Date.now() - startTime,
        };
      }

      if (presentation.slides.length === 0) {
        return {
          success: false,
          output: '',
          error: 'Presentation must have at least one slide',
          duration: Date.now() - startTime,
        };
      }

      // Generate PPTX
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.theme = {
        headFontFace: 'Cambria',
        bodyFontFace: 'Calibri',
        lang: 'en-US',
      };

      // Set metadata
      pptx.title = presentation.title;
      pptx.author = presentation.author || 'Mark Agent';
      pptx.subject = presentation.title;
      pptx.company = 'Mark Agent';

      // Create title slide
      this.createTitleSlide(pptx, presentation);

      // Create content slides
      for (let i = 0; i < presentation.slides.length; i++) {
        this.createContentSlide(pptx, presentation.slides[i], i, presentation.slides.length);
      }

      // Create outputs directory if it doesn't exist (project convention)
      const outputsDir = path.join(process.cwd(), 'outputs', 'ppt');
      await fs.mkdir(outputsDir, { recursive: true });

      // Sanitize filename
      const safeFilename = this.sanitizeFilename(filename.endsWith('.pptx') ? filename : `${filename}.pptx`);
      const filepath = path.join(outputsDir, safeFilename);

      // Generate to PPTX file
      await pptx.writeFile({ fileName: filepath });

      let previewSnapshots = this.buildSlidePreviewSnapshots(presentation);
      const renderedPreviews = await this.renderPptxPreviewSnapshots(
        filepath,
        Math.min(6, presentation.slides.length + 1)
      );
      if (renderedPreviews && renderedPreviews.length > 0) {
        previewSnapshots = renderedPreviews;
      }

      // Get file size
      const stats = await fs.stat(filepath);
      const sizeBytes = stats.size;
      const sizeKB = (sizeBytes / 1024).toFixed(2);

      // Save to database for download when context is available
      let fileId: string | undefined;
      if (this.context?.sessionId) {
        const canPersistFileMetadata = await this.canPersistFileMetadata();
        try {
          if (canPersistFileMetadata) {
            const dbFile = await prisma.file.create({
              data: {
                sessionId: this.context.sessionId,
                filename: safeFilename,
                filepath: `outputs/ppt/${safeFilename}`,
                sizeBytes: BigInt(sizeBytes),
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              },
            });
            fileId = dbFile.id;
          }
        } catch (error) {
          this.logFileRecordWarning(error);
          // Continue without database entry - file still exists on disk
        }
      }

      const output = `Successfully generated PowerPoint presentation:

📊 Presentation: ${presentation.title}
📄 Filename: ${safeFilename}
📊 Slides: ${presentation.slides.length + 1} (including title slide)
📦 Size: ${sizeKB} KB

The presentation is ready for download.`;

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
        previewSnapshots,
        artifacts: [
          {
            type: 'file',
            name: safeFilename,
            content: '', // File is on disk, not in memory
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            fileId,
            size: sizeBytes,
          },
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || 'Failed to generate PowerPoint',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Sanitize filename to prevent path traversal
   */
  private sanitizeFilename(filename: string): string {
    const basename = path.basename(filename);
    return basename.replace(/[\/\\:*?"<>|\x00]/g, '_');
  }

  private createTitleSlide(pptx: PptxGenJS, presentation: Presentation): void {
    const slide = pptx.addSlide();
    slide.background = { color: this.theme.bgDark };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 6.7,
      w: 13.33,
      h: 0.8,
      line: { color: this.theme.bgDark, transparency: 100 },
      fill: { color: this.theme.secondary, transparency: 30 },
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.9,
      y: 4.25,
      w: 6.9,
      h: 1.75,
      rectRadius: 0.06,
      line: { color: '4A7396', width: 1 },
      fill: { color: '143954', transparency: 6 },
    });

    slide.addText(this.truncate(presentation.title, 110), {
      x: 0.9,
      y: 0.95,
      w: 11.8,
      h: 1.6,
      fontFace: 'Cambria',
      fontSize: 44,
      bold: true,
      color: this.theme.white,
      margin: 0,
    });

    slide.addText(
      this.truncate(
        presentation.subtitle || 'Executive-ready brief generated with structured insight flow.',
        160
      ),
      {
        x: 0.9,
        y: 2.7,
        w: 11.5,
        h: 0.7,
        fontFace: 'Calibri',
        fontSize: 21,
        color: 'D6E7F2',
        margin: 0,
      }
    );

    slide.addText(
      `Prepared by ${this.truncate(presentation.author || 'Mark Agent', 60)} | ${new Date().toLocaleDateString('en-US')}`,
      {
        x: 1.2,
        y: 4.62,
        w: 6.2,
        h: 0.45,
        fontFace: 'Calibri',
        fontSize: 13,
        color: 'B9D3E6',
        margin: 0,
      }
    );

    slide.addText('Strategy-focused narrative with evidence-backed points', {
      x: 1.2,
      y: 5.2,
      w: 6.3,
      h: 0.45,
      fontFace: 'Calibri',
      fontSize: 13,
      italic: true,
      color: 'B9D3E6',
      margin: 0,
    });
  }

  private createContentSlide(
    pptx: PptxGenJS,
    slideData: Slide,
    index: number,
    total: number
  ): void {
    const slide = pptx.addSlide();
    slide.background = { color: this.theme.bgLight };

    this.addSlideHeader(pptx, slide, slideData, index, total);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72,
      y: 1.45,
      w: 12.0,
      h: 5.62,
      rectRadius: 0.06,
      line: { color: this.theme.cardBorder, width: 1 },
      fill: { color: this.theme.card },
      shadow: { type: 'outer', color: '000000', blur: 1, offset: 1, angle: 45, opacity: 0.08 },
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.72,
      y: 1.45,
      w: 0.24,
      h: 5.62,
      line: { color: this.theme.accent, transparency: 100 },
      fill: { color: this.theme.accent },
    });

    const insight = this.deriveInsight(slideData);
    slide.addText(insight, {
      x: 1.05,
      y: 1.78,
      w: 8.9,
      h: 0.58,
      fontFace: 'Calibri',
      fontSize: 14,
      bold: true,
      color: this.theme.primary,
      margin: 0,
    });

    const leftYStart = 2.5;
    this.addNarrativeContent(slide, slideData, leftYStart);
    this.addHighlightPanel(pptx, slide, slideData, leftYStart);
    this.addFooter(pptx, slide, slideData, index, total);

    const noteLines = [slideData.notes, `Strategic takeaway: ${this.deriveStrategicTakeaway(slideData)}`]
      .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      .map((line) => this.truncate(line.trim(), 500));
    if (noteLines.length > 0) {
      slide.addNotes(noteLines.join('\n'));
    }
  }

  private addSlideHeader(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    slideData: Slide,
    index: number,
    total: number
  ): void {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.86,
      line: { color: this.theme.primary, transparency: 100 },
      fill: { color: this.theme.primary },
    });

    slide.addText(this.truncate(slideData.title, 90), {
      x: 0.55,
      y: 0.17,
      w: 10.9,
      h: 0.5,
      fontFace: 'Cambria',
      fontSize: 25,
      bold: true,
      color: this.theme.white,
      margin: 0,
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 11.65,
      y: 0.12,
      w: 1.1,
      h: 0.55,
      rectRadius: 0.08,
      line: { color: '8DB5D2', width: 1 },
      fill: { color: '2A6E98' },
    });

    slide.addText(`${index + 1}/${total}`, {
      x: 11.8,
      y: 0.25,
      w: 0.8,
      h: 0.26,
      align: 'center',
      fontFace: 'Calibri',
      fontSize: 12,
      bold: true,
      color: this.theme.white,
      margin: 0,
    });
  }

  private addNarrativeContent(
    slide: PptxGenJS.Slide,
    slideData: Slide,
    startY: number
  ): void {
    slide.addText('Context and analysis', {
      x: 1.05,
      y: startY,
      w: 5.8,
      h: 0.3,
      fontFace: 'Calibri',
      fontSize: 13,
      bold: true,
      color: this.theme.secondary,
      margin: 0,
    });

    const paragraphs = (Array.isArray(slideData.content) ? slideData.content : [])
      .map((item) => this.truncate(item, 220))
      .filter(Boolean)
      .slice(0, 4);

    const runs: Array<{ text: string; options: Record<string, unknown> }> = [];
    for (let i = 0; i < paragraphs.length; i++) {
      runs.push({
        text: paragraphs[i],
        options: {
          breakLine: i < paragraphs.length - 1,
        },
      });
    }

    slide.addText(runs.length > 0 ? runs : 'No detailed narrative provided.', {
      x: 1.05,
      y: startY + 0.35,
      w: 6.4,
      h: 3.35,
      fontFace: 'Calibri',
      fontSize: 15,
      color: this.theme.textDark,
      valign: 'top',
      margin: 0,
    });

    slide.addText('So what', {
      x: 1.05,
      y: 6.0,
      w: 1.2,
      h: 0.28,
      fontFace: 'Calibri',
      fontSize: 12,
      bold: true,
      color: this.theme.secondary,
      margin: 0,
    });

    slide.addText(this.truncate(this.deriveStrategicTakeaway(slideData), 185), {
      x: 2.05,
      y: 5.95,
      w: 8.2,
      h: 0.35,
      fontFace: 'Calibri',
      fontSize: 12,
      italic: true,
      color: this.theme.textMuted,
      margin: 0,
    });
  }

  private addHighlightPanel(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    slideData: Slide,
    startY: number
  ): void {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 8.0,
      y: startY + 0.02,
      w: 4.35,
      h: 4.65,
      rectRadius: 0.06,
      line: { color: 'CADCE9', width: 1 },
      fill: { color: 'F8FBFE' },
    });

    slide.addText('Priority points', {
      x: 8.25,
      y: startY + 0.2,
      w: 3.9,
      h: 0.3,
      fontFace: 'Calibri',
      fontSize: 13,
      bold: true,
      color: this.theme.secondary,
      margin: 0,
    });

    const bullets = (Array.isArray(slideData.bullets) ? slideData.bullets : [])
      .map((item) => this.trimBulletPrefix(item))
      .filter(Boolean)
      .slice(0, 5);

    if (bullets.length > 0) {
      const runs = bullets.map((bullet, idx) => ({
        text: this.truncate(bullet, 120),
        options: {
          bullet: true,
          breakLine: idx < bullets.length - 1,
        },
      }));
      slide.addText(runs, {
        x: 8.25,
        y: startY + 0.58,
        w: 3.85,
        h: 3.9,
        fontFace: 'Calibri',
        fontSize: 13,
        color: this.theme.textDark,
        margin: 0,
      });
    } else {
      slide.addText('No explicit bullet points provided.', {
        x: 8.25,
        y: startY + 0.62,
        w: 3.85,
        h: 1.0,
        fontFace: 'Calibri',
        fontSize: 13,
        color: this.theme.textMuted,
        margin: 0,
      });
    }
  }

  private addFooter(
    pptx: PptxGenJS,
    slide: PptxGenJS.Slide,
    slideData: Slide,
    index: number,
    total: number
  ): void {
    slide.addShape(pptx.ShapeType.line, {
      x: 1.05,
      y: 6.65,
      w: 11.3,
      h: 0,
      line: { color: 'CCDBE7', width: 1 },
    });

    slide.addText(
      this.truncate(slideData.source || this.extractSourceFromNotes(slideData.notes) || 'Source: not provided', 200),
      {
        x: 1.05,
        y: 6.78,
        w: 9.8,
        h: 0.32,
        fontFace: 'Calibri',
        fontSize: 9,
        color: this.theme.textMuted,
        margin: 0,
      }
    );

    slide.addText(`${index + 1} of ${total}`, {
      x: 11.1,
      y: 6.78,
      w: 1.2,
      h: 0.3,
      align: 'right',
      fontFace: 'Calibri',
      fontSize: 9,
      color: this.theme.textMuted,
      margin: 0,
    });
  }

  private deriveInsight(slide: Slide): string {
    const keyInsight = this.toSafeText(slide.keyInsight);
    if (keyInsight) {
      return this.truncate(keyInsight, 130);
    }
    const candidate = this.toSafeText(slide.bullets?.[0]) || this.toSafeText(slide.content?.[0]) || 'Key insight';
    return this.truncate(`Insight: ${this.trimBulletPrefix(candidate)}`, 130);
  }

  private deriveStrategicTakeaway(slide: Slide): string {
    const source = this.toSafeText(slide.bullets?.[0]) || this.toSafeText(slide.content?.[0]);
    if (!source) {
      return 'Prioritize execution sequencing and measurable outcomes for this topic.';
    }
    const clean = this.trimBulletPrefix(source);
    return `${this.truncate(clean, 130)}. Translate this into a concrete owner and next milestone.`;
  }

  private extractSourceFromNotes(notes?: string): string | undefined {
    if (!notes) return undefined;
    const sourceMatch = notes.match(/source\s*:\s*(.+)$/im);
    if (sourceMatch?.[1]) return sourceMatch[1].trim();
    const urlMatch = notes.match(/https?:\/\/\S+/i);
    if (urlMatch?.[0]) return `Source: ${urlMatch[0]}`;
    return undefined;
  }

  private trimBulletPrefix(value: unknown): string {
    const normalized = this.toSafeText(value);
    if (!normalized) return '';
    return normalized.replace(/^\s*[•\-*]\s*/, '').trim();
  }

  private buildSlidePreviewSnapshots(presentation: Presentation): string[] {
    const snapshots: string[] = [];
    const pushIfPresent = (svg: string | null) => {
      if (!svg) return;
      snapshots.push(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    };

    pushIfPresent(this.buildTitlePreviewSvg(presentation));
    for (const slide of presentation.slides.slice(0, 5)) {
      pushIfPresent(this.buildContentPreviewSvg(slide));
    }
    return snapshots.slice(0, 6);
  }

  private async renderPptxPreviewSnapshots(
    pptxPath: string,
    maxSlides: number
  ): Promise<string[] | null> {
    if (maxSlides <= 0) return null;
    if (!(await this.isRenderToolchainAvailable())) {
      return null;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mark-ppt-preview-'));
    try {
      await execFileAsync(
        'soffice',
        ['--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', tmpDir, pptxPath],
        { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
      );

      const expectedPdf = path.join(
        tmpDir,
        `${path.basename(pptxPath, path.extname(pptxPath))}.pdf`
      );
      const pdfPath = await this.resolvePdfPath(tmpDir, expectedPdf);
      if (!pdfPath) return null;

      const outPrefix = path.join(tmpDir, 'slide');
      await execFileAsync(
        'pdftoppm',
        ['-png', '-r', '130', '-f', '1', '-l', String(maxSlides), pdfPath, outPrefix],
        { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
      );

      const renderedFiles = (await fs.readdir(tmpDir))
        .filter((name) => /^slide-\d+\.png$/i.test(name))
        .sort((a, b) => this.extractSlideIndex(a) - this.extractSlideIndex(b))
        .slice(0, maxSlides);

      if (renderedFiles.length === 0) return null;

      const previews: string[] = [];
      for (const fileName of renderedFiles) {
        const raw = await fs.readFile(path.join(tmpDir, fileName));
        previews.push(`data:image/png;base64,${raw.toString('base64')}`);
      }
      return previews;
    } catch {
      return null;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async isRenderToolchainAvailable(): Promise<boolean> {
    if (PptGeneratorTool.renderToolchainStatus === 'available') return true;
    if (PptGeneratorTool.renderToolchainStatus === 'unavailable') return false;

    const [hasSoffice, hasPdftoppm] = await Promise.all([
      this.hasCommand('soffice'),
      this.hasCommand('pdftoppm'),
    ]);
    const available = hasSoffice && hasPdftoppm;
    PptGeneratorTool.renderToolchainStatus = available ? 'available' : 'unavailable';
    return available;
  }

  private async hasCommand(command: string): Promise<boolean> {
    try {
      await execFileAsync('which', [command], { timeout: 1200, maxBuffer: 1024 * 1024 });
      return true;
    } catch {
      return false;
    }
  }

  private async resolvePdfPath(tmpDir: string, expectedPdf: string): Promise<string | null> {
    try {
      await fs.access(expectedPdf);
      return expectedPdf;
    } catch {
      const files = await fs.readdir(tmpDir);
      const pdf = files.find((name) => name.toLowerCase().endsWith('.pdf'));
      return pdf ? path.join(tmpDir, pdf) : null;
    }
  }

  private extractSlideIndex(fileName: string): number {
    const match = fileName.match(/-(\d+)\.png$/i);
    return match?.[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  private buildTitlePreviewSvg(presentation: Presentation): string | null {
    const title = this.escapeXml(this.truncate(presentation.title || 'Presentation', 85));
    const subtitle = this.escapeXml(
      this.truncate(
        presentation.subtitle || 'Executive-ready narrative with evidence and implications',
        120
      )
    );
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F2942"/>
      <stop offset="100%" stop-color="#102B4A"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="80" y="90" width="1120" height="540" rx="24" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <text x="120" y="250" fill="#FFFFFF" font-size="58" font-family="Cambria, Georgia, serif" font-weight="700">${title}</text>
  <text x="120" y="320" fill="#D4E6F5" font-size="30" font-family="Calibri, Arial, sans-serif">${subtitle}</text>
  <text x="120" y="580" fill="#B8D0E3" font-size="22" font-family="Calibri, Arial, sans-serif">Generated slide preview</text>
</svg>
    `.trim();
  }

  private buildContentPreviewSvg(slide: Slide): string | null {
    const title = this.escapeXml(this.truncate(slide.title || 'Slide', 65));
    const insight = this.escapeXml(this.truncate(this.deriveInsight(slide), 92));
    const narrative = this.escapeXml(this.truncate(slide.content?.[0] || 'No narrative provided.', 128));
    const bullets = (slide.bullets || [])
      .map((b) => this.escapeXml(this.truncate(this.trimBulletPrefix(b), 56)))
      .slice(0, 3);

    const bulletLines = bullets.length
      ? bullets
          .map(
            (b, idx) =>
              `<text x="810" y="${290 + idx * 58}" fill="#1E2E3E" font-size="24" font-family="Calibri, Arial, sans-serif">• ${b}</text>`
          )
          .join('')
      : `<text x="810" y="290" fill="#607080" font-size="24" font-family="Calibri, Arial, sans-serif">No bullet points provided</text>`;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#F4F8FB"/>
  <rect x="0" y="0" width="1280" height="86" fill="#0C5C8F"/>
  <text x="55" y="57" fill="#FFFFFF" font-size="34" font-family="Cambria, Georgia, serif" font-weight="700">${title}</text>
  <rect x="70" y="130" width="1140" height="520" rx="20" fill="#FFFFFF" stroke="#D7E3ED" stroke-width="2"/>
  <rect x="70" y="130" width="18" height="520" fill="#F59E0B"/>
  <text x="120" y="200" fill="#0C5C8F" font-size="26" font-family="Calibri, Arial, sans-serif" font-weight="700">${insight}</text>
  <text x="120" y="270" fill="#1E2E3E" font-size="25" font-family="Calibri, Arial, sans-serif">${narrative}</text>
  <rect x="780" y="220" width="380" height="280" rx="18" fill="#F8FBFE" stroke="#CADCE9" stroke-width="2"/>
  <text x="810" y="260" fill="#2A7EAE" font-size="24" font-family="Calibri, Arial, sans-serif" font-weight="700">Priority points</text>
  ${bulletLines}
</svg>
    `.trim();
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private logFileRecordWarning(error: unknown): void {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const dbUnavailable =
      /Can't reach database server/i.test(message) ||
      /PrismaClientInitializationError/i.test(message);

    if (dbUnavailable) {
      if (!PptGeneratorTool.hasLoggedDbUnavailable) {
        console.warn(
          '[ppt_generator] Database unavailable; skipping file metadata persistence and continuing with on-disk output.'
        );
        PptGeneratorTool.hasLoggedDbUnavailable = true;
      }
      return;
    }

    console.warn('[ppt_generator] Failed to save file metadata:', message);
  }

  private async canPersistFileMetadata(): Promise<boolean> {
    if (PptGeneratorTool.dbReachability === 'reachable') return true;
    if (PptGeneratorTool.dbReachability === 'unreachable') return false;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      PptGeneratorTool.dbReachability = 'unreachable';
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
    } catch {
      PptGeneratorTool.dbReachability = 'unreachable';
      return false;
    }

    const host = parsed.hostname;
    const port = Number(parsed.port || '5432');
    if (!host || !Number.isFinite(port) || port <= 0) {
      PptGeneratorTool.dbReachability = 'unreachable';
      return false;
    }

    const reachable = await this.checkTcpPort(host, port);
    PptGeneratorTool.dbReachability = reachable ? 'reachable' : 'unreachable';
    if (!reachable && !PptGeneratorTool.hasLoggedDbUnavailable) {
      console.warn(
        `[ppt_generator] Database ${host}:${port} unreachable; skipping file metadata persistence and continuing with on-disk output.`
      );
      PptGeneratorTool.hasLoggedDbUnavailable = true;
    }
    return reachable;
  }

  private async checkTcpPort(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const finalize = (result: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(300);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false));
      socket.once('error', () => finalize(false));
      socket.connect(port, host);
    });
  }

  private truncate(value: unknown, maxLen: number): string {
    const raw = this.toSafeText(value);
    if (!raw) return '';
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }

  private toSafeText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toSafeText(item))
        .filter(Boolean)
        .join(' ');
    }
    if (value && typeof value === 'object') {
      const candidate = (value as Record<string, unknown>).text;
      if (typeof candidate === 'string') return candidate.trim();
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return '';
  }

  private extractPresentation(params: Record<string, any>): Presentation | undefined {
    const candidates: unknown[] = [
      params.presentation,
      params.input?.presentation,
      params.parameters?.presentation,
      params.arguments?.presentation,
      params.args?.presentation,
      params.data?.presentation,
      params.payload?.presentation,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object') {
        return candidate as Presentation;
      }
    }
    return undefined;
  }

  private coercePresentationFromAlternatives(
    params: Record<string, any>,
    presentation: Presentation | undefined
  ): Presentation {
    const candidate = (presentation && typeof presentation === 'object' ? { ...presentation } : {}) as Record<
      string,
      any
    >;

    if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
      candidate.title = this.toSafeText(params.title || params.topic || params.subject) || 'Generated Presentation';
    }
    if (!candidate.subtitle && params.subtitle) {
      candidate.subtitle = this.toSafeText(params.subtitle);
    }
    if (!candidate.author && params.author) {
      candidate.author = this.toSafeText(params.author);
    }

    if (!Array.isArray(candidate.slides)) {
      if (typeof candidate.slides === 'string') {
        try {
          const parsed = JSON.parse(candidate.slides);
          candidate.slides = parsed;
        } catch {
          candidate.slides = [];
        }
      } else if (candidate.slides && typeof candidate.slides === 'object') {
        candidate.slides = Object.values(candidate.slides);
      } else {
        candidate.slides = [];
      }
    }

    if (candidate.slides.length === 0) {
      const papers = Array.isArray(params.papers)
        ? params.papers
        : Array.isArray(candidate.papers)
          ? candidate.papers
          : [];
      if (papers.length > 0) {
        candidate.slides = papers.slice(0, 12).map((paper: any, idx: number) => ({
          title:
            this.toSafeText(paper?.title || paper?.name || paper?.paperTitle) ||
            `Paper ${idx + 1}`,
          content: [
            this.toSafeText(paper?.summary || paper?.abstract || paper?.description) ||
              'Summary not provided.',
          ],
          bullets: Array.isArray(paper?.highlights)
            ? paper.highlights
            : Array.isArray(paper?.keyPoints)
              ? paper.keyPoints
              : [],
          source: this.toSafeText(paper?.url || paper?.link || paper?.arxivUrl),
        }));
      }
    }

    if (candidate.slides.length === 0 && Array.isArray(params.sections)) {
      candidate.slides = params.sections.slice(0, 12).map((section: any, idx: number) => ({
        title: this.toSafeText(section?.title) || `Section ${idx + 1}`,
        content: Array.isArray(section?.content)
          ? section.content.map((item: unknown) => this.toSafeText(item)).filter(Boolean)
          : [this.toSafeText(section?.content || section?.summary || section?.description) || ''],
        bullets: Array.isArray(section?.bullets)
          ? section.bullets.map((item: unknown) => this.toSafeText(item)).filter(Boolean)
          : [],
      }));
    }

    if (candidate.slides.length === 0 && this.toSafeText(params.content)) {
      candidate.slides = [
        {
          title: 'Overview',
          content: [this.toSafeText(params.content)],
        },
      ];
    }

    if (candidate.slides.length === 0) {
      candidate.slides = [
        {
          title: 'Executive Summary',
          content: [
            this.toSafeText(params.summary || params.description || params.prompt) ||
              'Summary prepared by Mark Agent based on the available research context.',
          ],
        },
      ];
    }

    if (Array.isArray(candidate.slides)) {
      candidate.slides = candidate.slides.map((slide: any, idx: number) => ({
        title: this.toSafeText(slide?.title) || `Slide ${idx + 1}`,
        content: Array.isArray(slide?.content)
          ? slide.content.map((item: unknown) => this.toSafeText(item)).filter(Boolean)
          : [this.toSafeText(slide?.content || slide?.summary || slide?.description) || ''],
        bullets: Array.isArray(slide?.bullets)
          ? slide.bullets.map((item: unknown) => this.toSafeText(item)).filter(Boolean)
          : [],
        notes: this.toSafeText(slide?.notes),
        keyInsight: this.toSafeText(slide?.keyInsight || slide?.insight),
        source: this.toSafeText(slide?.source || slide?.url || slide?.link),
      }));
    }

    return candidate as Presentation;
  }
}
