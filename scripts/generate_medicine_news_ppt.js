const path = require('path');
const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5
pptx.author = 'MarkAgent';
pptx.company = 'MarkAgent';
pptx.subject = 'Top 5 medicine news in the last 5 days';
pptx.title = 'Top 5 Medicine News (Feb 9-13, 2026)';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  lang: 'en-US',
};

const COLORS = {
  bgDark: '0F2A43',
  bgLight: 'F4F8FB',
  card: 'FFFFFF',
  primary: '065A82',
  secondary: '1C7293',
  accent: 'F0A202',
  textDark: '17324D',
  textMuted: '5C7288',
  white: 'FFFFFF',
};

const items = [
  {
    rank: 1,
    date: 'Feb 12, 2026',
    title: 'FDA approved Optune Lua for metastatic pancreatic cancer',
    impact: 'First FDA approval of a tumor-treating fields device for metastatic pancreatic adenocarcinoma with gemcitabine + nab-paclitaxel.',
    why: 'Potential new option in a high-mortality cancer with limited frontline choices.',
    source: 'FDA Press Announcement (Feb 12, 2026): https://www.fda.gov/news-events/press-announcements/fda-approves-optune-lua-metastatic-pancreatic-cancer',
    score: 95,
  },
  {
    rank: 2,
    date: 'Feb 12, 2026',
    title: 'FDA required menopause hormone therapy label updates',
    impact: 'Class labeling now removes boxed warnings and modifies warnings/precautions to align with current evidence.',
    why: 'Affects prescribing and risk communication for a widely used therapy class.',
    source: 'FDA Statement (Feb 12, 2026): https://www.fda.gov/drugs/news-events-human-drugs/fda-updates-labeling-menopause-hormone-therapies',
    score: 89,
  },
  {
    rank: 3,
    date: 'Feb 10, 2026',
    title: 'NIH halted one arm in a recurrent stroke prevention trial',
    impact: 'CAPTIVA trial stopped the low-dose rivaroxaban arm due to excess major bleeding and low probability of benefit.',
    why: 'Directly changes evidence trajectory for secondary stroke prevention strategies.',
    source: 'NIH News Release (Feb 10, 2026): https://www.nih.gov/news-events/news-releases/nih-clinical-trial-halts-test-treatment-arm-recurrent-stroke-prevention',
    score: 86,
  },
  {
    rank: 4,
    date: 'Feb 10, 2026',
    title: 'NIH-funded study linked cognitive speed training with lower dementia diagnoses',
    impact: 'Long-term follow-up reported 25% fewer dementia diagnoses over 20 years, with stronger effects among booster users.',
    why: 'Signals a scalable, non-drug prevention lever for aging populations.',
    source: 'NIH News Release (Feb 10, 2026): https://www.nih.gov/news-events/news-releases/cognitive-training-may-reduce-dementia-risk-older-adults',
    score: 82,
  },
  {
    rank: 5,
    date: 'Feb 10, 2026',
    title: 'NIH researchers built a retinal digital twin model for AMD',
    impact: 'A retinal pigment epithelium digital twin reproduced aging and disease-like AMD changes in vitro.',
    why: 'Could accelerate preclinical screening and mechanistic ophthalmology research.',
    source: 'NIH News Release (Feb 10, 2026): https://www.nih.gov/news-events/news-releases/nih-researchers-create-digital-twin-human-retina',
    score: 78,
  },
];

function addHeader(slide, title, subtitle, dark = false) {
  if (dark) {
    slide.background = { color: COLORS.bgDark };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 6.8,
      w: 13.3,
      h: 0.7,
      line: { color: COLORS.bgDark, transparency: 100 },
      fill: { color: COLORS.secondary, transparency: 30 },
    });
    slide.addText(title, {
      x: 0.75,
      y: 0.7,
      w: 11.8,
      h: 0.8,
      fontFace: 'Cambria',
      fontSize: 42,
      bold: true,
      color: COLORS.white,
      margin: 0,
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.75,
        y: 1.7,
        w: 11.2,
        h: 0.6,
        fontFace: 'Calibri',
        fontSize: 20,
        color: 'CFE5F1',
        margin: 0,
      });
    }
    return;
  }

  slide.background = { color: COLORS.bgLight };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.3,
    h: 0.9,
    line: { color: COLORS.primary, transparency: 100 },
    fill: { color: COLORS.primary },
  });
  slide.addText(title, {
    x: 0.55,
    y: 0.18,
    w: 9.8,
    h: 0.5,
    fontFace: 'Cambria',
    fontSize: 26,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.55,
      y: 0.98,
      w: 10.5,
      h: 0.4,
      fontFace: 'Calibri',
      fontSize: 13,
      color: COLORS.textMuted,
      margin: 0,
    });
  }
}

