import Papa from 'papaparse';
import type { CSVRow } from '../types';

export interface ParseResult {
  rows: CSVRow[];
  errors: string[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];

        if (results.errors.length > 0) {
          errors.push(...results.errors.map((e) => e.message));
        }

        const headers = results.meta.fields?.map(normalizeHeader) ?? [];

        // Auto-detect columns
        const japaneseCol = headers.find(
          (h) => h === 'japanese' || h === 'kanji'
        );
        const englishCol = headers.find(
          (h) => h === 'english' || h === 'meaning' || h === 'translation'
        );
        const readingCol = headers.find(
          (h) =>
            h === 'reading' ||
            h === 'romaji' ||
            h === 'hiragana' ||
            h === 'furigana'
        );

        if (!japaneseCol) {
          errors.push(
            'Missing "japanese" or "kanji" column. Expected columns: japanese/kanji, english, reading/romaji (optional)'
          );
        }
        if (!englishCol) {
          errors.push(
            'Missing "english" column. Expected columns: japanese/kanji, english, reading/romaji (optional)'
          );
        }

        if (errors.length > 0) {
          resolve({ rows: [], errors });
          return;
        }

        // Map back to original header casing
        const originalHeaders = results.meta.fields ?? [];
        const japaneseOriginal =
          originalHeaders[headers.indexOf(japaneseCol!)];
        const englishOriginal = originalHeaders[headers.indexOf(englishCol!)];
        const readingOriginal = readingCol
          ? originalHeaders[headers.indexOf(readingCol)]
          : undefined;

        const rows: CSVRow[] = (results.data as Record<string, string>[])
          .filter((row) => {
            const jap = (row[japaneseOriginal] ?? '').trim();
            const eng = (row[englishOriginal] ?? '').trim();
            return jap && eng;
          })
          .map((row) => ({
            japanese: (row[japaneseOriginal] ?? '').trim(),
            english: (row[englishOriginal] ?? '').trim(),
            reading: readingOriginal
              ? (row[readingOriginal] ?? '').trim() || undefined
              : undefined,
          }));

        resolve({ rows, errors: [] });
      },
      error: (err) => {
        reject(new Error(`Failed to parse CSV: ${err.message}`));
      },
    });
  });
}