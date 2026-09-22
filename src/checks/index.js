// Every portable check, in the order they run.  Each registers its tests
// against ({ describe, it, expect }, content) and must not touch Node or the
// DOM, so it runs the same under `yarn test` and in the browser at /tests/.
import zones from './zones';
import interactions from './interactions';
import utils from './utils';
import buffers from './buffers';
import log from './log';
import map from './map';
import files from './files';
import game from './game';
import stats from './stats';
import text from './text';

export default [
  { name: 'Game files', register: files },
  { name: 'Game setup', register: game },
  { name: 'Stats', register: stats },
  { name: 'Map', register: map },
  { name: 'Zones', register: zones },
  { name: 'Object specs', register: interactions },
  { name: 'Buffers', register: buffers },
  { name: 'Log view', register: log },
  { name: 'Text view', register: text },
  { name: 'Utilities', register: utils },
];