function addSourceFooter(slide, sourceText) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55,
    y: 6.75,
    w: 12.2,
    h: 0,
    line: { color: 'C8D7E2', width: 1 },
  });
  slide.addText(sourceText, {
    x: 0.55,
    y: 6.82,
    w: 12.2,
    h: 0.5,
    fontFace: 'Calibri',
    fontSize: 8.5,
    color: COLORS.textMuted,
    margin: 0,
    hyperlink: sourceText.includes('https://')
      ? { url: sourceText.slice(sourceText.indexOf('https://')) }
      : undefined,
  });
}

function addNewsSlide(item) {
  const slide = pptx.addSlide();
  addHeader(slide, `#${item.rank} Medicine News`, `${item.date} | Ranked by likely near-term clinical/system impact`);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.75,
    y: 1.55,
    w: 11.8,
    h: 4.75,
    rectRadius: 0.08,
    line: { color: 'D5E3ED', width: 1 },
    fill: { color: COLORS.card },
    shadow: { type: 'outer', color: '000000', blur: 2, offset: 1, angle: 45, opacity: 0.1 },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.75,
    y: 1.55,
    w: 0.28,
    h: 4.75,
    line: { color: COLORS.accent, transparency: 100 },
    fill: { color: COLORS.accent },
  });

  slide.addText(item.title, {
    x: 1.15,
    y: 1.9,
    w: 9.1,
    h: 0.9,
    fontFace: 'Cambria',
    fontSize: 25,
    bold: true,
    color: COLORS.textDark,
    margin: 0,
  });

  slide.addText('What happened', {
    x: 1.15,
    y: 2.95,
    w: 3.2,
    h: 0.35,
    fontFace: 'Calibri',
    fontSize: 14,
    bold: true,
    color: COLORS.primary,
    margin: 0,
  });
  slide.addText(item.impact, {
    x: 1.15,
    y: 3.28,
    w: 9.5,
    h: 1.1,
    fontFace: 'Calibri',
    fontSize: 15,
    color: COLORS.textDark,
    margin: 0,
  });

  slide.addText('Why it matters', {
    x: 1.15,
    y: 4.62,
    w: 3.0,
    h: 0.35,
    fontFace: 'Calibri',
    fontSize: 14,
    bold: true,
    color: COLORS.primary,
    margin: 0,
  });
  slide.addText(item.why, {
    x: 1.15,
    y: 4.95,
    w: 9.5,
    h: 0.95,
    fontFace: 'Calibri',
    fontSize: 15,
    color: COLORS.textDark,
    margin: 0,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 10.7,
    y: 2.35,
    w: 1.55,
    h: 1.55,
    rectRadius: 0.08,
    line: { color: COLORS.secondary, width: 1 },
    fill: { color: 'E8F2F8' },
  });
  slide.addText('Impact\nScore', {
    x: 10.92,
    y: 2.58,
    w: 1.1,
    h: 0.45,
    fontFace: 'Calibri',
    fontSize: 11,
    bold: true,
    align: 'center',
    color: COLORS.secondary,
    margin: 0,
  });
  slide.addText(String(item.score), {
    x: 10.86,
    y: 3.05,
    w: 1.2,
    h: 0.6,
    fontFace: 'Cambria',
    fontSize: 34,
    bold: true,
    align: 'center',
    color: COLORS.primary,
    margin: 0,
  });

  addSourceFooter(slide, item.source);
}

// Slide 1: Title
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Top 5 Medicine News', 'Released in the last 5 days (Feb 9-13, 2026, U.S. time)', true);

  slide.addText('A curated briefing focused on high clinical or system impact updates from FDA and NIH releases.', {
    x: 0.75,
    y: 2.75,
    w: 11.8,
    h: 0.9,
    fontFace: 'Calibri',
    fontSize: 23,
    color: 'E7F1F8',
    margin: 0,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.75,
    y: 4.15,
    w: 6.2,
    h: 1.65,
    rectRadius: 0.06,
    fill: { color: '123A5D', transparency: 8 },
    line: { color: '4F7FA3', width: 1 },
  });
  slide.addText('Window: Feb 9-13, 2026\nItems selected: 5\nRanking basis: likely near-term patient/system impact', {
    x: 1.0,
    y: 4.45,
    w: 5.7,
    h: 1.1,
    fontFace: 'Calibri',
    fontSize: 15,
    color: 'D9EAF5',
    margin: 0,
  });

  slide.addText('Prepared on Feb 13, 2026', {
    x: 0.75,
    y: 6.95,
    w: 4,
    h: 0.3,
    fontFace: 'Calibri',
    fontSize: 10,
    color: 'A9C8DD',
    margin: 0,
  });
}

