/* global describe it beforeEach afterEach */

'use strict';

import debug from 'debug';
import chai, { should, expect } from 'chai';
import spies from 'chai-spies';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(spies);
chai.use(sinonChai);

should();

const log = debug('mocha');

describe('cz-release-me', () => {
  describe('core', () => {
    let module, commit;
    let rewire = require('rewire');

    beforeEach(() => {
      module = rewire('../src/index.js');

      module.__set__({
        // it mocks winston logging tool
        log: {
          info: () => {}
        },

        changelogrcConfig: () => {
          return {
            types: [{value: 'feat', name: 'feat: my feat'}],
            scopes: [{name: 'myScope'}],
            scopeOverrides: {
              fix: [{name: 'fixOverride'}]
            },
            allowCustomScopes: true,
            allowBreakingChanges: ['feat']
          };
        }
      });

      commit = sinon.spy();
    });

    function getMockedCz(answers) {
      return {
        prompt: () => {
          return {
            then: (cb) => {
              cb(answers);
            }
          };
        }
      };
    }

    it('should commit without confirmation', (done) => {
      let answers = {
        confirmCommit: 'yes',
        type: 'feat',
        subject: 'do it all'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('feat: do it all');
        done();
      }, 100);
    });

    it('should escape special characters sush as backticks', (done) => {
      let answers = {
        confirmCommit: 'yes',
        type: 'feat',
        subject: 'with backticks `here`'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('feat: with backticks \\\\`here\\\\`');
        done();
      }, 100);
    });

    it('should not call commit() function if there is no final confirmation and display log message saying commit has been canceled', (done) => {
      let mockCz = getMockedCz({});

      // run commitizen plugin
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.not.been.called;
        done();
      }, 100);
    });

    it('should call commit() function with commit message when user confirms commit and split body when pipes are present', (done) => {
      let answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: 'create a new cool feature',
        body: '-line1|-line2',
        breaking: 'breaking',
        footer: 'my footer'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('feat(myScope): create a new cool feature\n\n-line1\n-line2\n\nBREAKING CHANGE:\nbreaking\n\nISSUES CLOSED: my footer');
        done();
      }, 100);
    });

    it('should call commit() function with commit message with the minimal required fields', (done) => {
      let answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: 'create a new cool feature'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('feat(myScope): create a new cool feature');
        done();
      }, 100);
    });

    it('should suppress scope when commit type is WIP', (done) => {
      let answers = {
        confirmCommit: 'yes',
        type: 'WIP',
        subject: 'this is my work-in-progress'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('WIP: this is my work-in-progress');
        done();
      }, 100);
    });

    it('should allow edit message before commit', (done) => {
      process.env.EDITOR = 'true';

      let answers = {
        confirmCommit: 'edit',
        type: 'feat',
        subject: 'create a new cool feature'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        commit.should.have.been.calledWith('feat: create a new cool feature');
        done();
      }, 100);
    });

    it('should not commit if editor returned non-zero value', (done) => {
      process.env.EDITOR = 'false';

      let answers = {
        confirmCommit: 'edit',
        type: 'feat',
        subject: 'create a new cool feature'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        expect(commit.called).to.equal(false);
        done();
      }, 500);
    });

    it('should truncate first line if number of characters is higher than 200', (done) => {
      let chars_100 = '0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789';

      // this string will be prepend: "ISSUES CLOSED: " = 15 chars
      let footerChars_100 = '0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-012345';

      let answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: chars_100,
        body: chars_100 + ' body-second-line',
        footer: footerChars_100 + ' footer-second-line'
      };

      let mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(() => {
        let firstPart = 'feat(myScope): ';

        let firstLine = commit.lastCall.args[0].split('\n\n')[0];
        firstLine.should.equal(firstPart + answers.subject.slice(0, 100 - firstPart.length));

        //it should wrap body
        let body = commit.lastCall.args[0].split('\n\n')[1];
        body.should.equal(chars_100 + '\nbody-second-line');

        //it should wrap footer
        let footer = commit.lastCall.args[0].split('\n\n')[2];
        footer.should.equal('ISSUES CLOSED: ' + footerChars_100 + '\nfooter-second-line');
        done();
      }, 100);
    });
  });

  describe('questions', () => {
    var questions, config;

    beforeEach(() => {
      questions = require('../src/lib/questions.js');
      config = null;
    });

    var mockedCz = {
      Separator: sinon.spy()
    };

    var getQuestion = (number) => {
      return questions.getQuestions(config, mockedCz)[number - 1];
    };

    it('should array of questions be returned', (done) => {
      config = {
        types: [{key: 'feat', name: 'feat: my feat'}],
        scopes: [{name: 'myScope'}],
        scopeOverrides: {
          fix: [{name: 'fixOverride'}]
        },
        allowCustomScopes: true,
        allowBreakingChanges: ['feat']
      };

      setTimeout(() => {
        // question 1 - TYPE
        expect(getQuestion(1).name).to.equal('type');
        expect(getQuestion(1).type).to.equal('list');
        expect(getQuestion(1).choices[0]).to.deep.equal({value: 'feat', name: '\u001b[33mfeat\u001b[39m (feat: my feat)'}); // chalk.yellow color

        // question 2 - SCOPE
        expect(getQuestion(2).name).to.equal('scope');
        expect(getQuestion(2).choices({})[0]).to.deep.equal({name: 'myScope'});
        expect(getQuestion(2).choices({type: 'fix'})[0]).to.deep.equal({name: 'fixOverride'}); //should override scope
        expect(getQuestion(2).when({type: 'fix'})).to.equal(true);
        expect(getQuestion(2).when({type: 'WIP'})).to.equal(false);
        expect(getQuestion(2).when({type: 'wip'})).to.equal(false);

        // question 3 - SCOPE CUSTOM
        expect(getQuestion(3).name).to.equal('scope');
        expect(getQuestion(3).when({scope: 'custom'})).to.equal(true);
        expect(getQuestion(3).when({scope: false})).to.equal(false);
        expect(getQuestion(3).when({scope: 'scope'})).to.equal(false);

        // question 4 - SUBJECT
        expect(getQuestion(4).name).to.equal('subject');
        expect(getQuestion(4).type).to.equal('input');
        expect(getQuestion(4).message).to.match(/IMPERATIVE tense description/);
        expect(getQuestion(4).validate()).to.equal(false); //mandatory question
        expect(getQuestion(4).filter('Subject')).to.equal('subject');

        // question 5 - BODY
        expect(getQuestion(5).name).to.equal('body');
        expect(getQuestion(5).type).to.equal('input');

        // question 6 - BREAKING CHANGE
        expect(getQuestion(6).name).to.equal('breaking');
        expect(getQuestion(6).type).to.equal('input');
        expect(getQuestion(6).when({type: 'feat'})).to.equal(true);
        expect(getQuestion(6).when({type: 'fix'})).to.equal(false);

        // question 7 - FOOTER
        expect(getQuestion(7).name).to.equal('footer');
        expect(getQuestion(7).type).to.equal('input');
        expect(getQuestion(7).when({type: 'fix'})).to.equal(true);
        expect(getQuestion(7).when({type: 'WIP'})).to.equal(false);

        //question 8, last one, CONFIRM COMMIT OR NOT
        expect(getQuestion(8).name).to.equal('confirmCommit');
        expect(getQuestion(8).type).to.equal('expand');


        var answers = {
          confirmCommit: 'yes',
          type: 'feat',
          scope: 'myScope',
          subject: 'create a new cool feature'
        };

        expect(getQuestion(8).message(answers)).to.match(/Are you sure you want to proceed with the commit above?/);
        done();
      }, 100);
    });


    describe('optional fixOverride and allowBreakingChanges', () => {

      it('should restrict BREAKING CHANGE question when config property "allowBreakingChanges" specifies array of types', () => {
        config = {
          types: [{value: 'feat', name: 'feat: my feat'}],
          scopes: [{name: 'myScope'}],
          allowBreakingChanges: ['fix']
        };
        expect(getQuestion(6).name).to.equal('breaking');

        var answers = {
          type: 'feat'
        };

        expect(getQuestion(6).when(answers)).to.equal(false); // not allowed
      });

      it('should allow BREAKING CHANGE question when config property "allowBreakingChanges" specifies array of types and answer is one of those', () => {
        config = {
          types: [{value: 'feat', name: 'feat: my feat'}],
          scopes: [{name: 'myScope'}],
          allowBreakingChanges: ['fix', 'feat']
        };
        expect(getQuestion(6).name).to.equal('breaking');

        var answers = {
          type: 'feat'
        };

        expect(getQuestion(6).when(answers)).to.equal(true); // allowed
      });

    });

    describe('Optional scopes', () => {

      it('should use scope override', () => {
        config = {
          types: [{value: 'feat', name: 'feat: my feat'}],
          scopeOverrides: {
            feat: [{name: 'myScope'}]
          }
        };

        // question 2 with
        expect(getQuestion(2).name).to.equal('scope');
        expect(getQuestion(2).choices({})[0]).to.be.undefined;
        expect(getQuestion(2).choices({type: 'feat'})[0]).to.deep.equal({name: 'myScope'}); //should override scope
        expect(getQuestion(2).when({type: 'feat'})).to.equal(true);
        (() => {
          var answers = {type: 'fix'};
          expect(getQuestion(2).when(answers)).to.equal(false);
          expect(answers.scope).to.equal('custom');
        })();

      });
    });
  });
});
