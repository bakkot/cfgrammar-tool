var types = require('./types');
NT = types.NT;
T = types.T;
Rule = types.Rule;
Grammar = types.Grammar;
var generator = require('./generate');
var checks = require('./check');
var assert = require('./assert');
var parser = require('./parser');
var subtreePrinter = require('./printers').subtreePrinter;




// Arithmetic expressions on 0-9 (with precedence). Demonstrates one way to use a parse.

var plus = Rule('E', [NT('E'), T('+'), NT('T')]);
var term = Rule('E', [NT('T')]);
var times = Rule('T', [NT('T'), T('*'), NT('F')]);
var factor = Rule('T', [NT('F')]);
var pos = Rule('F', [NT('P')]);
var neg = Rule('F', [T('-'), NT('P')]); // JS does not allow --1
var paren = Rule('P', [T('('), NT('E'), T(')')]);
var digit = Rule('P', [NT('N')]);

var mathGrammar = Grammar([
  plus,
  term,
  times,
  factor,
  pos,
  neg,
  paren,
  digit,
  Rule('N', [T('0')]),
  Rule('N', [T('1')]),
  Rule('N', [T('2')]),
  Rule('N', [T('3')]),
  Rule('N', [T('4')]),
  Rule('N', [T('5')]),
  Rule('N', [T('6')]),
  Rule('N', [T('7')]),
  Rule('N', [T('8')]),
  Rule('N', [T('9')])]
);


plus.eval = function(state) { return mathEval(state.backPointers[0]) + mathEval(state.backPointers[2]); }
times.eval = function(state) { return mathEval(state.backPointers[0]) * mathEval(state.backPointers[2]); }
neg.eval = function(state) { return -mathEval(state.backPointers[1]); }
paren.eval = function(state) { return mathEval(state.backPointers[1]); }
digit.eval = function(state) { return parseInt(state.backPointers[0].rule.production[0].data); }

function mathEval(state) {
  if(state.rule.eval) {
    return state.rule.eval(state);
  }
  else {
    assert(state.rule.production.length == 1, 'No valid evaluation rule.');
    return mathEval(state.backPointers[0]);
  }
}


var mathGenerator = generator(mathGrammar);

console.log('Arithmetic tests:');
for(var i=0; i<10; ++i) {
  var expr = mathGenerator(Math.round(Math.random()*40) + 1);
  var res = parser.parse(mathGrammar, expr, parser.PRODUCEALL);
  assert(res.length == 1, 'mathGrammar is ambiguous?');
  var grammarVal = mathEval(res[0]);
  var jsVal = eval(expr);
  assert(grammarVal == jsVal || (isNaN(grammarVal) && isNaN(jsVal)), 'JS disagrees with our evaluation.')
}
console.log('Passed.');







// The ur-test: generate and test CFGs. BECAUSE I CAN.
// Specifically, for five-or-fewer-symbol CFGs over [x,y,z].
// Only to be used for generation, not parsing (because I don't want to split up the terminal strings)


var grammarGrammar = Grammar([
  Rule('Grammar', [T('Grammar([\n  '), NT('Rule'), NT('RulesList'), T('\n]);')]),
  Rule('RulesList', [T(',\n  '), NT('Rule'), NT('RulesList')]),
  Rule('RulesList', []),
  Rule('Rule', [T('Rule(\''), NT('NT'), T('\', ['), NT('OptionalSymList'), T('])')]),
  Rule('OptionalSymList', [NT('Sym'), NT('SymList')]),
  Rule('OptionalSymList', []),
  Rule('SymList', [T(', '), NT('Sym'), NT('SymList')]),
  Rule('SymList', []),
  Rule('Sym', [T('T(\''), NT('T'), T('\')')]),
  Rule('Sym', [T('NT(\''), NT('NT'), T('\')')]),
  Rule('T', [T('x')]),
  Rule('T', [T('y')]),
  Rule('T', [T('z')]),
  Rule('NT', [T('A')]),
  Rule('NT', [T('B')]),
  Rule('NT', [T('C')]),
  Rule('NT', [T('D')]),
  Rule('NT', [T('E')])
]);

var ggg = generator(grammarGrammar);

function makeGrammar() {
  var x = ggg(Math.round(Math.random()*400) + 40);
  //console.log(x);
  return eval(x); // eval? yes. eval.
}

// Generate ten random context-free grammars, and ensure that the set of strings
// each generates appears to be at least a subset of the set of strings each recognizes.
// (Of course, the sets should be identical, but that's harder to test.)
console.log('CFG tests:');
for(var i=0; i<5; ++i) {
  //console.log(i);
  var g = makeGrammar();
  var w = checks.locatableDifference(g, g, 4, 10);
  if(w) {
    console.log(w);
    process.exit();
  }
}
console.log('Passed.');