// Slide 2: Ranking overview
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Ranking Overview', 'Top stories and relative impact score (0-100)');

  const startY = 1.8;
  const rowH = 0.86;
  items.forEach((item, idx) => {
    const y = startY + idx * rowH;
    const tone = idx % 2 === 0 ? 'EEF5FA' : 'FFFFFF';
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72,
      y,
      w: 11.1,
      h: 0.68,
      rectRadius: 0.03,
      line: { color: 'DDE8F0', width: 1 },
      fill: { color: tone },
    });
    slide.addText(`#${item.rank}`, {
      x: 0.95,
      y: y + 0.2,
      w: 0.5,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: COLORS.primary,
      margin: 0,
    });
    slide.addText(item.title, {
      x: 1.45,
      y: y + 0.15,
      w: 7.5,
      h: 0.4,
      fontSize: 11,
      bold: true,
      color: COLORS.textDark,
      margin: 0,
    });
    slide.addText(item.date, {
      x: 9.0,
      y: y + 0.2,
      w: 1.1,
      h: 0.3,
      fontSize: 11,
      color: COLORS.textMuted,
      margin: 0,
      align: 'right',
    });

    const barX = 10.2;
    const barW = 1.4;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: barX,
      y: y + 0.25,
      w: barW,
      h: 0.18,
      rectRadius: 0.05,
      line: { color: 'C9D9E6', transparency: 100 },
      fill: { color: 'DCE8F1' },
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: barX,
      y: y + 0.25,
      w: (barW * item.score) / 100,
      h: 0.18,
      rectRadius: 0.05,
      line: { color: COLORS.secondary, transparency: 100 },
      fill: { color: COLORS.secondary },
    });
    slide.addText(String(item.score), {
      x: 11.65,
      y: y + 0.13,
      w: 0.5,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: COLORS.primary,
      margin: 0,
      align: 'right',
    });
  });

  addSourceFooter(slide, 'Sources: FDA and NIH official releases published Feb 10-12, 2026. Full URLs shown on each story slide.');
}

items.forEach(addNewsSlide);

// Slide 8: Synthesis
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Cross-Cutting Signals', 'What these five items indicate for care delivery and R&D', true);

  const cards = [
    {
      title: 'Therapeutics',
      body: 'Regulatory movement is active in both oncology devices and menopause hormone therapy labeling.',
      x: 0.8,
    },
    {
      title: 'Evidence correction',
      body: 'Stroke prevention evidence is being refined quickly through trial-arm stopping for safety and futility.',
      x: 4.55,
    },
    {
      title: 'Prevention + models',
      body: 'Non-drug dementia prevention and retinal digital twins show parallel momentum in prevention and translational science.',
      x: 8.3,
    },
  ];

  cards.forEach((card) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: card.x,
      y: 1.8,
      w: 3.35,
      h: 3.9,
      rectRadius: 0.08,
      fill: { color: '123A5D', transparency: 8 },
      line: { color: '4D7597', width: 1 },
    });
    slide.addText(card.title, {
      x: card.x + 0.2,
      y: 2.15,
      w: 2.95,
      h: 0.55,
      fontFace: 'Cambria',
      fontSize: 21,
      bold: true,
      color: COLORS.white,
      margin: 0,
    });
    slide.addText(card.body, {
      x: card.x + 0.2,
      y: 2.9,
      w: 2.95,
      h: 2.45,
      fontFace: 'Calibri',
      fontSize: 14,
      color: 'DCEAF4',
      margin: 0,
    });
  });

  slide.addText('Suggested follow-up: monitor FDA label implementation timelines and CAPTIVA protocol updates in the next 30 days.', {
    x: 0.8,
    y: 6.2,
    w: 11.8,
    h: 0.5,
    fontFace: 'Calibri',
    fontSize: 14,
    bold: true,
    color: 'CBE0EF',
    margin: 0,
  });

  slide.addText('Source set frozen on Feb 13, 2026 (U.S. time).', {
    x: 0.8,
    y: 6.9,
    w: 6,
    h: 0.3,
    fontFace: 'Calibri',
    fontSize: 10,
    color: '9FC0D7',
    margin: 0,
  });
}

const outPath = path.join(process.cwd(), 'outputs', 'top-5-medicine-news-feb9-13-2026.pptx');
pptx
  .writeFile({ fileName: outPath })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outPath}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
