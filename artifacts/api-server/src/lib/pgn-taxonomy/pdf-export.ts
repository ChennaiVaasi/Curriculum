const arrayFields = new Set(['primary_themes','micro_tags','structures','material_tags']);
const csvEscape=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;
export function exportPdfRows(rows:Record<string,unknown>[],format:'jsonl'|'csv'){
 if(format==='jsonl') return rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':'');
 const fields=[...new Set(rows.flatMap(r=>Object.keys(r)))].sort();
 const lines=[fields.map(csvEscape).join(',')];
 for(const r of rows) lines.push(fields.map(f=>csvEscape(arrayFields.has(f)&&Array.isArray(r[f])?(r[f] as unknown[]).join(' | '):r[f])).join(','));
 return lines.join('\n')+'\n';
}
