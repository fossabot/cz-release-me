/* global describe it beforeEach afterEach */

'use strict';

import chai, { should, expect } from 'chai';
import spies from 'chai-spies';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(spies);
chai.use(sinonChai);

should();

describe('cz-release-me', () => {
  let module, cz, commit;
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

    cz = chai.spy('cz', ['prompt', 'Separator']);
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

  it('should commit without confirmation', () => {
    let answers = {
      confirmCommit: 'yes',
      type: 'feat',
      subject: 'do it all'
    };

    let mockCz = getMockedCz(answers);

    // run commitizen plugin
    module.prompter(mockCz, commit);

    commit.should.have.been.calledWith('feat: do it all');
  });

  it('should escape special characters sush as backticks', () => {
    let answers = {
      confirmCommit: 'yes',
      type: 'feat',
      subject: 'with backticks `here`'
    };

    let mockCz = getMockedCz(answers);
    module.prompter(mockCz, commit);

    commit.should.have.been.calledWith('feat: with backticks \\\\`here\\\\`');
  });

  it('should not call commit() function if there is no final confirmation and display log message saying commit has been canceled', () => {
    let mockCz = getMockedCz({});

    // run commitizen plugin
    module.prompter(mockCz, commit);

    commit.should.have.not.been.called();
  });

  it('should call commit() function with commit message when user confirms commit and split body when pipes are present', () => {
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

    commit.should.have.been.calledWith('feat(myScope): create a new cool feature\n\n-line1\n-line2\n\nBREAKING CHANGE:\nbreaking\n\nISSUES CLOSED: my footer');
  });

  it('should call commit() function with commit message with the minimal required fields', () => {
    let answers = {
      confirmCommit: 'yes',
      type: 'feat',
      scope: 'myScope',
      subject: 'create a new cool feature'
    };

    let mockCz = getMockedCz(answers);
    module.prompter(mockCz, commit);
    commit.should.have.been.calledWith('feat(myScope): create a new cool feature');
  });

  it('should suppress scope when commit type is WIP', () => {
    let answers = {
      confirmCommit: 'yes',
      type: 'WIP',
      subject: 'this is my work-in-progress'
    };

    let mockCz = getMockedCz(answers);
    module.prompter(mockCz, commit);
    commit.should.have.been.calledWith('WIP: this is my work-in-progress');
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
      commit.wasCalled.should.equal(false);
      done();
    }, 100);
  });

  it('should truncate first line if number of characters is higher than 200', () => {
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

    let firstPart = 'feat(myScope): ';

    let firstLine = commit.mostRecentCall.args[0].split('\n\n')[0];
    firstLine.should.equal(firstPart + answers.subject.slice(0, 100 - firstPart.length));

    //it should wrap body
    let body = commit.mostRecentCall.args[0].split('\n\n')[1];
    body.should.equal(chars_100 + '\nbody-second-line');

    //it should wrap footer
    let footer = commit.mostRecentCall.args[0].split('\n\n')[2];
    footer.should.equal('ISSUES CLOSED: ' + footerChars_100 + '\nfooter-second-line');
  });
});
