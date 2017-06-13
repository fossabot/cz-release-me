'use strict';

const chalk = require('chalk');
const editor = require('editor');
const temp = require('temp').track();
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');

let log = require('winston');
let buildCommit = require('./lib/build-commit');
let changelogrcConfig = require('./lib/changelogrc-config');

module.exports = {
  prompter: (cz, commit) => {
    let pkg = {};
    try {
      pkg = require(path.resolve(
        process.cwd(),
        './package.json'
      ));
    } catch (err) {
      log.warn('no root package.json found');
    }
    let changelogConfig = changelogrcConfig();

    Promise.resolve(changelogConfig).then(config => {
      log.info('\n\nLine 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.\n');

      let questions = require('./lib/questions').getQuestions(config, cz);

      cz.prompt(questions).then((answers) => {
        if (answers.confirmCommit === 'edit') {
          temp.open(null, (err, info) => {
            if (!err) {
              fs.write(info.fd, buildCommit(answers, config));
              fs.close(info.fd, (err) => {
                editor(info.path, (code, sig) => {
                  if (code === 0) {
                    let commitStr = fs.readFileSync(info.path, {
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
