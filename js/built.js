(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(condition, message) {
  if(!condition) {
    throw new Error(message);
  }
}

},{}],2:[function(require,module,exports){
// taken directly from http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.32.8707

var assert = require('./assert');

function sum(l) {
  var out = 0;
  for(var i=0; i<l.length; ++i) {
    out += l[i];
  }
  return out;
}

function choose(l, foo) {
  var total = sum(l);
  //console.log(l, total, foo);
  if(total == 0) return -1; // no valid options
  var r = Math.random();
  for(var i=0; i<l.length; ++i) {
    var t = l[i]/total;
    if(r < t) return i;
    r -= t;
  }
  console.log('AThis shouldn\'t really happen.', r);
  return l.length-1;
}


function generator(grammar) {
  grammar = grammar.deNulled();
  if(!grammar.empty && grammar.annotateSelfDeriving().length > 0) {
    throw Error('Generator does not work when there are infinitely many parses for a string. (ie, when A*=>A.)');
  }


  var ftable = {};
  function f(sym, n) {
    if(!(sym in ftable)) {
      ftable[sym] = {};
    }
    if(n in ftable[sym]) {
      return ftable[sym][n];
    }
  
    var out = [];
    for(var j=0; j<grammar.symbolMap[sym].rules.length; ++j) {
      out.push(sum(fprime(sym, j, 0, n)));
    }
  
    ftable[sym][n] = out;
    return out;
  }

  var fprimetable = {};
  function fprime(sym, j, k, n) {
    if(n == 0) return [];
  
    if(!(sym in fprimetable)) {
      fprimetable[sym] = {};
    }
    if(!(j in fprimetable[sym])) {
      fprimetable[sym][j] = {};
    }
    if(!(k in fprimetable[sym][j])) {
      fprimetable[sym][j][k] = {};
    }
    if(n in fprimetable[sym][j][k]) {
      return fprimetable[sym][j][k][n];
    }
  
    var x = grammar.symbolMap[sym].rules[j].production[k];
    var tij = grammar.symbolMap[sym].rules[j].production.length-1;
    var out;
    if(x.type == 'T') {
      if(k == tij) { // basically, if we are being asked about the last symbol
        if(n == 1) { // paper has n=0. pretty sure that's a typo.
          out = [1];
        }
        else {
          out = [0];
        }
      }
      else {
        out = [sum(fprime(sym, j, k+1, n-1))];
      }
    }
    else {
      if(k == tij) {
        out = [sum(f(x.data, n))];
      }
      else {
        out = [];
        for(var l=1; l<=n-tij+k; ++l) {
          out.push(sum(f(x.data, l)) * sum(fprime(sym, j, k+1, n-l)));
        }
      }
    }
  
    fprimetable[sym][j][k][n] = out;
    return out;
  }



  function g(sym, n) {
    var r = choose(f(sym, n));
    if(r == -1) return null; // no valid options
    return gprime(sym, r, 0, n);
  }


  function gprime(sym, j, k, n) {
    var x = grammar.symbolMap[sym].rules[j].production[k];
    //console.log(sym, j, k, n, x)
    var tij = grammar.symbolMap[sym].rules[j].production.length-1;
  
    if(x.type == 'T') {
      if(k == tij) {
        return x.data;
      }
      else {
        return x.data + gprime(sym, j, k+1, n-1);
      }
    }
    else {
      if(k == tij) {
        return g(x.data, n);
      }
      else {
        var l = choose(fprime(sym, j, k, n), 'be defined'); // paper has i, i, k, n. pretty sure that's a typo
        assert(l !== -1, "Couldn't find a valid choice.");
        return g(x.data, l+1) + gprime(sym, j, k+1, n-(l+1)); // l is a length, not an index
      }
    }
  }


  function generate(n) {
    if(n == 0) {
      return grammar.makesEpsilon?'':null;
    }
    if(grammar.empty) {
      return null;
    }
    return g(grammar.start, n);
  }
  
  // TODO probably get rid of this.
  // determine if there are any strings in the grammar of length in [start, start+range)
  // returns such an n, if one exists, or -1 if none exist, or -2 if the language is {''},
  // or -3 if the language is the empty set.
  // by default, start=0, range=10
  generate.findLength = function(start, range) {
    if(grammar.empty) {
      return grammar.makesEpsilon?-2:-3;
    }
    start = start || 0;
    range = range || 10;

    if(start == 0 && grammar.makesEpsilon) {
      return 0;
    }

    for(var n=start; n<start+range; ++n) {
      if(choose(f(grammar.start, n)) !== -1) {
        return n;
      }
    }
    
    return -1;
  }
  
  // In the range [start, start+range), which lengths are possible?
  // Returns null if the grammar is empty.
  // TODO could also tell people when the only possibility is the empty string...
  generate.findLengths = function(start, range) {
    start = start || 0;
    range = range || 10;
    if(grammar.empty) {
      if(!grammar.makesEpsilon) {
        return null;
      }
      else {
        return start == 0 ? [0]:[];
      }
    }
    
    var lengths = [];
    if(start == 0) {
      if(grammar.makesEpsilon) {
        lengths.push(0);
      }
      start = 1;
    }
    
    for(var length = start; length<start+range; ++length) {
      if(choose(f(grammar.start, length)) !== -1) {
        lengths.push(length);
      }
    }
    
    return lengths;
  }
  
  return generate;
}


module.exports = generator;
},{"./assert":1}],3:[function(require,module,exports){
var Rule = require('./grammar').Rule;
var assert = require('./assert');
// pass in the Grammar constructor and its prototype will be modified to have various algorithms
module.exports = function(Grammar) {

// modify the grammar so each symbol has a 'nullable' property
// and the grammar to have a 'nullables' property, a list of nullable symbols
// returns the list of nullables
// http://cstheory.stackexchange.com/a/2493
Grammar.prototype.annotateNullables = function() {
  if(this.hasOwnProperty('nullables')) return this.nullables; // already done, don't redo
  
  this.nullables = [];
  var queue = [];
  var cs = []; // count of non-distinct symbols in RHS of rule i currently marked non-nullable, which does not make for a good variable name
  var rMap = this.getReverseMap();

  for(var i=0; i<this.symbolsList.length; ++i) {
    this.symbolMap[this.symbolsList[i]].nullable = false;
  }
  
  for(var i=0; i<this.rules.length; ++i) {
    var c = 0;
    var rule = this.rules[i];
    var maybeNullable = true; // does this rule produce a string with only nonterminals?
    for(var j=0; j<rule.production.length; ++j) {
      if(rule.production[j].type === 'NT') {
        ++c;
      }
      else {
        maybeNullable = false;
        break;
      }
    }
    if(maybeNullable) {
      cs.push(c);
    }
    else {
      cs.push(0);
    }
    
    
    if(rule.production.length == 0 && !this.symbolMap[rule.name].nullable) {
      this.symbolMap[rule.name].nullable = true;
      queue.push(rule.name);
      this.nullables.push(rule.name);
    }
  }

  for(var i=0; i<this.rules.length; ++i) {
    this.rules[i]._index = i;
  }
  
  while(queue.length > 0) {
    var cur = queue.pop();
    for(var i=0; i<rMap[cur].length; ++i) {
      var affected = rMap[cur][i];
      if(--cs[affected._index] === 0 && !this.symbolMap[affected.name].nullable) { // can only have been positive if the rule contained no terminals, so ok
        this.symbolMap[affected.name].nullable = true;
        queue.push(affected.name);
        this.nullables.push(affected.name);
      }
    }
  }

  for(var i=0; i<this.rules.length; ++i) {
    delete this.rules[i]._index;
  }

  
  return this.nullables;
}


// modify the grammar so each symbol has an "unreachable" property
// ie, no chain of derivations from the start symbol reaches that symbol. note that something may be reachable even if no chain which produces a string involves that thing. (eg S -> AB, B->'', A->A. then B is reachable.)
// grammar gets an "unreachables" property
// returns the list of unreachables
Grammar.prototype.annotateUnreachables = function() {
  if(this.hasOwnProperty('unreachables')) return this.unreachables; // already done, don't redo
  
  this.unreachables = [];
  var queue = [this.start];

  for(var i=0; i<this.symbolsList.length; ++i) {
    this.symbolMap[this.symbolsList[i]].unreachable = true;
  }
  this.symbolMap[this.start].unreachable = false;
  

  while(queue.length > 0) {
    var cur = queue.pop();
    for(var j=0; j<this.symbolMap[cur].rules.length; ++j) {
      var rule = this.symbolMap[cur].rules[j];
      for(var k=0; k<rule.production.length; ++k) {
        var sym = rule.production[k];
        if(sym.type === 'NT' && this.symbolMap[sym.data].unreachable) {
          this.symbolMap[sym.data].unreachable = false;
          queue.push(sym.data);
        }
      }
    }
  }
  
  for(var i=0; i<this.symbolsList.length; ++i) {
    if(this.symbolMap[this.symbolsList[i]].unreachable) {
      this.unreachables.push(this.symbolsList[i]);
    }
  }
  
  return this.unreachables;
}


// modify the grammar so each symbol has a "useless" property
// ie, there is no terminal string derivable from that symbol
// grammar gets a "uselesses" property (forgive me)
// returns the list of useless symbols
Grammar.prototype.annotateUseless = function() {
  if(this.hasOwnProperty('uselesses')) return this.uselesses; // already done, don't redo
  
  this.uselesses = [];
  var queue = [];
  var cs = []; // count of non-distinct symbols in RHS of rule i currently marked possibly-useless, which does not make for a good variable name
  var rMap = this.getReverseMap();

  // very similar logic to finding nullables, except things are assumed useless until proven otherwise
  for(var i=0; i<this.symbolsList.length; ++i) {
    this.symbolMap[this.symbolsList[i]].useless = true;
  }
  
  for(var i=0; i<this.rules.length; ++i) {
    var c = 0;
    var rule = this.rules[i];
    for(var j=0; j<rule.production.length; ++j) {
      if(rule.production[j].type === 'NT') {
        ++c;
      }
    }
    cs.push(c);
    if(c == 0 && this.symbolMap[rule.name].useless) {
      this.symbolMap[rule.name].useless = false;
      queue.push(rule.name);
    }
  }

  for(var i=0; i<this.rules.length; ++i) {
    this.rules[i]._index = i;
  }

  
  while(queue.length > 0) {
    var cur = queue.pop();
    for(var i=0; i<rMap[cur].length; ++i) {
      var affected = rMap[cur][i];
      if(--cs[affected._index] === 0 && this.symbolMap[affected.name].useless) {
        this.symbolMap[affected.name].useless = false;
        queue.push(affected.name);
      }
    }
  }

  for(var i=0; i<this.symbolsList.length; ++i) {
    if(this.symbolMap[this.symbolsList[i]].useless) {
      this.uselesses.push(this.symbolsList[i]);
    }
  }

  for(var i=0; i<this.rules.length; ++i) {
    delete this.rules[i]._index;
  }
  
  return this.uselesses;
}




// modify the grammar so each symbol has a "selfDeriving" property
// ie,  A *=> A (via some chain of length > 0)
// grammar gets a "selfDerivings" property
// returns the list of self-deriving symbols
// http://cs.stackexchange.com/a/40967/12130
Grammar.prototype.annotateSelfDeriving = function() {
  if(this.hasOwnProperty('selfDerivings')) return this.selfDerivings; // already done, don't redo
  
  this.selfDerivings = [];
  
  this.annotateNullables();
  
  var derives = {}; // derives.A.B holds if A *=> B
  for(var i=0; i<this.symbolsList.length; ++i) {
    derives[this.symbolsList[i]] = {};
  }
  
  
  // initialization: set the one-step derivations.
  o:for(var i=0; i<this.rules.length; ++i) {
    var name = this.rules[i].name;
    var production = this.rules[i].production;
    
    // easy cases: production empty, contains terminals, or contains exactly one nonterminal
    if(production.length == 0) {
      continue;
    }
    
    for(var j=0; j<production.length; ++j) {
      if(production[j].type == 'T') {
        continue o;
      }
    }
    
    if(production.length == 1) {
      derives[name][production[0].data] = true;
      continue;
    }
    
    
    // harder case: production consists of two or more nonterminals. TODO could merge some loops but speedup is negligible probably
    var nonnullable = null;
    for(var j=0; j<production.length; ++j) {
      if(!this.symbolMap[production[j].data].nullable) {
        if(nonnullable !== null) {
          continue o; // two or more nonnullable nonterminals: so this rule can't derive any single nonterminal
        }
        nonnullable = production[j].data;
      }
    }
    
    if(nonnullable !== null) { // exactly one nonnullable nonterminal: that and only that is derived.
      derives[name][nonnullable] = true;
    }
    else { // two or more nullable: everything is derived
      for(var j=0; j<production.length; ++j) {
        derives[name][production[j].data] = true; // everything is a nonterminal, so this is safe
      }
    }
  }
  
  // recursion: floyd-warshall, basically
  for(var i=0; i<this.symbolsList.length; ++i) {
    for(var j=0; j<this.symbolsList.length; ++j) {
      for(var k=0; k<this.symbolsList.length; ++k) {
        if(derives[this.symbolsList[i]][this.symbolsList[k]] && derives[this.symbolsList[k]][this.symbolsList[j]]) {
          // if i derives k and k derives j then i derives j
          derives[this.symbolsList[i]][this.symbolsList[j]] = true;
        }
      }
    }
  }
  
  for(var i=0; i<this.symbolsList.length; ++i) {
    var cur = this.symbolsList[i];
    if(derives[cur][cur]) {
      this.symbolMap[cur].selfDeriving = true;
      this.selfDerivings.push(cur);
    }
    else {
      this.symbolMap[cur].selfDeriving = false;
    }
  }
  
  return this.selfDerivings;
}







// returns a copy of the grammar without useless symbols. does not modify the grammar,
// except annotating. if the result is empty, returns {empty: true}.
Grammar.prototype.strippedUseless = function() {
  this.annotateUseless();
  var newRules = [];
  
  for(var i=0; i<this.rules.length; ++i) {
    var rule = this.rules[i];
    if(!this.symbolMap[rule.name].useless) {
      var j;
      for(j=0; j<rule.production.length; ++j) {
        if(rule.production[j].type == 'NT' && this.symbolMap[rule.production[j].data].useless) {
          break;
        }
      }
      if(j == rule.production.length) { // ie rule does not contain any useless symbols
        newRules.push(rule);
      }
    }
  }
  
  if(newRules.length == 0) {
    return {empty: true};
  }
  
  var newGrammar = Grammar(newRules, this.start);
  if(newGrammar.symbolMap[newGrammar.start].rules.length === 0) {
    return {empty: true}; // nowhere to go: empty.
  }
  
  
  assert(newGrammar.annotateUseless().length == 0, 'Haven\'t actually eliminated all useless productions?');
  
  return newGrammar;
}

// returns a copy of the grammar without useless symbols. does not modify the grammar,
// except annotating. if the result is empty, returns {empty: true}.
Grammar.prototype.strippedUnreachable = function() {
  this.annotateUnreachables();
  var newRules = [];
  for(var i=0; i<this.rules.length; ++i) {
    var rule = this.rules[i];
    if(!this.symbolMap[rule.name].unreachable) {
      // sufficient that the LHS is unreachable, since RHS does not contain unreachable unless LHS is unreachable
      newRules.push(rule);
    }
  }

  if(newRules.length == 0) {
    return {empty: true};
  }
  
  var newGrammar = Grammar(newRules, this.start);
  if(newGrammar.symbolMap[newGrammar.start].rules.length === 0) {
    return {empty: true}; // nowhere to go: empty.
  }
  assert(newGrammar.annotateUnreachables().length == 0, 'Haven\'t actually eliminated all unreachable productions?');
  
  return newGrammar;
}


// returns a copy of the grammar with unit productions removed (A -> B) removed.
// does not modify the grammar. if the result is empty, returns {empty: true}.
Grammar.prototype.strippedUnitProductions = function() {
  var newRules = [];
  
  var done = [];
  var queue = [];
  function seen(rule) {
    for(var i=0; i<done.length; ++i) {
      if(done[i].equals(rule)) {
        return true;
      }
    }
    for(var i=0; i<queue.length; ++i) {
      if(queue[i].equals(rule)) {
        return true;
      }
    }
    return false;
  }
  
  function enqueue(rule) {
    if(!seen(rule)) {
      queue.push(rule);
    }
  }
  for(var i=0; i<this.rules.length; ++i) {
    var rule = this.rules[i];
    if(rule.production.length !== 1 || rule.production[0].type == 'T') {
      newRules.push(rule);
    }
    else { // rule is of the form A->B
      enqueue(rule);
    }
  }
  
  while(queue.length > 0) {
    var rule = queue.pop();
    done.push(rule);
    var sym = rule.production[0].data; // everything in the queue is a unit production
    if(sym !== rule.name) { // rule is not A->A, which can just be ignored
      for(var j=0; j<this.symbolMap[sym].rules.length; ++j) {
        var origRule = this.symbolMap[sym].rules[j]; // B->whatever
        var newRule = Rule(rule.name, origRule.production.slice(0)); // A->whatever
        if(newRule.production.length !==1 || newRule.production[0].type == 'T') {
          newRules.push(newRule);
        }
        else {
          enqueue(newRule);
        }
      }
    }
  }
  
  if(newRules.length == 0) {
    return {empty: true};
  }
  
  return Grammar(newRules, this.start); // I'm... pretty sure this is correct.
}


// returns a copy of the grammar with duplicate rules removed.
// does not modify the grammar.
Grammar.prototype.strippedDuplicates = function() {
  var newRules = [];
  for(var i=0; i<this.rules.length; ++i) {
    var rule = this.rules[i];
    var j;
    for(j=0; j<newRules.length; ++j) {
      if(newRules[j].equals(rule)) {
        break;
      }
    }
    if(j == newRules.length) {
      newRules.push(rule);
    }
  }
  return Grammar(newRules, this.start);
}

// TODO some testing about the proper order to strip things, to make grammar as small as possible.
// returns a copy of the grammar without useless or unreachable symbols.
// also removes duplicate rules and rules of the form A->B. does not modify the grammar,
// except annotating. if the result is empty, returns {empty: true}.
Grammar.prototype.stripped = function() {
  var newGrammar = this.strippedUnitProductions();
  if(newGrammar.empty) return newGrammar;

  // useless, then unreachable. not the other way around.
  newGrammar = newGrammar.strippedUseless();
  if(newGrammar.empty) return newGrammar;
  
  newGrammar = newGrammar.strippedUnreachable();
  if(newGrammar.empty) return newGrammar;

  assert(newGrammar.annotateUseless().length == 0, 'Suddenly there are more useless symbols?');  
  
  newGrammar = newGrammar.strippedDuplicates();
  return newGrammar;
}




function nthSubset(list, n) { // not exactly the world's most efficient implement, but whatever.
  var out = [];
  for(var i = 0, p = 1; p<=n; ++i, p<<=1) {
    if(p & n) {
      out.push(list[i]);
    }
  }
  return out;
}


// returns a copy of the grammar which recognizes the same language (except without the empty string)
// does not modify the grammar. new grammar has a property 'makesEpsilon' which is true iff epsilon
// was recognized by the original grammar.
// if the language is otherwise empty, returns {empty: true, makesEpsilon: [as appropriate]}
Grammar.prototype.deNulled = function() {

  var newGrammar = this.stripped();
  if(newGrammar.empty) {
    newGrammar.makesEpsilon = false;
    return newGrammar;
  }
  
  newGrammar.annotateNullables();
  var makesEpsilon = newGrammar.symbolMap[newGrammar.start].nullable;
  newRules = [];
  for(var i=0; i<newGrammar.rules.length; ++i) {
    var rule = newGrammar.rules[i];
    if(rule.production.length == 0) {
      continue; // do not add epsilon productions
    }
    var nullableRHSIndices = [];
    for(var j=0; j<rule.production.length; ++j) {
      if(rule.production[j].type == 'NT' && newGrammar.symbolMap[rule.production[j].data].nullable) {
        nullableRHSIndices.push(j);
      }
    }
    
    if(nullableRHSIndices.length == 0) { // don't actually need this case, but meh.
      newRules.push(rule);
      continue;
    }
    
    var skipFinal = (nullableRHSIndices.length == rule.production.length)?1:0; // if all X's are nullable, do not make an epsilon production.
    var lastSubset = Math.pow(2, nullableRHSIndices.length) - skipFinal;
    
    // one new rule for each subset of nullable RHS symbols, omitting precisely that subset
    for(var j = 0; j<lastSubset; ++j) {
      var skippedSubset = nthSubset(nullableRHSIndices, j);
      
      var newProduction = [];
      for(var k=0; k<rule.production.length; ++k) {
        if(skippedSubset.indexOf(k) == -1) {
          newProduction.push(rule.production[k]);
        }
      }
      
      newRules.push(Rule(rule.name, newProduction));
    }
    
  }
  
  if(newRules.length == 0) {
    return {empty: true, makesEpsilon: makesEpsilon};
  }
  
  newGrammar = Grammar(newRules, newGrammar.start);
  assert(newGrammar.annotateNullables().length == 0, 'Having removed nullables, there are still nullables.');
  
  newGrammar = newGrammar.stripped();
  newGrammar.makesEpsilon = makesEpsilon;
  
  
  //newGrammar.printRules();
  assert(newGrammar.empty || newGrammar.annotateSelfDeriving().length == 0, 'Removing nullables and unit productions did not prevent self-deriving, somehow');
  
  return newGrammar;
}

}

},{"./assert":1,"./grammar":4}],4:[function(require,module,exports){
function Sym(type, data) {
  this.type = type;
  this.data = data; 
}
Sym.prototype.equals = function(other) {
  return other.type === this.type && other.data === this.data;
}
Sym.prototype.toString = function(){ 
  return this.data.toString(); //return this.type + '(' + this.data + ')';
}

function NT(data) { return new Sym('NT', data); }
function T(data) { return new Sym('T', data); }

function reprEscape(str) { // does not handle unicode or exceptional cases properly.
  return str.replace(/['\\]/g, function(c) { return '\\' + c; })
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function Rule(name, production) {
  if(!(this instanceof Rule)) return new Rule(name, production);
  this.name = name; // LHS
  this.production = production; // RHS\
}
Rule.prototype.equals = function(other) {
  if(other.name !== this.name) return false;
  if(other.production.length !== this.production.length) return false;
  
  for(var i=0; i<other.production.length; ++i) {
    if(!other.production[i].equals(this.production[i])) return false;
  }
  return true;
}
Rule.prototype.toString = function() {
  return this.name + ' -> ' + this.production.join('');
}
Rule.prototype.repr = function() {
  var out = 'Rule(\'' + reprEscape(this.name) + '\', [';
  for(var i=0; i<this.production.length; ++i) {
    if(i>0) out += ', ';
    out += this.production[i].type + '(\'' + reprEscape(this.production[i].data) + '\')';
  }
  out += '])';
  return out;
}




function Grammar(rules, start) { // if not given, start is LHS of the first rule.
  if(!(this instanceof Grammar)) return new Grammar(rules, start);
  this.rules = rules;
  this.start = start || rules[0].name; // TODO warn
  this.symbolMap = {}; // initially just rules for each symbol; eventually can contain annotations like 'nullable'
  this.symbolsList = start?[start]:[];
  
  if(start) this.symbolMap[start] = {rules: []};
  
  for(var i=0; i<this.rules.length; ++i) {
    var sym = this.rules[i].name;
    if(!(sym in this.symbolMap)) {
      this.symbolMap[sym] = {rules: []};
      this.symbolsList.push(sym);
    }
    
    for(var j=0; j<this.rules[i].production.length; ++j) {
      var rhsSym = this.rules[i].production[j];
      if(rhsSym.type == 'NT' && !(rhsSym.data in this.symbolMap)) {
        this.symbolMap[rhsSym.data] = {rules: []};
        this.symbolsList.push(rhsSym.data);
      }
    }
    this.symbolMap[sym].rules.push(this.rules[i]);
  }
}
Grammar.prototype.repr = function() {
  var out = 'Grammar([\n  ';
  for(var i=0; i<this.rules.length; ++i) {
    if(i>0) out += ',\n  ';
    out += this.rules[i].repr();
  }
  out += '\n], \'' + reprEscape(this.start) + '\')';
  return out;
}


// get a map from symbols to a list of the rules they appear in the RHS of
// if a symbol appears in a RHS more than once, that rule will appear more than once in the list
// modifies the grammar to have _reverseMap property, for caching
Grammar.prototype.getReverseMap = function() {
  if(!this.hasOwnProperty('_reverseMap')) {
    this._reverseMap = {};
    for(var i=0; i<this.symbolsList.length; ++i) {
      this._reverseMap[this.symbolsList[i]] = [];
    }
    for(var i=0; i<this.rules.length; ++i) {
      var rule = this.rules[i];
      for(var j=0; j<rule.production.length; ++j) {
        if(rule.production[j].type === 'NT') {
          this._reverseMap[rule.production[j].data].push(rule);
        }
      }
    }
  }
  
  return this._reverseMap;
}



module.exports = {
  Sym: Sym,
  NT: NT,
  T: T,
  Rule: Rule,
  Grammar: Grammar
}
},{}],5:[function(require,module,exports){
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

},{"./assert":1,"./generate":2,"./grammar":4,"./parser":6,"./printers":7}],6:[function(require,module,exports){
// http://cs.stackexchange.com/questions/40965/cfgs-detecting-infinitely-many-derivations-of-a-single-string
// http://www.cs.laurentian.ca/jdompierre/html/MATH2056E_W2011/cours/s8.4_closures_relations_BW.pdf
// https://a2c2a.wordpress.com/2014/09/18/implementing-an-earley-parser-that-handles-nullable-grammars-and-draws-all-unique-parse-trees-in-python/
// http://web.stanford.edu/~crwong/cfg/grammar.html
// http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm
// TODO wrap in closures, don't pollute global namespace

var assert = require('./assert');
var grammar = require('./grammar');
require('./grammar.algorithms')(grammar.Grammar);

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

// TODO this is not the best way of doing this.
NT = grammar.NT;
T = grammar.T;
Rule = grammar.Rule;
Grammar = grammar.Grammar;


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
  
  parser.PRODUCECOUNT = oldProduceCount;
  return parses;
}

parser.parse = parse;



module.exports = parser;

},{"./assert":1,"./grammar":4,"./grammar.algorithms":3}],7:[function(require,module,exports){
var INDENT = '  ';
function subtreePrinter(state, depth) {
  depth = depth | 0;
  var prefix = '';
  for(var i=0; i<depth; ++i) {
    prefix += INDENT;
  }
  console.log(prefix + state.rule)// + ' ' + state.backPointers.length);
  prefix += INDENT;
  for(var i=0; i<state.backPointers.length; ++i) {
    var backPointer = state.backPointers[i];
    if(backPointer === null) { // ie, terminal
      console.log(prefix + state.rule.production[i].data); 
    }
    else {
      subtreePrinter(backPointer, depth+1);
    }
  }
}


function rewritePrinter(parse) {
  var str = [parse];
  
  function formatIntermediateString(highlightIndex) { // highlightIndex must be a state, not a final symbol
    var o = '';
    for(var i=0; i<str.length; ++i) {
      if(i == highlightIndex) {
        o += '*' + str[i].rule.name + '*';
      }
      else {
        if(typeof str[i] === 'string') {
          o += str[i];
        }
        else {
          o += str[i].rule.name;
        }
      }
    }
    return o;
  }
  
  for(var i = 0; i<str.length; ++i) { // NB: both str.length and i change within the rewrite
    if(typeof str[i] === 'string') {
      continue;
    }
    
    var state = str[i];
    var out = state.rule.toString() + '  |  ';
    out += formatIntermediateString(i) + '  |  ';
    
    var rewritten = [];
    for(var j=0; j<state.index; ++j) {
      if(state.rule.production[j].type == 'T') {
        rewritten.push(state.rule.production[j].data);
      }
      else {
        rewritten.push(state.backPointers[j]);
      }
    }
    str = str.slice(0, i).concat(rewritten).concat(str.slice(i+1));
    out += formatIntermediateString(-1);
    console.log(out);
    --i; // gotta reprocess the index we just rewrote
  }
  
}




// Helper for domRule and domGrammar
// Returns a span representing a RHS.
function domProduction(production) {
  var o = document.createElement('span');
  if(production.length == 0) {
    o.appendChild(document.createTextNode('\u025B')); // epsilon
  }
  else {
    for(var i=0; i<production.length; ++i) {
      if(production[i].type == 'T') {
        o.appendChild(document.createTextNode(production[i].data));
      }
      else {
        var sp = document.createElement('span');
        sp.className = 'cfg-symbol';
        sp.appendChild(document.createTextNode(production[i].data));
        o.appendChild(sp);
      }
    }
  }
  return o;
}

// helper for domPrinter
// create a DOM node representing the rule. obviously only call in browsers.
// symbols get class cfg-symbol, the rule itself class cfg-rule.
function domRule(rule) {
  var o = document.createElement('span');
  o.className = 'cfg-rule';
  
  var sp = document.createElement('span');
  sp.className = 'cfg-symbol';
  sp.appendChild(document.createTextNode(rule.name));
  o.appendChild(sp);
  o.appendChild(document.createTextNode(' \u2192 ')); // right arrow
  
  o.appendChild(domProduction(rule.production));
    
  return o;
}

// create a DOM table representing the entire parse. obviously only call in browsers.
function domPrinter(parse) {
  var str = [parse];
  
  function formatIntermediateString(highlightStart, highlightLength) {
    if(typeof highlightLength !== 'number' || highlightLength < 0) highlightLength = 1;
    
    var o = document.createElement('span');
    c = o;
    for(var i=0; i<str.length; ++i) {
      if(i == highlightStart) {
        c = document.createElement('span');
        c.className = 'cfg-rewrite';
        o.appendChild(c);
      }
      
      if(i - highlightStart >= highlightLength) {
        c = o;
      }
      
      if(typeof str[i] === 'string') {
        c.appendChild(document.createTextNode(str[i]));
      }
      else {
        var sp = document.createElement('span');
        sp.className = 'cfg-symbol';
        sp.appendChild(document.createTextNode(str[i].rule.name));
        c.appendChild(sp);
      }
    }
    return o;
  }

  var out = document.createElement('table');
  out.className = 'cfg-derivations derivations'; // TODO second is for compat
  out.innerHTML = '<thead><tr><th>Rule</th><th>Application</th><th>Result</th></tr></thead>';
  
  
  // handle GAMMA state specially
  var row = document.createElement('tr');
  var cell = document.createElement('td');
  var sp = document.createElement('sp');
  sp.className = 'cfg-rule';
  sp.innerHTML = 'Start \u2192 ' + '<span class="cfg-symbol">' + parse.backPointers[0].rule.name + '</span>';
  cell.appendChild(sp);
  row.appendChild(cell);

  cell = document.createElement('td');
  var sp = document.createElement('span');
  sp.className = 'cfg-start';
  sp.appendChild(document.createTextNode('Start'));
  cell.appendChild(sp);
  row.appendChild(cell);
  
  str = [parse.backPointers[0]]; // ie, start symbol
  cell = document.createElement('td');
  cell.appendChild(formatIntermediateString(-1));
  row.appendChild(cell);
  
  out.appendChild(row);

  
  for(var i = 0; i<str.length; ++i) { // NB: both str.length and i change within the body of the loop
    if(typeof str[i] === 'string') {
      continue;
    }
    
    var state = str[i];

    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.appendChild(domRule(state.rule));
    row.appendChild(cell);
  
    cell = document.createElement('td');
    cell.appendChild(formatIntermediateString(i));
    row.appendChild(cell);
    

    
    var rewritten = [];
    for(var j=0; j<state.index; ++j) {
      if(state.rule.production[j].type == 'T') {
        rewritten.push(state.rule.production[j].data);
      }
      else {
        rewritten.push(state.backPointers[j]);
      }
    }
    str = str.slice(0, i).concat(rewritten).concat(str.slice(i+1));

    cell = document.createElement('td');
    cell.appendChild(formatIntermediateString(i, rewritten.length));
    row.appendChild(cell);
    out.appendChild(row);

    --i; // gotta reprocess the index we just rewrote
  }
  
  return out;
}



function escapeHTML(str) {
  // not my preferred solution, but whatever.
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// create a DOM div representing the entire parse. obviously only call in browsers.
function domGrammarPrinter(grammar) {
  var o = document.createElement('div');
  var line = document.createElement('span');
  line.innerHTML = 'Start symbol: <span class="cfg-symbol">' + escapeHTML(grammar.start) + '</span>';
  o.appendChild(line);
  o.appendChild(document.createElement('br'));
  
  for(var i=0; i<grammar.symbolsList.length; ++i) {
    var sym = grammar.symbolsList[i];
    line = document.createElement('span');
    var sp = document.createElement('span');
    sp.className = 'cfg-symbol';
    sp.appendChild(document.createTextNode(sym));
    line.appendChild(sp);
    line.appendChild(document.createTextNode(' \u2192 '));
    for(var j=0; j<grammar.symbolMap[sym].rules.length; ++j) {
      if(j > 0) {
        line.appendChild(document.createTextNode(' | '));
      }
      var rule = grammar.symbolMap[sym].rules[j];
      line.appendChild(domProduction(rule.production));
    }
    o.appendChild(line);
    o.appendChild(document.createElement('br'));
  }
  
  return o;
}


module.exports = {
  subtreePrinter: subtreePrinter,
  rewritePrinter: rewritePrinter,
  domPrinter: domPrinter,
  domGrammarPrinter: domGrammarPrinter
}
},{}]},{},[5]);
