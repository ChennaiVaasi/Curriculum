import path from 'node:path';
import { normalizeText } from './parser.js';
import { inferDomain, inferMaterial, inferPhase, inferThemes } from './classifier.js';
import { inferOpeningFromText } from './pdf-opening-patterns.js';

export const SCANNED_WARNING = 'This appears to be a scanned/image PDF. OCR is required before reliable classification.';
export type PdfMetadata = { title: string; author: string; raw?: Record<string, unknown> };
export type PdfPage = { page: number; text: string };
export type PdfTaxonomyRow = { source_file:string; page?:number; title:string; author?:string; pages_examined?:number; extracted_chars?:number; opening_family:string|null; opening_variation:string|null; opening_subvariation:string|null; phase:string; domain:string; primary_themes:string[]; micro_tags:string[]; structures:string[]; material_tags:string[]; confidence:number; warnings?:string[]; metadata?:PdfMetadata; text_preview?:string };

// Words that are never player surnames — chess terms, common English, non-name words
const NON_PLAYER_WORDS = new Set([
  // Chess terms
  'pawn','rook','bishop','knight','queen','king','piece','pieces','move','moves',
  'rank','file','diagonal','side','check','mate','draw','plan','attack','defense',
  'defence','opening','endgame','ending','tactic','tactics','study','studies',
  'combination','combinations','sacrifice','fork','pin','skewer','gambit',
  // Book/chapter words
  'selected','games','game','star','chart','score','roller','bar','ring','line',
  'part','test','quiz','exam','book','page','chapter','example','examples',
  'exercises','solutions','analysis','questions','answers','problems','positions',
  'classics','classic',
  // Common English (including titles/chapters)
  'the','a','an','in','on','at','by','for','of','and','or','but','not','no','to',
  'one','two','three','four','five','six','seven','eight','nine','ten','all','any',
  'new','old','big','men','man','war','sir','son','see','red','his','art','way',
  'key','saw','tower','irresistible','brilliant','magnificent',
  'you','know','they','them','your','her','him','this','that','with','from',
  'have','has','are','was','were','will','can','could','should','would',
  'how','when','where','why','what','who','which','do','does','did',
]);

// A player surname: starts uppercase, 3-18 chars total, only letters/hyphen/apostrophe
const NAME_PAT = '[A-Z][a-zA-Z\']{2,17}';
const reName = new RegExp(NAME_PAT);

/**
 * Detect game-collection chapter titles like:
 *   "148 Botvinnik-Boleslavsky, 1945"
 *   "Game 5 Capablanca-Reti, New York, 1913"
 *   "Botvinnik Smyslov 1957"
 *   "Game 1 - Carlsen-Karjakin"
 * Returns [player1, player2] surnames, or null if not a game reference.
 */
/**
 * Apply title-based classification overrides (game collection, classics, ending).
 * Returns { primaryThemes, microTags } to apply, or null if no override applies.
 * Priority: Game collection > Classics > Ending.
 */
