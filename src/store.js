const Store = require('electron-store');

const store = new Store({
  defaults: {
    icingaUrl: 'https://monitoring-dev.hostersi.systems',
    karmaUrl: 'https://karma.hostersi.systems',
    checkIntervalSec: 30,
    locallyDone: {},
    sessionCookies: '',
    karmaCookies: ''
  }
});

module.exports = store;
