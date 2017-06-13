'use strict';

var chalk = require('chalk');
var editor = require('editor');
var temp = require('temp').track();
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

var log = require('winston');
var buildCommit = require('./lib/build-commit');
var changelogrcConfig = require('./lib/changelogrc-config');

module.exports = {
  prompter: function (cz, commit) {
    var pkg = {};
    try {
      pkg = require(path.resolve(
        process.cwd(),
        './package.json'
      ));
    } catch (err) {
      log.warn('no root package.json found');
    }
    
    var changelogConfig = changelogrcConfig();

    Promise.resolve(changelogConfig).then(function (config) {
      log.info('\n\nLine 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.\n');

      var questions = require('./lib/questions').getQuestions(config, cz);

      cz.prompt(questions).then(function (answers) {
        if (answers.confirmCommit === 'edit') {
          temp.open(null, function (err, info) {
            if (!err) {
              fs.write(info.fd, buildCommit(answers, config));
              fs.close(info.fd, function (err) {
                editor(info.path, function (code, sig) {
                  if (code === 0) {
                    var commitStr = fs.readFileSync(info.path, {
                      encoding: 'utf8'
                    });

                    commit(commitStr);
                  }
                  else {
                    log.info('Editor returned non zero value. Commit message was:\n' + buildCommit(answers, config));
                  }
                });
              });
            }
          });
        }
        else if (answers.confirmCommit === 'yes') {
          commit(buildCommit(answers, config));
        }
        else {
          log.info('Commit has been canceled.');
        }

        if (answers.releaseMe === 'yes') {
          if (pkg && pkg.scripts && pkg.scripts.release) {
            shell.exec('npm run release');
          } else {
            log.info('Release script is not defined.');
          }
        }

        if (answers.pushChanges=== 'yes') {
          shell.exec('git push --follow-tags');

          if (answers.releaseMe === 'yes' && pkg && pkg.scripts && pkg.scripts.release) {
            shell.exec('npm publish');
          } else {
            log.info('No new release, nothing to push to the npm.');
          }
        }
      });
    });
  }
};
