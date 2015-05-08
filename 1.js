// http://cs.stackexchange.com/questions/40965/cfgs-detecting-infinitely-many-derivations-of-a-single-string
// http://www.cs.laurentian.ca/jdompierre/html/MATH2056E_W2011/cours/s8.4_closures_relations_BW.pdf
// https://a2c2a.wordpress.com/2014/09/18/implementing-an-earley-parser-that-handles-nullable-grammars-and-draws-all-unique-parse-trees-in-python/
// http://web.stanford.edu/~crwong/cfg/grammar.html
// http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm

var DEBUG = false;
var PRODUCEALL = false;

// library code, woo
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}




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


function Rule(name, production) {
  if (!(this instanceof Rule)) return new Rule(name, production);
  this.name = name; // LHS
  this.production = production; // RHS\
  // once added to a grammar, also have an 'index' property indicating their location in the grammar
  // corollary: do not add a rule to more than one grammar
}
Rule.prototype.toString = function(){
  return this.name + ' -> ' + this.production.join('');
}




if(DEBUG) {
  var _id = 0;
  function id(){
    return ++_id;
  }
}

function State(rule, index, predecessor, backPointers) {
  if (!(this instanceof State)) return new State(rule, index, predecessor, backPointers);
  this.rule = rule;
  this.index = index;
  this.predecessor = predecessor;
  this.backPointers = backPointers || [];
  if (DEBUG) this.id = id();
  assert(this.index == this.backPointers.length); // honestly could just do away with index at this point
}
State.prototype.done = function(){ return this.index === this.rule.production.length; }
State.prototype.equals = function(other) {
  return this.rule === other.rule
    && this.index === other.index
    && this.predecessor === other.predecessor
    && (!PRODUCEALL || arraysEqual(this.backPointers, other.backPointers)); // logically, 'produceall => backpointers equal', otherwise we don't care
}
State.prototype.next = function(){ return this.rule.production[this.index]; } 
State.prototype.toString = function(){
  return '(' + (DEBUG?(this.id.toString() + ' '):'') + this.rule.name + ' -> ' + this.rule.production.slice(0, this.index).join('')
          + '*' + this.rule.production.slice(this.index).join('') + ', ' + this.predecessor.toString() 
          + (DEBUG?(', [' + this.backPointers.map(function(x){return x===null?'null':x.id.toString();}).join(',') + ']'):'') + ')';
}





function Grammar(rules) {
  if (!(this instanceof Grammar)) return new Grammar(rules);
  this.rules = rules;
  this.start = rules[0].name;
  this.symbolMap = {}; // initially just rules for each symbol; eventually can contain annotations like 'nullable'
  this.symbolsList = [];
  
  for(var i=0; i<this.rules.length; ++i) {
    this.rules[i].index = i;
    var sym = this.rules[i].name;
    if(!(sym in this.symbolMap)) {
      this.symbolMap[sym] = {rules: []};
      this.symbolsList.push(sym);
    }
    this.symbolMap[sym].rules.push(this.rules[i]);
  }
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
  
  while(queue.length > 0) {
    var cur = queue.pop();
    for(var i=0; i<rMap[cur].length; ++i) {
      var affected = rMap[cur][i];
      if(--cs[affected.index] === 0 && !this.symbolMap[affected.name].nullable) { // can only have been positive if the rule contained no terminals, so ok
        this.symbolMap[affected.name].nullable = true;
        queue.push(affected.name);
        this.nullables.push(affected.name);
      }
    }
  }
  
  return this.nullables;
}











