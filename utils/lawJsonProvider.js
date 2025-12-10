import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Per-code caches: code -> data
const caches = new Map(); // code -> full JSON
const articleMaps = new Map(); // code -> Map(number -> article)
const searchables = new Map(); // code -> array of {number, titleNorm, preambleNorm}

function resolveDataPath(filename) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', 'data', filename);
}

function getFileNameForCode(code) {
  const upper = String(code || 'BLHS').toUpperCase();
  if (upper === 'BLTTHS') return 'law_BLTTHS.json';
  return 'law_BLHS.json';
}

export function loadLawJsonSync(code = 'BLHS') {
  const upper = String(code || 'BLHS').toUpperCase();
  if (caches.has(upper) && articleMaps.has(upper) && searchables.has(upper)) {
    return caches.get(upper);
  }
  const filePath = resolveDataPath(getFileNameForCode(upper));
  const raw = fs.readFileSync(filePath, 'utf8');
  const cache = JSON.parse(raw);
  // Build article map from prebuilt flat list if present, otherwise traverse parts
  const articleMap = new Map();
  const articles = [];
  if (Array.isArray(cache.articles) && cache.articles.length > 0) {
    for (const a of cache.articles) {
      articleMap.set(Number(a.number), a);
      articles.push(a);
    }
  } else if (Array.isArray(cache.parts)) {
    for (const p of cache.parts) {
      for (const c of (p.chapters || [])) {
        for (const a of (c.articles || [])) {
          articleMap.set(Number(a.number), a);
          articles.push(a);
        }
      }
    }
  }
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const searchable = articles.map((a) => ({
    number: Number(a.number),
    title: a.title || '',
    titleNorm: normalize(a.title),
    preambleNorm: normalize(a.preamble),
  }));
  caches.set(upper, cache);
  articleMaps.set(upper, articleMap);
  searchables.set(upper, searchable);
  return cache;
}

export function getArticleFromJson(number, code = 'BLHS') {
  const upper = String(code || 'BLHS').toUpperCase();
  loadLawJsonSync(upper);
  const articleMap = articleMaps.get(upper);
  return articleMap?.get(Number(number)) || null;
}

export function searchFromJson(query, code = 'BLHS') {
  const upper = String(code || 'BLHS').toUpperCase();
  loadLawJsonSync(upper);
  const searchable = searchables.get(upper) || [];
  const articleMap = articleMaps.get(upper) || new Map();
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Parse patterns like "321", "321.1", "321.1.a" and "dieu 321", "dieu 321 1 a"
  const pattern = /^(\d+)(?:[.\s]+(\d+))?(?:[.\s]+([a-zA-ZđĐ]))?$/;
  const dieuPattern = /(?:^|\s)dieu\s+(\d+)(?:\s+(\d+))?(?:\s+([a-zA-ZđĐ]))?\b/;
  let m = pattern.exec(raw);
  if (!m) {
    const m2 = dieuPattern.exec(normalize(raw));
    if (m2) {
      // Recreate a match-like array with original values
      m = [m2[0], m2[1], m2[2], m2[3]];
    }
  }
  let patternMatch = null;
  if (m) {
    patternMatch = {
      number: Number(m[1]),
      clauseIndex: m[2] ? Number(m[2]) : undefined,
      pointLetter: m[3] ? m[3].toLowerCase() : undefined,
    };
  }

  const qNorm = normalize(raw);
  const tokens = qNorm.split(' ').filter(Boolean);

  const scored = [];
  for (const item of searchable) {
    let score = 0;
    const title = item.titleNorm;
    const pre = item.preambleNorm;
    // number exact or prefix
    if (patternMatch && item.number === patternMatch.number) {
      score += 1200; // stronger boost for explicit "dieu N" or pattern
    } else if (/^\d+$/.test(qNorm)) {
      const qNum = Number(qNorm);
      if (item.number === qNum) score += 900;
      else if (String(item.number).startsWith(qNorm)) score += 500;
    }
    // title contains tokens
    for (const t of tokens) {
      if (!t) continue;
      if (title.includes(t)) score += 50;
      else if (pre.includes(t)) score += 10;
    }
    // full phrase bonus
    if (qNorm && title.includes(qNorm)) score += 100;
    if (score > 0) {
      const art = articleMap.get(item.number);
      scored.push({
        number: item.number,
        title: art.title,
        snippet: (art.preamble || '').slice(0, 160),
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.number - b.number);
  return scored.slice(0, 20);
}


