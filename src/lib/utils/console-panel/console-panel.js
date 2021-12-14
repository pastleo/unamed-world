let consolePanel = {
  /**
   * https://github.com/webextensions/console-panel#consolepanelenableconfig
   */
  enable: (config = {}) => null,
  disable: () => null,
}

if (typeof window !== 'undefined') {
  require('console-panel/src/console-panel.css');
  require('console-panel');
  consolePanel = window.consolePanel;
}

module.exports = consolePanel;
