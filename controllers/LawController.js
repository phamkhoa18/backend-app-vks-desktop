import { loadLawJsonSync, getArticleFromJson, searchFromJson } from '../utils/lawJsonProvider.js';
import fs from 'fs';
import path from 'path';

export const getHealth = (req, res) => {
  const code = req.query.code || 'BLHS';
  const data = loadLawJsonSync(code);
  res.json({ ok: true, meta: data.meta || { generatedAt: null } });
};

export const search = (req, res) => {
  const q = req.query.q || '';
  const code = req.query.code || 'BLHS';
  const results = searchFromJson(q, code);
  res.json({ query: q, code, results });
};

export const getArticle = (req, res) => {
  const number = req.params.number;
  const code = req.query.code || 'BLHS';
  const article = getArticleFromJson(number, code);
  if (!article) {
    return res.status(404).json({ message: 'Article not found' });
  }
  res.json(article);
};

export const getJson = (req, res) => {
  try {
    const code = (req.query.code || 'BLHS').toString().toUpperCase();
    const filename = code === 'BLTTHS' ? 'law_BLTTHS.json' : 'law_BLHS.json';
    const filePath = path.join(process.cwd(), 'data', filename);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load law JSON', error: err.message });
  }
};


