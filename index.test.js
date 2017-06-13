/* global describe it beforeEach afterEach */

'use strict';

const debug = require('debug');
const log = debug('mocha');
const chai = require('chai');
const spies = require('chai-spies');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
let expect = chai.expect;

chai.should();
chai.use(spies);
chai.use(sinonChai);

function getMockedCz(answers) {
  return {
    prompt: () => {
      return {
        then: function (cb) {
          cb(answers);
        }
      };
    }
  };
}

describe('index', () => {
  describe('config', () => {
    let module, commit;
    let rewire = require('rewire');

    beforeEach(() => {
      module = rewire('./lib/changelogrc-config');
    });

    it('should read config from .changelogrc', (done) => {
      module.__set__({
        CHANGELOGRC: '.changelogrc'
      });

      let promise = module();

      promise.then(result => {
        expect(result).to.be.an('object');
        expect(result).to.have.property('types');
        expect(result).to.have.property('notes');
        done();
      });
    });

    it('should loade empty object when no file .changelogrc', (done) => {
      module.__set__({
        // it mocks winston logging tool
        log: {
          warn: () => { }
        },
        CHANGELOGRC: '.changelogrc-not-found'
      });

      let promise = module();

      promise.then(result => {
        expect(result).to.be.an('object');
        expect(result).to.deep.equal({});
        done();
      });
    });
  });

  describe('build', () => {
    let module, commit;
    let rewire = require('rewire');

    beforeEach(() => {
      module = rewire('./index');

      module.__set__({
        // it mocks winston logging tool
        log: {
          info: () => { }
        },

        changelogrcConfig: () => {
          return {
            types: [{ value: 'feat', name: 'feat: my feat' }],
            scopes: [{ name: 'myScope' }],
            scopeOverrides: {
              fix: [{ name: 'fixOverride' }]
            },
            allowCustomScopes: true,
            allowBreakingChanges: ['feat']
          };
        }
      });

      commit = sinon.spy();
    });

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
});
