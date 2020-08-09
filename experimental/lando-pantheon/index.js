'use strict';

const _ = require('lodash');
const PantheonApi = require('./lib/api');

module.exports = lando => {
  // Add additional things to cleanse
  lando.log.alsoSanitize('pantheon-auth');

  // Attempt to remove a revoked or bad app token so the user is prompted
  _.forEach(['pull', 'push', 'switch'], command => {
    lando.events.on(`cli-${command}-answers`, data => {
      if (_.get(data, 'options._app.recipe') === 'pantheon') {
        // Gather the things we need
        const cacheKey = _.get(data, 'options._app.metaCache');
        const meta = lando.cache.get(cacheKey);
        const cachedToken = _.get(meta, 'token', null);

        // If we have a token, lets check it out
        if (!_.isEmpty(cachedToken)) {
          // Make sure our token is good beforehand
          return new PantheonApi(cachedToken, lando.log).auth().catch(error => {
            if (error.message.includes('failed with code 401')) {
              // Pull the bad token out of the metadata so it isn't used and prompts user for new token.
              lando.cache.set(cacheKey, _.omit(meta, ['token']), {persist: true});

              // Remove the bad token from the global token cache.
              const globalTokens = lando.cache.get('pantheon.tokens');
              const filteredTokens = _(globalTokens)
                .filter(token => token.token !== cachedToken)
                .value();

              // Set or things correctly for downstream
              lando.cache.set('pantheon.tokens', filteredTokens, {persist: true});
              lando.cache.remove(_.get(data, 'options._app.toolingCache'));
              lando.cli.clearTaskCaches();
              // This is the money option
              delete data.options.auth;
            }
          });
        }
      }
    });
  });
};
