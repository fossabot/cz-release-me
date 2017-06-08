'use strict';

const log = require('winston');
const chalk = require('chalk');
const editor = require('editor');
const temp = require('temp').track();
const fs = require('fs');
const path = require('path');
const buildCommit = require('./lib/build-commit');
const changelogrcConfig = require('./lib/changelogrc-config');

module.exports = {
  prompter: (cz, commit) => {
    let config = changelogrcConfig();

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
      });
    });
  }
};
