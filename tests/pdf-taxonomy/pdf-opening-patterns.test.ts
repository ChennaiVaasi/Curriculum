import assert from 'node:assert/strict';
import { inferOpeningFromText } from '../../artifacts/api-server/src/lib/pgn-taxonomy/pdf-opening-patterns';
assert.equal(inferOpeningFromText('Sicilian Najdorf English Attack repertoire').variation,'Najdorf Variation');
assert.equal(inferOpeningFromText('Sicilian Dragon plans').variation,'Dragon Variation');
assert.equal(inferOpeningFromText('Queen’s Gambit Declined Exchange Carlsbad minority attack').subvariation,'Carlsbad');
assert.equal(inferOpeningFromText('King’s Indian Classical Mar del Plata attack').subvariation,'Mar del Plata');
assert.equal(inferOpeningFromText('Ruy Lopez Breyer maneuvers').variation,'Breyer Variation');
assert.equal(inferOpeningFromText('random chess lesson').family,null);
