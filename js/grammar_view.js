/**
 * Controls dynamic grammar web page.
 *
 * Christopher Wong, Stanford University, 2014
 * Modifications by Kevin Gibbons, 2015
 */


var assert = require('./assert');
var parse = require('./parser').parse;
var grammar = require('./grammar');
var printers = require('./printers');
var generator = require('./generate');

/**
 * Utility function which returns the position of the caret in a text field.
 * Supports older versions of IE.
 */
function getCaretPosition(textField) {
  var pos = 0;
  if (document.selection) {
    // Older versions of IE.
    textField.focus();
    var sel = document.selection.createRange();
    sel.moveStart('character', -textField.value.length);
    pos = sel.text.length;
  } else if (typeof textField.selectionStart === 'number') {
    pos = textField.selectionStart;
  }
  return pos;
};

/**
 * Utility function which sets the position of the caret in a text field.
 * Currently no guaranteed support for older versions of IE.
 */
function setCaretPosition(textField, index) {
  if (index > textField.value.length) {
    index = textField.value.length;
  }
  textField.selectionStart = index;
  textField.selectionEnd = index;
};

/**
 * Utility function to focus on a text field. Since we are adding various DOM
 * elements via JavaScript and they may not be immediately visible, we set
 * a small window timeout before the call.
 */
function startFocus(textField) {
  window.setTimeout(function() { textField.focus(); }, 50);
};

/**
 * Utility function to test the user's CFG. Since we are adding various DOM
 * elements via JavaScript and they may not be immediately visible, we set
 * a small window timeout before the call.
 */
function startTest() {
  window.setTimeout(function() { testCFG(); }, 50);
};


/**
 * First function to call once the document is ready.
 */
function initializeGrammarDOM() {
  // Create the first production row.
  newProduction(true);

  // Bind click handlers.
  $('#new-production').click(function(event) { newProduction(false); });
  $('#reset').click(function(event) { resetGrammar(); });
  $('#example').click(function(event) { exampleGrammar(); });

  // Retest CFG any time a key is pressed in the test strings textarea.
  $('#test-input').keyup(testCFG);
};

/**
 * Creates a new production row.
 */
function newProduction(isStart) {
  // Create the outer production-row div container.
  var formGroup = jQuery('<div/>', {'class': 'production-row'});

  // Nonterminal input field.
  var ntDiv = jQuery('<div/>', {'class': 'col-xs-nt'}).appendTo(formGroup);
  var ntInput = jQuery('<input/>', {
    'type': 'text',
    'class': 'form-control nonterminal',
    'maxlength': '1'
  }).appendTo(ntDiv).keydown(handleNtInput).keyup(handleKeyup);

  // Arrow.
  jQuery('<div/>', {'class': 'arrow', 'html': '&#8594;'}).appendTo(formGroup);

  // First production rule.
  var prDiv = jQuery('<div/>', {'class': 'col-xs-pr'}).appendTo(formGroup);
  var prInput = jQuery('<input/>', {
    'type': 'text',
    'class': 'form-control rule',
    'placeholder': '\u03B5'
  }).appendTo(prDiv).keydown(handlePrInput).keyup(handleKeyup);

  function addRm(isStart) {
    var rmDiv = jQuery('<div/>', {'class': 'remove'}).appendTo(formGroup);
    var rmSpan = jQuery('<span/>', {
      'class': 'glyphicon glyphicon-remove-circle remove-button',
      'title': 'Remove last production'
    }).appendTo(rmDiv);
    rmSpan.click(function(event) {
      // Click handler removes the last production and retests the CFG.
      var prods = formGroup.find('input.rule');
      if (prods.size() === 1) {
        if (!isStart) {
          formGroup.remove();
        } else {
          prods.last().val('');
        }
      } else {
        var last = prods.last().parent();
        last.prev().remove(); // the 'or' immediately preceding it
        last.remove();
      }
      startTest();
    });
  }
  if (isStart) {
    // First production row has read-only start symbol.
    ntInput.attr({'value': 'S', 'readonly': '', 'id': 'start-symbol'});
    addRm(true);
    startFocus(prInput);
  } else {
    // All subsequent production rows have a button to remove the entire row.
    addRm(false);
    startFocus(ntInput);
  }
  var plusDiv = jQuery('<div/>', {'class': 'add-rule'}).appendTo(formGroup);
  var plusSpan = jQuery('<span/>', {
    'class': 'glyphicon glyphicon glyphicon-plus add-rule-button',
    'title': 'Add new production'
  }).appendTo(plusDiv);
  plusSpan.click(function(event) {
    // Click handler adds a new production for this line.
    var base = plusDiv.parent().find('input.rule').last()[0];
    newRule(base, true);
    startTest();
  });



  // Add to grammar.
  formGroup.appendTo($('#grammar'));
  jQuery('<div/>', {'class': 'clearfix'}).appendTo($('#grammar'));
  return formGroup;
};

