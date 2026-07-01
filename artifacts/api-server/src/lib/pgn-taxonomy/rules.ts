import type {TaxonomyRule} from './types.js';
export const DOMAIN_RULES:TaxonomyRule[]=[
{label:'Tactics',keywords:['tactic','tactics','combination','combinations','attack','mate','mating','sacrifice','sac','fork','pin','skewer','deflection','decoy','discovered attack','zwischenzug'],weight:3},
{label:'Strategy',keywords:['strategy','strategic','plan','planning','maneuver','manoeuvre','prophylaxis','weak square','outpost','space advantage','initiative','piece activity'],weight:2},
{label:'Opening',keywords:['opening','openings','repertoire','novelty','theory','gambit','variation','line','develop','development'],weight:2},
{label:'Endgame',keywords:['endgame','ending','endings','rook ending','pawn ending','study','studies','lucena','philidor','opposition','triangulation'],weight:3},
{label:'Calculation',keywords:['calculate','calculation','candidate move','candidate moves','forced line','forcing move','visualization','variation tree'],weight:2},
{label:'Defense',keywords:['defense','defence','defensive','defend','counterplay','fortress','blockade','hold the draw'],weight:2},
];
export const PRIMARY_THEME_RULES:TaxonomyRule[]=[
{label:'Mating net',keywords:['mate','checkmate','mating net','king hunt','back rank mate','smothered mate'],weight:4},
{label:'Sacrifice',keywords:['sacrifice','sacrifices','sac','exchange sacrifice','piece sacrifice','bishop sacrifice','rook sacrifice'],weight:3},
{label:'Fork',keywords:['fork','forks','double attack','knight fork'],weight:4},
{label:'Pin',keywords:['pin','pinned','absolute pin','relative pin'],weight:3},
{label:'Deflection',keywords:['deflection','deflect','decoy','overloaded'],weight:3},
{label:'Discovered attack',keywords:['discovered attack','discovered check','double check'],weight:3},
{label:'Passed pawn',keywords:['passed pawn','passed pawns','passer','outside passer','connected passed pawns'],weight:3},
{label:'King activity',keywords:['king activity','active king','king centralization','centralize the king'],weight:3},
{label:'Rook activity',keywords:['rook activity','active rook','rook behind','seventh rank','7th rank'],weight:3},
{label:'Opposition',keywords:['opposition','distant opposition','trébuchet','trebuchet','triangulation'],weight:4},
{label:'Lucena',keywords:['lucena','bridge building','build a bridge'],weight:5},
{label:'Philidor',keywords:['philidor','third rank defense','third rank defence'],weight:5},
{label:'Typical plan',keywords:['typical plan','standard plan','minority attack','pawn break','breakthrough','improve pieces'],weight:2},
];
export const MICRO_TAG_RULES:TaxonomyRule[]=[
{label:'Back rank',keywords:['back rank','back-rank'],weight:3},{label:'Zwischenzug',keywords:['zwischenzug','in between move','intermezzo'],weight:3},{label:'Clearance',keywords:['clearance','clear a square','clear the file'],weight:2},{label:'Overloading',keywords:['overload','overloaded','overloading'],weight:3},{label:'Outpost',keywords:['outpost','outposts'],weight:2},{label:'Weak squares',keywords:['weak square','weak squares','holes'],weight:2},{label:'Open file',keywords:['open file','half open file','file control'],weight:2},{label:'Pawn break',keywords:['pawn break','break with','breakthrough'],weight:2},{label:'King safety',keywords:['king safety','unsafe king','exposed king'],weight:2},{label:'Development',keywords:['development','develop your pieces','lead in development'],weight:2},{label:'Time trouble',keywords:['time trouble','zeitnot'],weight:1},{label:'Conversion',keywords:['conversion','convert','technical win'],weight:2}
];
export const STRUCTURE_RULES:TaxonomyRule[]=[
{label:'Isolated queen pawn',keywords:['isolated queen pawn','isolated pawn','iqp'],weight:3},{label:'Hanging pawns',keywords:['hanging pawns'],weight:3},{label:'Carlsbad structure',keywords:['carlsbad','minority attack'],weight:3},{label:'Passed pawn structure',keywords:['passed pawn','passed pawns','passer'],weight:2},{label:'Doubled pawns',keywords:['doubled pawns','doubled pawn'],weight:2},{label:'Backward pawn',keywords:['backward pawn','backward pawns'],weight:2},{label:'Pawn majority',keywords:['pawn majority','queenside majority','kingside majority'],weight:2},{label:'Locked center',keywords:['locked center','closed center','blocked center'],weight:2}
];
export const MATERIAL_RULES:TaxonomyRule[]=[
{label:'Rook endgame',keywords:['rook endgame','rook ending','rook endings','lucena','philidor'],weight:4},{label:'Queen endgame',keywords:['queen endgame','queen ending'],weight:3},{label:'Pawn endgame',keywords:['pawn endgame','pawn ending','king and pawn'],weight:4},{label:'Minor piece endgame',keywords:['minor piece endgame','bishop ending','knight ending','opposite colored bishops','opposite-coloured bishops'],weight:3},{label:'Exchange sacrifice',keywords:['exchange sacrifice','exchange sac'],weight:3},{label:'Opposite-colored bishops',keywords:['opposite colored bishops','opposite-coloured bishops'],weight:3},{label:'General endgame',keywords:['endgame','ending','study','studies'],weight:1}
];
