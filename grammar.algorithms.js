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