/**
 * Creates a new rule for the production row. Since this is called by the user
 * inputting the pipe '|' character, we split the text at the caret position.
 */
function newRule(base, isAutomatic) { // isAutomatic is set iff this is triggered by code, instead of by typing '|'
  // New production rule.
  var prDiv = jQuery('<div/>', {
    'class': 'col-xs-pr'
  }).insertAfter(base.parentNode);
  var prInput = jQuery('<input/>', {
    'type': 'text',
    'class': 'form-control rule',
    'placeholder': '\u03B5'
  }).appendTo(prDiv).keydown(handlePrInput).keyup(handleKeyup).focus();

  // OR pipe character.
  jQuery('<div/>', {
    'class': 'or',
    'html': '&#124'
  }).insertAfter(base.parentNode);

  // Set the values of the target and new text fields based on where the
  // target string value should be split.
  if (!isAutomatic) {
    var pos = getCaretPosition(base);
    var val = base.value;
    base.value = val.substring(0, pos);
    prInput.attr({'value': val.substring(pos)});
  }
  return prDiv;
};


function handleKeyup(event) {
  var input = event.currentTarget;
  var pos = getCaretPosition(input);
  input.value = input.value.replace(/\|/g, '');
  setCaretPosition(input, pos);

  // Retest CFG any time a key is pressed.
  startTest();
}


/**
 * Key listener for user input in a production rule field.
 */
function handlePrInput(event) {
  var input = event.currentTarget;
  if (!handleCommonInput(event)) {
    switch (event.which) {
      case 8: {
        // Backspace = Merge rules if backspace is against an OR.
        if (getCaretPosition(input) === 0 &&
            input.selectionStart === input.selectionEnd) {
          handlePrBackspace(input);
          event.preventDefault();
        }
        break;
      }
      case 220: {
        // Pipe '|' character = Create new rule.
        if (event.shiftKey) {
          event.preventDefault();
          newRule(input);
          break;
        }
      }
    }
  }
};

/**
 * Key listener for user input in a nonterminal field.
 */
function handleNtInput(event) {
  handleCommonInput(event);
};

/**
 * Handles key events common to nonterminal and production rule text fields.
 * Returns true if a handler was called, except for the pipe character.
 */
function handleCommonInput(event) {
  var input = event.currentTarget;
  switch (event.which) {
    case 13: {
      // Enter = Create new production.
      event.preventDefault();
      newProduction(false);
      return true;
    }
    case 37: {
      // Left arrow key = Possibly jump to previous text field in row.
      if (getCaretPosition(input) === 0) {
        event.preventDefault();
        handleLeftArrow(input);
      }
      return true;
    }
    case 39: {
      // Right arrow key = Possibly jump to next text field in row.
      if (getCaretPosition(input) === input.value.length) {
        event.preventDefault();
        handleRightArrow(input);
      }
      return true;
    }
    case 220: {
      // Pipe '|' character = Consume event.
      if (event.shiftKey) {
        event.preventDefault();
      }
    }
  }
  return false;
};

/**
 * Utility function to move the focus to the previous text field upon a left
 * arrow key. Call this function if the caret position of the text field is 0.
 */