function parse(str, grammar) {
  var queue = [];
  for(var i=0; i<=str.length; ++i) queue.push([]);
  
  function seen(state, strPos) {
    for (var i=0; i<queue[strPos].length; ++i) {
      if (state.equals(queue[strPos][i])) {
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
        queue[strPos+1].push(advanced);
      }
    }
  }
  
  
  function predictor(state, strPos) {
    var sym = state.next();
    for(var i=0; i<grammar.symbolMap[sym.data].rules.length; ++i) {
      var advanced = State(grammar.symbolMap[sym.data].rules[i], 0, strPos);
      if(!seen(advanced, strPos)) {
        queue[strPos].push(advanced);
      }
    }
    
    // handle silly nullable cornercase: we might need to "re-run" completer for a nullable
    // if we are predicting that nullable but it's already been processed
    // given 'nullable' annotation, we could skip this when 'sym' is not nullable
    for(var i=0; i<queue[strPos].length; ++i) { // can actually abort when we hit current state, but no real need (todo check speedup)
      var candidate = queue[strPos][i];
      if(candidate.rule.name === sym.data && candidate.predecessor === strPos && candidate.done()) {
        var newBPs = state.backPointers.slice(0);
        newBPs.push(candidate); // 'candidate' is already done
        var advanced = State(state.rule, state.index+1, state.predecessor, newBPs);
        if(!seen(advanced, strPos)) {
          queue[strPos].push(advanced);
        }
      }
    }
    
  }
  
  
  function completer(state, strPos) {
    var thisSym = NT(state.rule.name);
    for(var i=0; i<queue[state.predecessor].length; ++i) {
      var prevState = queue[state.predecessor][i];
      if(!prevState.done() && thisSym.equals(prevState.next())) {
        var newBPs = prevState.backPointers.slice(0);
        newBPs.push(state); // just finished 'state'
        var advanced = State(prevState.rule, prevState.index+1, prevState.predecessor, newBPs);
        if(!seen(advanced, strPos)) {
          queue[strPos].push(advanced);
        }
      }      
    }
  }
  
  
  
  
  
  var startSym = grammar.start;
  var gammaRule = Rule(['GAMMA'], [NT(startSym)]); // needs a _unique_ identifier. Easiest way: new object
  queue[0].push(State(gammaRule, 0, 0));
  
  for(var i=0; i<=str.length; ++i) {
    if (DEBUG) console.log('processing position ' + i)
  
    for(var j=0; j<queue[i].length; ++j) {
      var state = queue[i][j];
      if (DEBUG) console.log('state ', state.toString())
      if(!state.done()) {
        if(state.next().type == 'NT') {
          if (DEBUG) console.log('p')
          predictor(state, i);
        }
        else {
          if (DEBUG) console.log('s', state.next())
          scanner(state, i);
        }
      }
      else {
        if (DEBUG) console.log('c')
        completer(state, i);
      }
    }
  }
  
  
  
  // done constructing chart; time to check for parses
  var parses = [];
  for(var i=0; i<queue[str.length].length; ++i) {
    var state = queue[str.length][i];
    if(state.rule === gammaRule && state.done()) {
      parses.push(state);
    }
  }
  //if (DEBUG)
    console.log(parses.length);
  
  
  
  var INDENT = '  ';
  function subtreePrinter(state, depth) {
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
  
  for(var i=0; i<parses.length; ++i) {
    console.log();
    subtreePrinter(parses[i], 0);
  }
  
  
  return queue;
}


var grammar = [
  Rule('S', [ NT('T'), T('+'), NT('T')]),
  Rule('S', [T('i')]),
  Rule('T', [NT('S')])
]

//parse('i+i+i+i', grammar).join('\n')

var grammar = Grammar([
  Rule('S', [NT('A'), NT('A'), NT('A'), NT('A')]),
  Rule('A', [T('a')]),
  Rule('A', []),
  Rule('A', [NT('E')]),
  Rule('E', [])
])

//console.log(grammar.annotateNullables())
//console.log(grammar.symbolMap);
//parse('a', grammar).join('\n')

var grammar = Grammar([
  Rule('S', [NT('X'), NT('S'), NT('X')]),
  Rule('S', [NT('A')]),
  Rule('A', [T('a'), NT('T'), T('b')]),
  Rule('A', [T('b'), NT('T'), T('a')]),
  Rule('X', [T('a')]),
  Rule('X', [T('b')]),
  Rule('T', [NT('X'), NT('T')]),
  Rule('T', [])
])

//console.log(grammar.annotateNullables())
//console.log(grammar.symbolMap);
//parse('aabaaabaaa', grammar).join('\n')

var grammar = [
  Rule('S', [NT('S'), NT('S')]),
  Rule('S', [])
]

//parse('', grammar)


var grammar = Grammar([
  Rule('A', [NT('A'), NT('A')]),
  Rule('A', [T('a')]),
  Rule('A', [NT('B')]),
  Rule('B', [T('b')]),
  Rule('B', [])
])

parse('b', grammar)

console.log(grammar.annotateNullables())
console.log(grammar.symbolMap);
