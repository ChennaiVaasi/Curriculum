export type TaxonomyRule={label:string;keywords:string[];weight:number};
export type PgnHeaders=Record<string,string>;
export type TaxonomyRow={source_file:string;game_index:number;event:string;white:string;black:string;result:string;eco:string;annotator:string;opening_family:string;opening_variation:string;opening_subvariation:string;phase:string;domain:string;primary_themes:string[];micro_tags:string[];structures:string[];material_tags:string[];confidence:number;headers?:PgnHeaders;raw_pgn_preview?:string};
export type ExportFormat='jsonl'|'csv';
