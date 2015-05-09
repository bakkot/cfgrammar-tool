// http://cs.stackexchange.com/questions/40965/cfgs-detecting-infinitely-many-derivations-of-a-single-string
// http://www.cs.laurentian.ca/jdompierre/html/MATH2056E_W2011/cours/s8.4_closures_relations_BW.pdf
// https://a2c2a.wordpress.com/2014/09/18/implementing-an-earley-parser-that-handles-nullable-grammars-and-draws-all-unique-parse-trees-in-python/
// http://web.stanford.edu/~crwong/cfg/grammar.html
// http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm


var assert = require('./assert');
var grammar = require('./grammar');

var parser = {};

var enums = {
  DISTINCT: {},
  SIMILAR: {},
  IDENTICAL: {}, // ie, same rule, index, and predecessor, but different sub-parses
  PRODUCEONE: {},
  PRODUCETWO: {},
  PRODUCEALL: {}
}
parser.PRODUCEONE = enums.PRODUCEONE;
parser.PRODUCETWO = enums.PRODUCETWO;
parser.PRODUCEALL = enums.PRODUCEALL;



var DEBUG = false;
parser.PRODUCECOUNT = enums.PRODUCETWO;

NT = grammar.NT;
T = grammar.T;
Rule = grammar.Rule;
Grammar = grammar.Grammar;
require('./grammar.algorithms')(grammar.Grammar);


// library code, woo
function arraysEqual(a, b) {
  if(a === b) return true;
  if(a == null || b == null) return false;
  if(a.length != b.length) return false;
  for(var i = 0; i < a.length; ++i) {
    if(a[i] !== b[i]) return false;
  }
  return true;
}





if(DEBUG) {
  var _id = 0;
  function id(){
    return ++_id;
  }
}

function State(rule, index, predecessor, backPointers) {
  if(!(this instanceof State)) return new State(rule, index, predecessor, backPointers);
  this.rule = rule;
  this.index = index;
  this.predecessor = predecessor;
  this.backPointers = backPointers || [];
  if(DEBUG) this.id = id();
  assert(this.index == this.backPointers.length); // honestly could just do away with index at this point
}
State.prototype.done = function(){ return this.index === this.rule.production.length; }
State.prototype.compare = function(other) {
  if(this.rule === other.rule
  && this.index === other.index
  && this.predecessor === other.predecessor) {
    if(arraysEqual(this.backPointers, other.backPointers)) {
      return enums.IDENTICAL;
    }
    else {
      return enums.SIMILAR;
    }
  }
  else {
    return enums.DISTINCT;
  }
}
State.prototype.next = function(){ return this.rule.production[this.index]; } 
State.prototype.toString = function(){
  return '(' + (DEBUG?(this.id.toString() + ' '):'') + this.rule.name + ' -> ' + this.rule.production.slice(0, this.index).join('')
          + '*' + this.rule.production.slice(this.index).join('') + ', ' + this.predecessor.toString() 
          + (DEBUG?(', [' + this.backPointers.map(function(x){return x===null?'null':x.id.toString();}).join(',') + ']'):'') + ')';
}







function parse(str, grammar) { // TODO change order, jeebus
  var chart = [];
  for(var i=0; i<=str.length; ++i) chart.push([]);
  
  function seen(state, strPos) {
    var count = 0;
    for(var i=0; i<chart[strPos].length; ++i) {
      var equalness = state.compare(chart[strPos][i]);
      if(equalness == enums.IDENTICAL || (equalness == enums.SIMILAR && parser.PRODUCECOUNT == enums.PRODUCEONE)) { // either we've seen this exact thing before, or we've seen this modulo different parses and don't care about different parses
        return true;
      }
      if(equalness == enums.SIMILAR && parser.PRODUCECOUNT == enums.PRODUCETWO && ++count > 1) { // we've seen something similar and do care
        return true;
      }
    }
    return false;
  }
  
  function scanner(state, strPos) {
    if(state.next().equals(T(str[strPos]))) {
      var newBPs = state.backPointers.slice(0);
      newBPs.push(null); // terminals do not need backpointers, of course
      var advanced = State(state.rule, state.index+1, state.predecessor, newBPs);
      if(!seen(advanced, strPos+1)) {
        chart[strPos+1].push(advanced);
      }
    }
  }
  
  function predictor(state, strPos) {
    var sym = state.next();
    for(var i=0; i<grammar.symbolMap[sym.data].rules.length; ++i) {
      var advanced = State(grammar.symbolMap[sym.data].rules[i], 0, strPos);
      if(!seen(advanced, strPos)) {
        chart[strPos].push(advanced);
      }
    }
    
    // handle silly nullable cornercase: we might need to "re-run" completer for a nullable
    // if we are predicting that nullable but it's already been processed
    // given 'nullable' annotation, we could skip this when 'sym' is not nullable
    for(var i=0; i<chart[strPos].length; ++i) { // can actually abort when we hit current state, but no real need (todo check speedup)
      var candidate = chart[strPos][i];
      if(candidate.rule.name === sym.data && candidate.predecessor === strPos && candidate.done()) {
        var newBPs = state.backPointers.slice(0);
        newBPs.push(candidate); // 'candidate' is already done
        var advanced = State(state.rule, state.index+1, state.predecessor, newBPs);
        if(!seen(advanced, strPos)) {
          chart[strPos].push(advanced);
        }
      }
    }
  }
  
  function completer(state, strPos) {
    var thisSym = NT(state.rule.name);
    for(var i=0; i<chart[state.predecessor].length; ++i) {
      var prevState = chart[state.predecessor][i];
      if(!prevState.done() && thisSym.equals(prevState.next())) {
        var newBPs = prevState.backPointers.slice(0);
        newBPs.push(state); // just finished 'state'
        var advanced = State(prevState.rule, prevState.index+1, prevState.predecessor, newBPs);
        if(!seen(advanced, strPos)) {
          chart[strPos].push(advanced);
        }
      }      
    }
  }
  
  
  var startSym = grammar.start;
  var gammaRule = Rule(['GAMMA'], [NT(startSym)]); // needs a _unique_ identifier. Easiest way: new object
  chart[0].push(State(gammaRule, 0, 0));
  
  for(var i=0; i<=str.length; ++i) {
    if(DEBUG) console.log('processing position ' + i)
  
    for(var j=0; j<chart[i].length; ++j) {
      var state = chart[i][j];
      if(DEBUG) console.log('state ', state.toString())
      if(!state.done()) {
        if(state.next().type == 'NT') {
          if(DEBUG) console.log('p')
          predictor(state, i);
        }
        else {
          if(DEBUG) console.log('s', state.next())
          scanner(state, i);
        }
      }
      else {
        if(DEBUG) console.log('c')
        completer(state, i);
      }
    }
  }

  // done constructing chart; time to find parses
  var parses = [];
  for(var i=0; i<chart[str.length].length; ++i) {
    var state = chart[str.length][i];
    if(state.rule === gammaRule && state.done()) {
      parses.push(state);
    }
  }
  if(DEBUG)
    console.log(parses.length);
  
  return parses;
}

parser.parse = parse;



module.exports = parser;
