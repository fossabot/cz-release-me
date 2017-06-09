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
    let config = changelogrcConfig();
    let pkgPath = path.resolve(process.cwd(), './package.json')
    let pkg = require(pkgPath);

    Promise.resolve(config).then((value) => {
      log.info('\n\nLine 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.\n');

      let questions = require('./lib/questions').getQuestions(value, cz);

      cz.prompt(questions).then((answers) => {
        if (answers.confirmCommit === 'edit') {
          temp.open(null, (err, info) => {
            /* istanbul ignore else */
            if (!err) {
              fs.write(info.fd, buildCommit(answers));
              fs.close(info.fd, (err) => {
                editor(info.path, (code, sig) => {
                  if (code === 0) {
                    let commitStr = fs.readFileSync(info.path, {
                      encoding: 'utf8'
                    });

                    commit(commitStr);
                  }
                  else {
                    log.info('Editor returned non zero value. Commit message was:\n' + buildCommit(answers));
                  }
                });
              });
            }
          });
        }
        else if (answers.confirmCommit === 'yes') {
          commit(buildCommit(answers));
        }
        else {
          log.info('Commit has been canceled.');
        }

        /* istanbul ignore if */
        if (answers.releaseMe === 'yes') {
          if (pkg.scripts.release) {
            shell.exec('npm run release');
          } else {
            log.info('Release script is not defined.');
          }
        }

        /* istanbul ignore if */
        if (answers.pushChanges=== 'yes') {
          shell.exec('git push --follow-tags');

          if (answers.releaseMe === 'yes' && pkg.scripts.release) {
            shell.exec('npm publish');
          } else {
            log.info('No new release, nothing to push to the npm.');
          }
        }
      });
    });
  }
};
