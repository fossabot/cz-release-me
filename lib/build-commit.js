'use strict';

const wrap = require('word-wrap');

function buildCommit(answers) {
  let maxLineWidth = 100;
  let wrapOptions = {
    trim: true,
    newline: '\n',
    indent: '',
    width: maxLineWidth
  };

  function addScope(scope) {
    if (!scope) return ': '; //it could be type === WIP. So there is no scope

    return '(' + scope.trim() + '): ';
  }

  function addSubject(subject) {
    return subject.trim();
  }

  function escapeSpecialChars(result) {
    let specialChars = ['\`'];

    specialChars.map(function (item) {
      // For some strange reason, we have to pass additional '\' slash to commitizen. Total slashes are 4.
      // If user types "feat: `string`", the commit preview should show "feat: `\\string\\`".
      // Don't worry. The git log will be "feat: `string`"
      result = result.replace(new RegExp(item, 'g'), '\\\\`');
    });

    return result;
  }

  // Hard limit this line
  let head = (answers.type + addScope(answers.scope) + addSubject(answers.subject)).slice(0, maxLineWidth);

  // Wrap these lines at 100 characters
  let body = wrap(answers.body, wrapOptions) || '';
  body = body.split('|').join('\n');

  let breaking = wrap(answers.breaking, wrapOptions);
  let footer = wrap(answers.footer, wrapOptions);

  let result = head;

  if (body) {
    result += '\n\n' + body;
  }

  if (breaking) {
    result += '\n\n' + 'BREAKING CHANGE:\n' + breaking;
  }

  if (footer) {
    result += '\n\nISSUES CLOSED: ' + footer;
  }

  return escapeSpecialChars(result);
}

module.exports = buildCommit;
