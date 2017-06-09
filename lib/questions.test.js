/* global describe it beforeEach afterEach */

'use strict';

const debug = require('debug');
const chai = require('chai');
const spies = require('chai-spies');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

chai.should();
chai.use(spies);
chai.use(sinonChai);

let log = debug('mocha');

describe('lib/questions', () => {
  let module, questions, config;
  let rewire = require('rewire');

  beforeEach(() => {
    questions = rewire('./questions.js');

    questions.__set__({
      // it mocks winston logging tool
      log: {
        info: () => { }
      },
    });

    config = null;
  });

  let mockedCz = {
    Separator: sinon.spy()
  };

  let getQuestion = (number) => {
    return questions.getQuestions(config, mockedCz)[number - 1];
  };

  it('should array of questions be returned', (done) => {
    config = {
      types: [{ key: 'feat', name: 'feat: my feat' }],
      scopes: [{ name: 'myScope' }],
      scopeOverrides: {
        fix: [{ name: 'fixOverride' }]
      },
      allowCustomScopes: true,
      allowBreakingChanges: ['feat']
    };

    setTimeout(() => {
      // question 1 - TYPE
      expect(getQuestion(1).name).to.equal('type');
      expect(getQuestion(1).type).to.equal('list');
      expect(getQuestion(1).choices[0]).to.deep.equal({ value: 'feat', name: '\u001b[33mfeat\u001b[39m (feat: my feat)' }); // chalk.yellow color

      // question 2 - SCOPE
      expect(getQuestion(2).name).to.equal('scope');
      expect(getQuestion(2).choices({})[0]).to.deep.equal({ name: 'myScope' });
      expect(getQuestion(2).choices({ type: 'fix' })[0]).to.deep.equal({ name: 'fixOverride' }); //should override scope
      expect(getQuestion(2).when({ type: 'fix' })).to.equal(true);
      expect(getQuestion(2).when({ type: 'WIP' })).to.equal(false);
      expect(getQuestion(2).when({ type: 'wip' })).to.equal(false);

      // question 3 - SCOPE CUSTOM
      expect(getQuestion(3).name).to.equal('scope');
      expect(getQuestion(3).when({ scope: 'custom' })).to.equal(true);
      expect(getQuestion(3).when({ scope: false })).to.equal(false);
      expect(getQuestion(3).when({ scope: 'scope' })).to.equal(false);

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
      expect(getQuestion(6).when({ type: 'feat' })).to.equal(true);
      expect(getQuestion(6).when({ type: 'fix' })).to.equal(false);

      // question 7 - FOOTER
      expect(getQuestion(7).name).to.equal('footer');
      expect(getQuestion(7).type).to.equal('input');
      expect(getQuestion(7).when({ type: 'fix' })).to.equal(true);
      expect(getQuestion(7).when({ type: 'WIP' })).to.equal(false);

      //question 8, last one, CONFIRM COMMIT OR NOT
      expect(getQuestion(8).name).to.equal('confirmCommit');
      expect(getQuestion(8).type).to.equal('expand');


      let answers = {
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
        types: [{ value: 'feat', name: 'feat: my feat' }],
        scopes: [{ name: 'myScope' }],
        allowBreakingChanges: ['fix']
      };
      expect(getQuestion(6).name).to.equal('breaking');

      let answers = {
        type: 'feat'
      };

      expect(getQuestion(6).when(answers)).to.equal(false); // not allowed
    });

    it('should allow BREAKING CHANGE question when config property "allowBreakingChanges" specifies array of types and answer is one of those', () => {
      config = {
        types: [{ value: 'feat', name: 'feat: my feat' }],
        scopes: [{ name: 'myScope' }],
        allowBreakingChanges: ['fix', 'feat']
      };
      expect(getQuestion(6).name).to.equal('breaking');

      let answers = {
        type: 'feat'
      };

      expect(getQuestion(6).when(answers)).to.equal(true); // allowed
    });

  });

  describe('optional scopes', () => {
    it('should use scope override', () => {
      config = {
        types: [{ value: 'feat', name: 'feat: my feat' }],
        scopeOverrides: {
          feat: [{ name: 'myScope' }]
        }
      };

      // question 2 with
      expect(getQuestion(2).name).to.equal('scope');
      expect(getQuestion(2).choices({})[0]).to.be.undefined;
      expect(getQuestion(2).choices({ type: 'feat' })[0]).to.deep.equal({ name: 'myScope' }); //should override scope
      expect(getQuestion(2).when({ type: 'feat' })).to.equal(true);
      (() => {
        let answers = { type: 'fix' };
        expect(getQuestion(2).when(answers)).to.equal(false);
        expect(answers.scope).to.equal('custom');
      })();
    });
  });
});
