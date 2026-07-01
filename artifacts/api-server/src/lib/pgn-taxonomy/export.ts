import type {ExportFormat,TaxonomyRow} from './types.js';
export const TAXONOMY_FIELDS=['source_file','game_index','event','white','black','result','eco','annotator','opening_family','opening_variation','opening_subvariation','phase','domain','primary_themes','micro_tags','structures','material_tags','confidence'] as const;
function csvCell(v:unknown){const s=Array.isArray(v)?v.join(' | '):String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
export function exportRows(rows:TaxonomyRow[],format:ExportFormat):string{if(format==='jsonl')return rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':'');return [TAXONOMY_FIELDS.join(','),...rows.map(r=>TAXONOMY_FIELDS.map(f=>csvCell((r as any)[f])).join(','))].join('\n')+'\n'}