export function computeTitleOverrides(
  title: string,
  currentMicroTags: string[],
): { primaryThemes: string[]; microTags: string[] } | null {
  // ── 1. Game collection ────────────────────────────────────────────────────
  const players = extractGamePlayers(title);
  if (players) {
    const others = currentMicroTags.filter(t => !players.includes(t));
    return { primaryThemes: ['Game collection'], microTags: [...players, ...others] };
  }

  // ── 2. Classics ───────────────────────────────────────────────────────────
  if (/\bclassics?\b/i.test(title)) {
    const tags: string[] = [];
    // Years (e.g. "1972")
    const years = title.match(/\b(1[89]\d{2}|20[012]\d)\b/g) ?? [];
    tags.push(...years);
    // Proper names ≥5 chars, not blacklisted
    const names = title.match(/[A-Z][a-zA-Z']{4,17}/g) ?? [];
    for (const n of names) {
      if (!NON_PLAYER_WORDS.has(n.toLowerCase()) && !tags.includes(n)) tags.push(n);
    }
    const others = currentMicroTags.filter(t => !tags.includes(t));
    return { primaryThemes: ['Classics'], microTags: [...tags, ...others] };
  }

  // ── 3. Ending ─────────────────────────────────────────────────────────────
  if (/\bending\b/i.test(title)) {
    const stripped = title
      .replace(/^chapter\s+\d+\s*[-–:]\s*/i, '')
      .replace(/^\d+\s+/, '')
      .trim();
    const tags = stripped && !currentMicroTags.includes(stripped) ? [stripped] : [];
    const others = currentMicroTags.filter(t => !tags.includes(t));
    return { primaryThemes: ['Ending'], microTags: [...tags, ...others] };
  }

  return null;
}

export function extractGamePlayers(title: string): string[] | null {
  try {
    const hasYear = /\b(1[89]\d{2}|20[012]\d)\b/.test(title);
    const hasGamePrefix = /^game\s+\d+/i.test(title.trim());
    const hasNumPrefix = /^\d{1,3}\s/.test(title.trim());

    if (!hasYear && !hasGamePrefix && !hasNumPrefix) return null;

    // Strip prefixes to get to the name part
    const s = title.trim()
      .replace(/^game\s+\d+\s*[-–]?\s*/i, '')  // "Game N -"
      .replace(/^\d+\s+/, '');                   // "NNN "

    // Reject immediately if first word is a chess/common word
    const firstWord = s.split(/[\s\-–]/)[0].toLowerCase();
    if (NON_PLAYER_WORDS.has(firstWord) || firstWord.length < 3) return null;

    if (hasYear) {
      // Pattern A: "Name-Name[, City,] Year"
      const mHyphen = s.match(
        new RegExp(`^(${NAME_PAT})\\s*[-–]\\s*(${NAME_PAT})`)
      );
      if (mHyphen) {
        const p1 = mHyphen[1];
        const p2 = mHyphen[2]
          .replace(/[,\s]*(1[89]\d{2}|20[012]\d).*$/, '')
          .replace(/,.*$/, '')
          .trim();
        if (p2 && p1 !== p2 &&
            !NON_PLAYER_WORDS.has(p1.toLowerCase()) &&
            !NON_PLAYER_WORDS.has(p2.toLowerCase())) {
          return [p1, p2];
        }
      }
      // Pattern B: "Name Name Year"
      const mSpace = s.match(
        new RegExp(`^(${NAME_PAT})\\s+(${NAME_PAT})\\s+(1[89]\\d{2}|20[012]\\d)`)
      );
      if (mSpace &&
          !NON_PLAYER_WORDS.has(mSpace[1].toLowerCase()) &&
          !NON_PLAYER_WORDS.has(mSpace[2].toLowerCase())) {
        return [mSpace[1], mSpace[2]];
      }
    } else {
      // No year: the ENTIRE remaining string must be exactly "Name-Name" (nothing else)
      const mStrict = s.match(
        new RegExp(`^(${NAME_PAT})\\s*[-–]\\s*(${NAME_PAT})\\s*$`)
      );
      if (mStrict &&
          !NON_PLAYER_WORDS.has(mStrict[1].toLowerCase()) &&
          !NON_PLAYER_WORDS.has(mStrict[2].toLowerCase())) {
        return [mStrict[1], mStrict[2]];
      }
    }
  } catch { /* never fail classification */ }
  return null;
}

export function inferTitle(filePath:string, metadata:Partial<PdfMetadata>, normalizedText:string):string{
  if(metadata.title?.trim()) return metadata.title.trim();
  const first=normalizedText.split(/\n+/).map(s=>s.trim()).find(s=>s.length>3&&s.length<120);
  return first || path.basename(filePath, path.extname(filePath));
}
export function confidenceScore(hasMetadata:boolean, hasOpening:boolean, primary:string[], micro:string[], chars:number):number{let x=0.2;if(hasMetadata)x+=0.1;if(hasOpening)x+=0.15;x+=Math.min(0.25,primary.length*0.06);x+=Math.min(0.1,micro.length*0.02);if(chars>3000)x+=0.1;else if(chars>500)x+=0.05;return Math.round(Math.min(0.95,x)*100)/100;}
function pageConfidence(chars:number){return Math.round(Math.min(0.85,0.25+(0.02*chars)/100)*100)/100;}
function classifyText(source:string,title:string,author:string,metadata:PdfMetadata,text:string,page?:number):PdfTaxonomyRow{
  const pathText=normalizeText(source); const normalized=normalizeText([source,title,author,text].join(' ')); const opening=inferOpeningFromText(normalized);
  const phase=inferPhase(pathText,normalized); const domain=inferDomain(pathText,normalized,phase); const th=inferThemes(pathText,normalized,phase,domain);
  if(!th.primary_themes.length) th.primary_themes = page !== undefined ? (domain==='Tactics'?['Mating net']:['Typical plan']) : (domain==='Endgame'?['King activity']:domain==='Tactics'?['Mating net']:['Typical plan']);
  const material_tags=inferMaterial(pathText+' '+normalized,undefined,phase); const chars=text.length;
  const row:PdfTaxonomyRow = {source_file:source,page,title,author,opening_family:opening.family,opening_variation:opening.variation,opening_subvariation:opening.subvariation,phase,domain,...th,material_tags,confidence:page!==undefined?pageConfidence(chars):confidenceScore(Boolean(metadata.title||metadata.author||metadata.raw),Boolean(opening.family),th.primary_themes,th.micro_tags,chars),text_preview:text.slice(0,1200),metadata};

  // ── Title-based overrides (game collection / classics / ending) ───────────
  const override = computeTitleOverrides(title, row.micro_tags);
  if (override) {
    row.primary_themes = override.primaryThemes;
    row.micro_tags = override.microTags;
  }

  return row;
}
export function classifyDocumentFromExtracted(source:string,metadata:PdfMetadata,pages:PdfPage[]):{rows:PdfTaxonomyRow[];warnings:string[];summary:Record<string,unknown>}{
  const text=pages.map(p=>p.text).join('\n\n'); const title=inferTitle(source,metadata,text); const warnings:string[]=[]; if(!text.trim()) warnings.push(SCANNED_WARNING); else if(text.length<500) warnings.push('Less than 500 extracted characters; classification confidence may be limited.');
  const row=classifyText(source,title,metadata.author||'',metadata,text); row.pages_examined=pages.length; row.extracted_chars=text.length; row.warnings=warnings;
  return {rows:[row],warnings,summary:summarizeRows([row],warnings)};
}
export function classifyPerPageFromExtracted(source:string,metadata:PdfMetadata,pages:PdfPage[]):{rows:PdfTaxonomyRow[];warnings:string[];summary:Record<string,unknown>}{
  const joined=pages.map(p=>p.text).join('\n'); const title=inferTitle(source,metadata,joined); const warnings:string[]=[]; if(!joined.trim()) warnings.push(SCANNED_WARNING);
  const rows=pages.map(p=>{const r=classifyText(source,title,metadata.author||'',metadata,p.text,p.page); r.warnings=p.text.trim()?[]:[SCANNED_WARNING]; return r;});
  return {rows,warnings,summary:summarizeRows(rows,warnings)};
}
export function summarizeRows(rows:PdfTaxonomyRow[],warnings:string[]=[]){const avg=rows.length?Math.round(rows.reduce((s,r)=>s+r.confidence,0)/rows.length*100)/100:0;return {pdfs_classified:new Set(rows.map(r=>r.source_file)).size,pages_examined:rows.reduce((s,r)=>s+(r.pages_examined||0),0)||rows.length,total_extracted_characters:rows.reduce((s,r)=>s+(r.extracted_chars||0),0),main_domains:[...new Set(rows.map(r=>r.domain))],main_phases:[...new Set(rows.map(r=>r.phase))],average_confidence:avg,warnings};}
