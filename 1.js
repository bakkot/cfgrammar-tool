// http://cs.stackexchange.com/questions/40965/cfgs-detecting-infinitely-many-derivations-of-a-single-string
// http://www.cs.laurentian.ca/jdompierre/html/MATH2056E_W2011/cours/s8.4_closures_relations_BW.pdf
// https://a2c2a.wordpress.com/2014/09/18/implementing-an-earley-parser-that-handles-nullable-grammars-and-draws-all-unique-parse-trees-in-python/
// http://web.stanford.edu/~crwong/cfg/grammar.html
// http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm

var enums = {
  DISTINCT: {},
  SIMILAR: {},
  IDENTICAL: {}, // ie, same rule, index, and predecessor, but different sub-parses
  PRODUCEONE: {},
  PRODUCETWO: {},
  PRODUCEALL: {}
}



var DEBUG = false;
var PRODUCECOUNT = enums.PRODUCETWO;





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

function assert(condition, message) {
  if(!condition) {
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
  if(!(this instanceof Rule)) return new Rule(name, production);
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





function Grammar(rules) {
  if(!(this instanceof Grammar)) return new Grammar(rules);
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
  
  while(queue.length > 0) {
    var cur = queue.pop();
    for(var i=0; i<rMap[cur].length; ++i) {
      var affected = rMap[cur][i];
      if(--cs[affected.index] === 0 && this.symbolMap[affected.name].useless) {
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
          derives[this.symbolsList[i]][this.symbolsList[j]];
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


function parse(str, grammar) { // TODO change order, jeebus
  var queue = [];
  for(var i=0; i<=str.length; ++i) queue.push([]);
  
  function seen(state, strPos) {
    var count = 0;
    for(var i=0; i<queue[strPos].length; ++i) {
      var equalness = state.compare(queue[strPos][i]);
      if(equalness == enums.IDENTICAL || (equalness == enums.SIMILAR && PRODUCECOUNT == enums.PRODUCEONE)) { // either we've seen this exact thing before, or we've seen this modulo different parses and don't care about different parses
        return true;
      }
      if(equalness == enums.SIMILAR && PRODUCECOUNT == enums.PRODUCETWO && ++count > 1) { // we've seen something similar and do care
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
    if(DEBUG) console.log('processing position ' + i)
  
    for(var j=0; j<queue[i].length; ++j) {
      var state = queue[i][j];
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
  
  
  
  // done constructing chart; time to check for parses
  var parses = [];
  for(var i=0; i<queue[str.length].length; ++i) {
    var state = queue[str.length][i];
    if(state.rule === gammaRule && state.done()) {
      parses.push(state);
    }
  }
  //if(DEBUG)
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
  
  
  for(var i=0; i<parses.length; ++i) {
    console.log();
    subtreePrinter(parses[i], 0);
    rewritePrinter(parses[i]);
  }
  
  
  return parses;
}




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
  
  if(rule.production.length == 0) {
    o.appendChild(document.createTextNode('\u025B')); // epsilon
  }
  else {
    for(var i=0; i<rule.production.length; ++i) {
      if(rule.production[i].type == 'T') {
        o.appendChild(document.createTextNode(rule.production[i].data));
      }
      else {
        sp = document.createElement('span');
        sp.className = 'cfg-symbol';
        sp.appendChild(document.createTextNode(rule.production[i].data));
        o.appendChild(sp);
      }
    }
  }
  
  return o;
}

// create a DOM table representing the entire parse. obviously only call in browsers.
function domPrinter(parse) {
  var str = [parse];
  
  function formatIntermediateString(highlightIndex) { // highlightIndex must be a state, not a final symbol
    var o = document.createElement('span');
    for(var i=0; i<str.length; ++i) {
      if(typeof str[i] === 'string') {
        o.appendChild(document.createTextNode(str[i]));
      }
      else {
        var sp = document.createElement('span');
        sp.className = 'cfg-symbol';
        if(i == highlightIndex) {
          sp.className += ' cfg-rewrite';
        }
        sp.appendChild(document.createTextNode(str[i].rule.name));
        o.appendChild(sp);
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
  sp.className = 'cfg-start';
  sp.appendChild(document.createTextNode('Start'));
  cell.appendChild(sp);
  row.appendChild(cell);

  cell = document.createElement('td');
  var sp = document.createElement('span');
  sp.className = 'cfg-rule';
  sp.innerHTML = 'Start \u2192 ' + parse.backPointers[0].rule.name;
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
    cell.appendChild(formatIntermediateString(-1));
    row.appendChild(cell);
    out.appendChild(row);

    --i; // gotta reprocess the index we just rewrote
  }
  
  return out;
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
parse('aabaaabaaa', grammar).join('\n')

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
  Rule('B', []),
  Rule('C', [NT('A'), NT('C')]),
  Rule('D', [NT('A')])
])


//console.log(grammar.annotateNullables())
//console.log(grammar.symbolMap);
parse('aaa', grammar);

console.log(grammar.annotateUnreachables())
console.log(grammar.annotateNullables())
console.log(grammar.annotateUseless())
console.log(grammar.annotateSelfDeriving())
