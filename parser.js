// http://cs.stackexchange.com/questions/40965/cfgs-detecting-infinitely-many-derivations-of-a-single-string
// http://www.cs.laurentian.ca/jdompierre/html/MATH2056E_W2011/cours/s8.4_closures_relations_BW.pdf
// https://a2c2a.wordpress.com/2014/09/18/implementing-an-earley-parser-that-handles-nullable-grammars-and-draws-all-unique-parse-trees-in-python/
// http://web.stanford.edu/~crwong/cfg/grammar.html
// http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm


var assert = require('./assert');
var types = require('./types');
require('./algorithms')(types.Grammar);

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



parser.PRODUCECOUNT = enums.PRODUCETWO;

// TODO this is not the best way of doing this.
NT = types.NT;
T = types.T;
Rule = types.Rule;
Grammar = types.Grammar;


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




// a State in an Earley parse is a tuple (rule, index, predecessor, backPointers)
// Conceptually, a State is a possibly-partial sub-parse of some part of the string.
// 'rule' is the rule which this state is a (possibly partial) parse of
// 'index' is how far along in the rule's production this state is
// 'predecessor' is the index in the string-being-parsed at which this rule began
// 'backPointers' is the children of this rule, essentially: that is,
//   when index > 0, index has been pushed along by a series of sub-parses completing,
//   each sub-parse representing a terminal or nonterminal in this rule's production.
//   backPointers is an array containing those completed sub-parses/States.
//   in particular, backPointers[i] is the State object corresponding to
//   rule.production[i] (or null if said production is a terminal).
// TODO rename backPointers, do away with index
// TODO have 'c' instead of null for terminals in backPointers
function State(rule, index, predecessor, backPointers) {
  if(!(this instanceof State)) return new State(rule, index, predecessor, backPointers);
  this.rule = rule;
  this.index = index;
  this.predecessor = predecessor;
  this.backPointers = backPointers || [];
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
  return '(' + this.rule.name + ' -> ' + this.rule.production.slice(0, this.index).join('')
          + '*' + this.rule.production.slice(this.index).join('') + ', ' + this.predecessor.toString() + ')';
}







function parse(grammar, str, produceCount) {
  if(typeof str !== 'string') throw Error('Can\'t parse non-string object ' + (typeof str));
  var oldProduceCount = parser.PRODUCECOUNT;
  if(produceCount) {
    parser.PRODUCECOUNT = produceCount;
  }
  
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
  

  if(parser.PRODUCECOUNT == enums.PRODUCEALL && grammar.annotateSelfDeriving().length !== 0) {
    throw Error('Asked for all parses, but grammar can produce infinitely many parses for some string. Check grammar.annotateSelfDeriving() for specifics.');
  }
    
  
  var startSym = grammar.start;
  var gammaRule = Rule(['GAMMA'], [NT(startSym)]); // needs a _unique_ identifier. Easiest way: new object
  chart[0].push(State(gammaRule, 0, 0));
  
  for(var i=0; i<=str.length; ++i) {
    for(var j=0; j<chart[i].length; ++j) {
      var state = chart[i][j];
      if(!state.done()) {
        if(state.next().type == 'NT') {
          predictor(state, i);
        }
        else {
          scanner(state, i);
        }
      }
      else {
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
  
  parser.PRODUCECOUNT = oldProduceCount;
  return parses;
}

parser.parse = parse;



module.exports = parser;
