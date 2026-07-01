import { normalizeText } from './parser.js';

export type OpeningPattern = { family: string; variation: string; subvariation: string; keywords: string[] };
export type OpeningInference = { family: string | null; variation: string | null; subvariation: string | null; keywords: string[] };

export const OPENING_PATTERNS: OpeningPattern[] = [
  { family: 'Sicilian Defense', variation: 'Najdorf Variation', subvariation: 'English Attack', keywords: ['sicilian', 'najdorf', 'english attack'] },
  { family: 'Sicilian Defense', variation: 'Dragon Variation', subvariation: 'Yugoslav Attack', keywords: ['sicilian', 'dragon', 'yugoslav attack'] },
  { family: 'Sicilian Defense', variation: 'Dragon Variation', subvariation: '', keywords: ['sicilian dragon'] },
  { family: 'Sicilian Defense', variation: 'Scheveningen Variation', subvariation: '', keywords: ['scheveningen'] },
  { family: 'Sicilian Defense', variation: 'Sveshnikov Variation', subvariation: 'Chelyabinsk', keywords: ['sveshnikov', 'chelyabinsk'] },
  { family: 'Sicilian Defense', variation: 'Taimanov Variation', subvariation: '', keywords: ['taimanov'] },
  { family: 'Sicilian Defense', variation: 'Kan Variation', subvariation: 'Paulsen', keywords: ['kan', 'paulsen'] },
  { family: 'Sicilian Defense', variation: 'Accelerated Dragon', subvariation: '', keywords: ['accelerated dragon'] },
  { family: 'Sicilian Defense', variation: 'Rossolimo Variation', subvariation: '', keywords: ['rossolimo'] },
  { family: 'Sicilian Defense', variation: 'Alapin Variation', subvariation: '', keywords: ['alapin'] },
  { family: 'French Defense', variation: 'Winawer Variation', subvariation: '', keywords: ['french', 'winawer'] },
  { family: 'French Defense', variation: 'Tarrasch Variation', subvariation: '', keywords: ['french', 'tarrasch'] },
  { family: 'French Defense', variation: 'Advance Variation', subvariation: '', keywords: ['french', 'advance'] },
  { family: 'French Defense', variation: 'Classical Variation', subvariation: '', keywords: ['french', 'classical'] },
  { family: 'French Defense', variation: 'Rubinstein Variation', subvariation: '', keywords: ['french', 'rubinstein'] },
  { family: 'Caro-Kann Defense', variation: 'Advance Variation', subvariation: 'Short System', keywords: ['caro-kann', 'advance', 'short system'] },
  { family: 'Caro-Kann Defense', variation: 'Panov-Botvinnik Attack', subvariation: '', keywords: ['caro-kann', 'panov'] },
  { family: 'Caro-Kann Defense', variation: 'Classical Variation', subvariation: '', keywords: ['classical caro-kann'] },
  { family: "Queen's Gambit Declined", variation: 'Exchange Variation', subvariation: 'Carlsbad', keywords: ['queen’s gambit declined', 'exchange', 'carlsbad'] },
  { family: "Queen's Gambit Declined", variation: 'Tartakower Variation', subvariation: '', keywords: ['qgd', 'tartakower'] },
  { family: "Queen's Gambit Declined", variation: 'Lasker Variation', subvariation: '', keywords: ['qgd', 'lasker'] },
  { family: "Queen's Gambit Accepted", variation: '', subvariation: '', keywords: ['queen’s gambit accepted'] },
  { family: 'Semi-Slav Defense', variation: '', subvariation: '', keywords: ['semi-slav'] },
  { family: 'Slav Defense', variation: '', subvariation: '', keywords: ['slav defense'] },
  { family: "King's Indian Defense", variation: 'Classical Variation', subvariation: 'Mar del Plata', keywords: ['king’s indian', 'classical', 'mar del plata'] },
  { family: "King's Indian Defense", variation: 'Fianchetto Variation', subvariation: '', keywords: ['king’s indian', 'fianchetto'] },
  { family: "King's Indian Defense", variation: 'Samisch Variation', subvariation: 'Saemisch', keywords: ['king’s indian', 'samisch', 'saemisch'] },
  { family: 'Grunfeld Defense', variation: '', subvariation: '', keywords: ['grunfeld'] },
  { family: 'Nimzo-Indian Defense', variation: 'Rubinstein Variation', subvariation: '', keywords: ['nimzo', 'rubinstein'] },
  { family: 'Nimzo-Indian Defense', variation: '', subvariation: '', keywords: ['nimzo-indian'] },
  { family: "Queen's Indian Defense", variation: '', subvariation: '', keywords: ['queen’s indian'] },
  { family: 'Catalan Opening', variation: '', subvariation: '', keywords: ['catalan'] },
  { family: 'Ruy Lopez', variation: 'Chigorin Variation', subvariation: '', keywords: ['ruy lopez', 'chigorin'] },
  { family: 'Ruy Lopez', variation: 'Breyer Variation', subvariation: '', keywords: ['ruy lopez', 'breyer'] },
  { family: 'Ruy Lopez', variation: 'Zaitsev Variation', subvariation: '', keywords: ['ruy lopez', 'zaitsev'] },
  { family: 'Italian Game', variation: 'Giuoco Piano', subvariation: '', keywords: ['italian game', 'giuoco piano'] },
  { family: 'Petroff Defense', variation: 'Russian Game', subvariation: '', keywords: ['petroff', 'russian game'] },
  { family: 'Scotch Game', variation: '', subvariation: '', keywords: ['scotch game'] },
  { family: 'English Opening', variation: '', subvariation: '', keywords: ['english opening'] },
  { family: 'Reti Opening', variation: '', subvariation: '', keywords: ['reti opening'] },
  { family: 'Pirc Defense', variation: '', subvariation: '', keywords: ['pirc defense'] },
  { family: 'Modern Defense', variation: '', subvariation: '', keywords: ['modern defense'] },
  { family: 'Alekhine Defense', variation: '', subvariation: '', keywords: ['alekhine defense'] },
  { family: 'Scandinavian Defense', variation: 'Center Counter', subvariation: '', keywords: ['scandinavian', 'center counter'] },
  { family: 'Dutch Defense', variation: 'Stonewall Variation', subvariation: '', keywords: ['dutch', 'stonewall'] },
  { family: 'Dutch Defense', variation: 'Leningrad Variation', subvariation: '', keywords: ['dutch', 'leningrad'] },
  { family: 'Benoni Defense', variation: '', subvariation: '', keywords: ['benoni'] },
  { family: 'Benko Gambit', variation: '', subvariation: '', keywords: ['benko gambit'] },
];

const empty: OpeningInference = { family: null, variation: null, subvariation: null, keywords: [] };
const hit = (p: OpeningPattern): OpeningInference => ({ family: p.family, variation: p.variation || null, subvariation: p.subvariation || null, keywords: p.keywords });
export function inferOpeningFromText(text: string): OpeningInference {
  const n = normalizeText(text).replace(/[’]/g, "'");
  const norm = (k: string) => normalizeText(k).replace(/[’]/g, "'");
  for (const p of OPENING_PATTERNS) if (p.keywords.every((k) => n.includes(norm(k)))) return hit(p);
  for (const p of OPENING_PATTERNS) if (p.keywords.some((k) => n.includes(norm(k)))) return hit(p);
  return empty;
}
