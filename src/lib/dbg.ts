import debug from 'debug';
import isMobile from 'is-mobile';
import consolePanel from './utils/console-panel/console-panel.js'

import { parseUrlHash } from './utils/utils';

// @ts-ignore
export const DEV_MODE = process.env.NODE_ENV !== 'production';
export const DBG_MODE = DEV_MODE || parseUrlHash().dbg;

if (DBG_MODE) {
  debug.enable([
    'unamedNetwork:*',
    '-unamedNetwork:start',
    '-unamedNetwork:packet:*',
  ].join(','));

  if (isMobile()) {
    consolePanel.enable();
    debug.log = console.log; // after consolePanel has intercepted console.log
  }
}
