import fs from 'fs';
import path from 'path';

// In-memory caches per source file
const lawCaches = new Map(); // filename -> { parts, meta }
const articleIndexes = new Map(); // filename -> Map(number, article)
const flatArticlesMap = new Map(); // filename -> flatArticles array

function normalizeLine(line) {
  return line.replace(/\s+$/g, '');
}

function isPartHeader(line) {
  // Example: "Phần thứ nhất. NHỮNG QUY ĐỊNH CHUNG"
  return /^Phần\s+/i.test(line);
}

function isChapterHeader(line) {
  // Example: "Chương I. ĐIỀU KHOẢN CƠ BẢN"
  return /^Chương\s+/i.test(line);
}

function isArticleHeader(line) {
  // Example: "Điều 321. Tội đánh bạc"
  return /^Điều\s+\d+\./i.test(line);
}

function extractArticleHeader(line) {
  const m = /^Điều\s+(\d+)\.\s*(.*)$/i.exec(line);
  if (!m) return null;
  return { number: parseInt(m[1], 10), title: m[2] || '' };
}

function isClauseHeader(line) {
  // "1. ...", "2. ..." at line start
  return /^\d+\.\s/.test(line.trim());
}

function extractClauseIndex(line) {
  const m = /^(\d+)\.\s*(.*)$/.exec(line.trim());
  if (!m) return null;
  return { index: parseInt(m[1], 10), text: m[2] || '' };
}

function isPointHeader(line) {
  // Vietnamese points: a), b), c), d), đ), e), g), h)...
  return /^[a-zA-ZđĐ]\)\s/.test(line.trim());
}

function extractPointLetter(line) {
  const m = /^([a-zA-ZđĐ])\)\s*(.*)$/.exec(line.trim());
  if (!m) return null;
  return { letter: m[1].toLowerCase(), text: m[2] || '' };
}

function pushOrAppend(targetArray, text) {
  if (targetArray.length === 0) {
    targetArray.push(text);
  } else {
    // append to last paragraph
    targetArray[targetArray.length - 1] += (text ? ' ' + text : '');
  }
}

function parseLawFileSync(sourceFilename) {
  const existing = lawCaches.get(sourceFilename);
  if (existing) return existing;
  const articleIndex = new Map();
  // Expect to run with CWD at backend-app; read from ./data
  const filePath = path.join(process.cwd(), 'data', sourceFilename);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map(normalizeLine);

  const parts = [];
  let currentPart = null;
  let currentChapter = null;
  let currentArticle = null;
  let currentClause = null;
  let currentPoint = null;

  const finalizePoint = () => {
    if (currentPoint) {
      currentPoint.text = (currentPoint.text || '').trim();
      if (currentClause) {
        currentClause.points.push(currentPoint);
      }
      currentPoint = null;
    }
  };

  const finalizeClause = () => {
    finalizePoint();
    if (currentClause) {
      currentClause.text = (currentClause.text || '').trim();
      if (currentArticle) {
        currentArticle.clauses.push(currentClause);
      }
      currentClause = null;
    }
  };

  const finalizeArticle = () => {
    finalizeClause();
    if (currentArticle) {
      currentArticle.preamble = (currentArticle.preamble || '').trim();
      if (currentChapter) {
        currentChapter.articles.push(currentArticle);
      }
      articleIndex.set(currentArticle.number, currentArticle);
      currentArticle = null;
    }
  };

  const finalizeChapter = () => {
    finalizeArticle();
    if (currentChapter) {
      if (currentPart) {
        currentPart.chapters.push(currentChapter);
      } else {
        // chapters at root if no part defined
        parts.push({
          name: 'Khác',
          chapters: [currentChapter],
        });
      }
      currentChapter = null;
    }
  };

  const finalizePart = () => {
    finalizeChapter();
    if (currentPart) {
      parts.push(currentPart);
      currentPart = null;
    }
  };

  for (const lineRaw of lines) {
    const line = lineRaw;
    if (!line) continue;

    if (isPartHeader(line)) {
      finalizePart();
      currentPart = {
        name: line.trim(),
        chapters: [],
      };
      continue;
    }

    if (isChapterHeader(line)) {
      finalizeChapter();
      currentChapter = {
        name: line.trim(),
        articles: [],
      };
      continue;
    }

    if (isArticleHeader(line)) {
      finalizeArticle();
      const h = extractArticleHeader(line);
      currentArticle = {
        number: h.number,
        title: h.title,
        preamble: '',
        clauses: [],
      };
      continue;
    }

    // Within article content
    if (currentArticle) {
      if (isClauseHeader(line)) {
        finalizeClause();
        const c = extractClauseIndex(line);
        currentClause = {
          index: c.index,
          text: c.text || '',
          points: [],
        };
        continue;
      }
      if (currentClause && isPointHeader(line)) {
        finalizePoint();
        const p = extractPointLetter(line);
        currentPoint = {
          letter: p.letter,
          text: p.text || '',
        };
        continue;
      }

      // Accumulate text
      const trimmed = line.trim();
      if (currentPoint) {
        currentPoint.text = (currentPoint.text ? currentPoint.text + ' ' : '') + trimmed;
      } else if (currentClause) {
        currentClause.text = (currentClause.text ? currentClause.text + ' ' : '') + trimmed;
      } else {
        currentArticle.preamble = (currentArticle.preamble ? currentArticle.preamble + ' ' : '') + trimmed;
      }
      continue;
    }
  }

  // Finalize trailing structures
  finalizePart();
  const lawCache = {
    parts,
    meta: {
      totalArticles: articleIndex.size,
      generatedAt: new Date().toISOString(),
    },
  };
  lawCaches.set(sourceFilename, lawCache);
  articleIndexes.set(sourceFilename, articleIndex);
  flatArticlesMap.set(sourceFilename, Array.from(articleIndex.values()).sort((a, b) => a.number - b.number));
  return lawCache;
}

export function exportLawBLHSJson(outputPath) {
  const source = 'law_BLHS.txt';
  const lawCache = parseLawFileSync(source);
  const flatArticles = flatArticlesMap.get(source) || [];
  const out = {
    meta: lawCache.meta,
    parts: lawCache.parts,
    articles: flatArticles,
  };
  const filePath = outputPath || path.join(process.cwd(), 'data', 'law_BLHS.json');
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
  return filePath;
}

export function exportLawBLTTHSJson(outputPath) {
  const source = 'law_BLTTHS.txt';
  const lawCache = parseLawFileSync(source);
  const flatArticles = flatArticlesMap.get(source) || [];
  const out = {
    meta: lawCache.meta,
    parts: lawCache.parts,
    articles: flatArticles,
  };
  const filePath = outputPath || path.join(process.cwd(), 'data', 'law_BLTTHS.json');
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
  return filePath;
}


