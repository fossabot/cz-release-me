/* global describe it beforeEach afterEach */

'use strict';

var debug = require('debug');
var log = debug('mocha');
var chai = require('chai');
var spies = require('chai-spies');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;

chai.should();
chai.use(spies);
chai.use(sinonChai);

function getMockedCz(answers) {
  return {
    prompt: function () {
      return {
        then: function (cb) {
          cb(answers);
        }
      };
    }
  };
}

describe('index', function () {
  describe('config', function () {
    var module, commit;
    var rewire = require('rewire');

    beforeEach(function () {
      module = rewire('./lib/changelogrc-config');
    });

    it('should read config from .changelogrc', function (done) {
      module.__set__({
        CHANGELOGRC: '.changelogrc'
      });

      var promise = module();

      promise.then(function (result) {
        expect(result).to.be.an('object');
        expect(result).to.have.property('types');
        expect(result).to.have.property('notes');
        
        done();
      });
    });

    it('should loade empty object when no file .changelogrc', function (done) {
      module.__set__({
        // it mocks winston logging tool
        log: {
          warn: function () { }
        },
        CHANGELOGRC: '.changelogrc-not-found'
      });

      var promise = module();

      promise.then(function (result) {
        expect(result).to.be.an('object');
        expect(result).to.deep.equal({});

        done();
      });
    });
  });

  describe('build', function () {
    var module, commit;
    var rewire = require('rewire');

    beforeEach(function () {
      module = rewire('./index');

      module.__set__({
        // it mocks winston logging tool
        log: {
          info: function () { }
        },

        changelogrcConfig: function () {
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

    it('should commit without confirmation', function (done) {
      var answers = {
        confirmCommit: 'yes',
        type: 'feat',
        subject: 'do it all'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('feat: do it all');

        done();
      }, 100);
    });

    it('should escape special characters sush as backticks', function (done) {
      var answers = {
        confirmCommit: 'yes',
        type: 'feat',
        subject: 'with backticks `here`'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('feat: with backticks \\\\`here\\\\`');

        done();
      }, 100);
    });

    it('should not call commit() function if there is no final confirmation and display log message saying commit has been canceled', function (done) {
      var mockCz = getMockedCz({});

      // run commitizen plugin
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.not.been.called;

        done();
      }, 100);
    });

    it('should call commit() function with commit message when user confirms commit and split body when pipes are present', function (done) {
      var answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: 'create a new cool feature',
        body: '-line1|-line2',
        breaking: 'breaking',
        footer: 'my footer'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('feat(myScope): create a new cool feature\n\n-line1\n-line2\n\nBREAKING CHANGE:\nbreaking\n\nISSUES CLOSED: my footer');

        done();
      }, 100);
    });

    it('should call commit() function with commit message with the minimal required fields', function (done) {
      var answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: 'create a new cool feature'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('feat(myScope): create a new cool feature');

        done();
      }, 100);
    });

    it('should suppress scope when commit type is WIP', function (done) {
      var answers = {
        confirmCommit: 'yes',
        type: 'WIP',
        subject: 'this is my work-in-progress'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('WIP: this is my work-in-progress');

        done();
      }, 100);
    });

    it('should allow edit message before commit', function (done) {
      process.env.EDITOR = 'true';

      var answers = {
        confirmCommit: 'edit',
        type: 'feat',
        subject: 'create a new cool feature'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        commit.should.have.been.calledWith('feat: create a new cool feature');

        done();
      }, 100);
    });

    it('should not commit if editor returned non-zero value', function (done) {
      process.env.EDITOR = 'false';

      var answers = {
        confirmCommit: 'edit',
        type: 'feat',
        subject: 'create a new cool feature'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        expect(commit.called).to.equal(false);

        done();
      }, 500);
    });

    it('should truncate first line if number of characters is higher than 200', function (done) {
      var chars_100 = '0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789';

      // this string will be prepend: "ISSUES CLOSED: " = 15 chars
      var footerChars_100 = '0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-0123456789-012345';

      var answers = {
        confirmCommit: 'yes',
        type: 'feat',
        scope: 'myScope',
        subject: chars_100,
        body: chars_100 + ' body-second-line',
        footer: footerChars_100 + ' footer-second-line'
      };

      var mockCz = getMockedCz(answers);
      module.prompter(mockCz, commit);

      setTimeout(function () {
        var firstPart = 'feat(myScope): ';

        var firstLine = commit.lastCall.args[0].split('\n\n')[0];
        firstLine.should.equal(firstPart + answers.subject.slice(0, 100 - firstPart.length));

        //it should wrap body
        var body = commit.lastCall.args[0].split('\n\n')[1];
        body.should.equal(chars_100 + '\nbody-second-line');

        //it should wrap footer
        var footer = commit.lastCall.args[0].split('\n\n')[2];
        footer.should.equal('ISSUES CLOSED: ' + footerChars_100 + '\nfooter-second-line');

        done();
      }, 100);
    });
  });
});