function handleLeftArrow(input) {
  var previousDiv = input.parentNode.previousSibling;
  if (previousDiv === null) {
    // Do not continue if we are at the very left of the row.
    return;
  }
  var targetInput = previousDiv.previousSibling.firstChild;
  if (targetInput.id !== 'start-symbol') {
    targetInput.focus();
    setCaretPosition(targetInput, targetInput.value.length);
  }
};

/**
 * Utility function to move the focus to the next text field upon a right
 * arrow key. Call this function if the caret position of the text field is
 * at the end.
 */
function handleRightArrow(input) {
  var nextDiv = input.parentNode.nextSibling;
  if (nextDiv === null || nextDiv.className === 'remove') {
    // Do not continue if the next div is null or the remove button.
    return;
  }
  var targetInput = nextDiv.nextSibling.firstChild;
  targetInput.focus();
  setCaretPosition(targetInput, 0);
};

/**
 * Utility function to merge two production rules upon a backspace. Call this
 * function if the caret position of the text field is 0.
 */
function handlePrBackspace(input) {
  var previousDiv = input.parentNode.previousSibling;
  if (previousDiv.className === 'arrow') {
    // Do not delete the text field if it is the first production rule.
    return;
  }
  var mergeInput = previousDiv.previousSibling.firstChild;
  var originalValue = mergeInput.value;
  mergeInput.value += input.value;
  mergeInput.focus();
  // Set the appropriate caret position after the call to focus().
  setCaretPosition(mergeInput, originalValue.length);
  previousDiv.remove();
  input.parentNode.remove();
};


/**
 * Handler to reset the CFG.
 */
function resetGrammar() {
  var msg = 'Resetting will erase the current CFG. Are you sure?';
  if (window.confirm(msg)) {
    $('#grammar').empty();
    newProduction(true);
    startTest();
  }
};

/**
 * Handler to fill in an example CFG.
 */
function exampleGrammar(withoutConfirm) {
  var msg = 'Showing an example CFG will overwrite the current CFG *and* ' +
            'test strings. Are you sure?';
  if (withoutConfirm || window.confirm(msg)) {
    $('#test-input').val('1+2\n4+2\n\n2+5\n3+3');
    loadGrammar(Grammar([
      Rule('S', [NT('S'), T('+'), NT('S')]),
      Rule('S', [NT('T')]),
      Rule('T', [T('1')]),
      Rule('T', [T('2')]),
      Rule('T', [T('3')]),
      Rule('T', [T('4')])
    ], 'S'));
  }
};


/**
 * Overwrites the current grammar with the one given.
 */
function loadGrammar(grammar) {
  function addRow(sym, isStart) {
    var row = newProduction(isStart)[0];
    row.firstChild.firstChild.value = sym;
    var ruleInput = row.firstChild.nextSibling.nextSibling.firstChild;
    assert(grammar.symbolMap[sym].rules.length > 0, 'Grammar given is not produceable by tool.')
    var ins = [ruleInput];
    for(var i=1; i<grammar.symbolMap[sym].rules.length; ++i) {
      ruleInput = newRule(ruleInput, true)[0].firstChild;
      ins.push(ruleInput);
    }
    for(var i=0; i<grammar.symbolMap[sym].rules.length; ++i) {
      var production = grammar.symbolMap[sym].rules[i].production;
      for(var j=0; j<production.length; ++j) {
        ins[i].value += production[j].data;
      }
    }
  }
  
  $('#grammar').empty();
  
  addRow(grammar.start, true);
  for(var i=0; i<grammar.symbolsList.length; ++i) {
    var sym = grammar.symbolsList[i];
    if(sym !== grammar.start) {
      addRow(sym, false);
    }
  }
  startTest();
}
window.loadGrammar = loadGrammar;


/**
 * Dumps a machine-readable version of the current grammar to the console.
 * Useful for debugging, especially in combination with loadGrammar.
 */
function dumpGrammar() {
  console.log(readGrammar().repr());
}
window.dumpGrammar = dumpGrammar;


/**
 * Serialize and deserialize a Grammar object to/from JSON, discarding annotations.
 */
function serialize(g) {
  return JSON.stringify({
    start: g.start,
    rules: g.rules
  });
}

function deserialize(str) {
  var blob = JSON.parse(str);
  try {
    return grammar.Grammar(
      blob.rules.map(function(r) {
        return grammar.Rule(
          r.name,
          r.production.map(function(s) {
            if (s.type === 'NT') {
              return grammar.NT(s.data);
            } else if (s.type === 'T') {
              return grammar.T(s.data);
            } else {
              throw null;
            }
          })
        );
      }),
      blob.start
    );
  } catch(e) {
    throw new Error("Encoding not valid!");
  }
}
window.serialize = serialize; window.deserialize = deserialize; // TODO remove this.

function escapeHTML(str) {
  // not my preferred solution, but whatever.
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Tests the current CFG input by the user. Reads the strings from the test
 * strings textarea, and for each string, uses the Early Parser algorithm
 * to determine whether the strings matches the CFG. If there is a match,
 * we display one possible derivation as well.
 */
function testCFG() {
  // Empty the current table.
  var tbody = $('#results');
  tbody.empty();

  // Obtain the test strings and read the user CFG.
  var strings = $('#test-input').val().toLowerCase().split(/\r?\n/);
  var grammar = readGrammar();
  // Display the toHTML() version of the Grammar to the user.  
  
  $('#current-grammar').html('');
  $('#current-grammar').append(printers.domGrammarPrinter(grammar));
  
  
  // Give the user some information.
  var grammarInfo = '';
  var unreachables = grammar.annotateUnreachables();
  if(unreachables.length > 0) {
    grammarInfo += 'Symbols not reachable from the start: ';
    for(var i=0; i<unreachables.length; ++i) {
      if(i>0) grammarInfo += ', ';
      grammarInfo += '<span class="cfg-symbol">' + escapeHTML(unreachables[i]) + '</span>';
    }
    grammarInfo += '. '
  }
  var useless = grammar.annotateUseless();
  if(useless.length > 0) {
    grammarInfo += 'Symbols which can\'t produce any string: ';
    for(var i=0; i<useless.length; ++i) {
      if(i>0) grammarInfo += ', ';
      grammarInfo += '<span class="cfg-symbol">' + escapeHTML(useless[i]) + '</span>';
    }
    grammarInfo += '. '
  }
  if(grammarInfo !== '') {
    grammarInfo += '<br>';
  }
  $('#grammar-info').html(grammarInfo);
  
  var stringsData = '';
  var gen = generator(grammar);
  var validLengths = gen.findLengths(0, 16);
  if(validLengths === null) {
    stringsData = 'There are no strings in the language of this grammar.';
  }
  else if(validLengths.length === 0) {
    stringsData = 'All strings in this grammar are too long for me to generate.';
  }
  else {
    var genStrings = [];
    if(validLengths.length === 1 && validLengths[0] === '') {
      genStrings = [' '];
    }
    else {
      for(var i=0; i<30 && genStrings.length<10; ++i) { // only make 30 attempts
        var index = Math.floor(Math.random()*validLengths.length);
        var string = gen(validLengths[index]);
        assert(string !== null, 'We are meant to be able to generate something...');
        if(string == '') string = '\u025B'; // epsilon
        if(genStrings.indexOf(string) === -1) {
          genStrings.push(string);
        }
      }
    }
    stringsData = 'Some strings from the language of this grammar: <br><pre>' + escapeHTML(genStrings.join('\n')) + '</pre>';
  }
  $('#grammar-strings').html(stringsData);


  // Test each string
  for (var i = 0; i < strings.length; i++) {
    var str = strings[i];
    // As many distinct parses as possible (up to 2)
    var parses = parse(grammar, str);

    // Call escapeHTML() from grammar.js
    str = escapeHTML(str);
    var matchStyle, matchText;
    if(parses.length == 0) {
      matchStyle = 'danger';
      matchText = 'No';
    }
    else if(parses.length == 1) {
      matchStyle = 'success';
      matchText = 'Yes';
    }
    else {
      matchStyle = 'success';
      matchText = 'Yes'; //'Yes (ambiguously)';
    }
    // The row in the results table reports whether the string is a match
    // and is also color coded.
    var row = $('<tr/>', {'class': matchStyle})
                .append($('<td/>', {'html': (i + 1)}))
                .append($('<td/>', {'html': '&quot;' + str + '&quot;'}))
                .append($('<td/>', {'html': matchText}));
    var lastTd = $('<td/>', {'class': 'derivation-cell'}).appendTo(row);
    tbody.append(row);
    
    if (parses.length == 1) {
      lastTd.append($('<a/>', {
        'data-toggle': 'collapse',
        'class': 'derivation-toggle',
        'data-target': '#deriv-' + i,
        'html': 'See Derivation'
      }));
      var derivationRow = getDerivationRow(parses[0], i);
      tbody.append(derivationRow);
    }
    else if (parses.length > 1) {
      lastTd.append($('<a/>', {
        'data-toggle': 'collapse',
        'class': 'derivation-toggle',
        'data-target': '#deriv-' + i + 'A',
        'html': 'Derivation One'
      }));
      var derivationRow = getDerivationRow(parses[0], i + 'A');
      tbody.append(derivationRow);

      lastTd.append(document.createTextNode(' '));
      lastTd.append($('<a/>', {
        'data-toggle': 'collapse',
        'class': 'derivation-toggle',
        'data-target': '#deriv-' + i + 'B',
        'html': 'Derivation Two'
      }));
      derivationRow = getDerivationRow(parses[1], i + 'B');
      tbody.append(derivationRow);
    }
  }
}



/**
 * Reads the user input CFG and returns a Grammar instance.
 */
function readGrammar() {
  var nonterminals = {};
  var rules = [];

  // Iterate through all production rows to first gather the nonterminals.
  $('div.production-row').each(function(index, row) {
    var ch = row.firstChild.firstChild.value;
    if (ch === '') {
      // If there is no nonterminal character, then ignore the row.
      return;
    }
    nonterminals[ch] = true;
  });

  // Now iterate through all production rows to construct the Grammar.
  $('div.production-row').each(function(index, row) {
    var currentDiv = row.firstChild;
    var from = currentDiv.firstChild.value;
    if (from === '') {
      // If there is no nonterminal character, then ignore the row.
      return;
    }

    // Iterate through all production rules to add to the Production.
    while (currentDiv = currentDiv.nextSibling.nextSibling) {
      var symbols = [];
      var str = currentDiv.firstChild.value;
      // Create a Symbol for each character in the text field's string.
      for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch.match(/[ \t\"\']/)) { // ignore whitespace
          continue;
        }
        symbols.push(nonterminals[ch]?grammar.NT(ch):grammar.T(ch));
      }
      rules.push(grammar.Rule(from, symbols));
      if (currentDiv.nextSibling === null ||
          currentDiv.nextSibling.className === 'remove') {
        // Stop once the next div is null or the remove button.
        break;
      }
    }
  });
  return grammar.Grammar(rules).strippedDuplicates();
};

/**
 * Given a parse,
 * constructs a DOM table that shows the string matching derivation.
 */
function getDerivationRow(parse, id) {
  var derivationRow = $('<tr/>', {'class': 'derivation-row active'});
  var derivationTd = $('<td/>', {'colspan': '4'}).appendTo(derivationRow);
  // Bootstrap collapse functionality.
  var collapseTarget = $('<div/>', {
    'class': 'panel-collapse collapse',
    'id': 'deriv-' + id
  }).appendTo(derivationTd);
  var derivationDiv = $('<div/>', {
    'class': 'derivation'
  }).appendTo(collapseTarget);

  // The table showing the derivation has three columns.
  var derivationTable = printers.domPrinter(parse);
  derivationDiv.append(derivationTable);
  return derivationRow;
};




window.readGrammar = readGrammar;

/**
 * jQuery initialization pattern.
 */
$(document).ready(function() {
  initializeGrammarDOM();
  //startTest();
  exampleGrammar(true);
});
