var DEBUG = false;

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


var EPSILON = {}; // a tag for epsilon productions

function Rule(name, production) {
  if (!(this instanceof Rule)) return new Rule(name, production);
  this.name = name;
  this.production = production;
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
State.prototype.done = function(){ return this.rule.production === EPSILON || this.index === this.rule.production.length; }
State.prototype.equals = function(other) {
  return this.rule === other.rule
    && this.index === other.index
    && this.predecessor === other.predecessor
    && arraysEqual(this.backPointers, other.backPointers);
}
State.prototype.next = function(){ return this.rule.production[this.index]; } 
State.prototype.toString = function(){
  return '(' + (DEBUG?(this.id.toString() + ' '):'') + this.rule.name + ' -> ' + this.rule.production.slice(0, this.index).join('')
          + '*' + this.rule.production.slice(this.index).join('') + ', ' + this.predecessor.toString() 
          + (DEBUG?(', [' + this.backPointers.map(function(x){return x.id.toString();}).join(',') + ']'):'') + ')';
}








function parse(str, grammar) {
  var rulesMap = {};
  for(var i=0; i<grammar.length; ++i) {
    var sym = grammar[i].name;
    if(!(sym in rulesMap)) {
      rulesMap[sym] = [];
    }
    rulesMap[sym].push(grammar[i]);
  }


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
    for(var i=0; i<rulesMap[sym.data].length; ++i) {
      var advanced = State(rulesMap[sym.data][i], 0, strPos);
      if(!seen(advanced, strPos)) {
        queue[strPos].push(advanced);
      }
    }
    
    // handle silly nullable cornercase
    for(var i=0; i<queue[strPos].length; ++i) { // can actually abort when we hit current state, but no real need (todo check speedup)
      var candidate = queue[strPos][i];
      if(candidate.rule.name === sym.data && candidate.predecessor === strPos && candidate.done()) {
        //console.log('asdf', candidate);
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
  
  
  
  
  
  var startSym = grammar[0].name;
  var gammaRule = Rule(['GAMMA'], [NT(startSym)]); // needs a _unique_ identifier. Easiest way: new object
  queue[0].push(State(gammaRule, 0, 0));
//  for(var i=0; i<rulesMap[startSym].length; ++i) {
//    queue[0].push(State(rulesMap[startSym][i], 0, 0));
//  }
  
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

//console.log(parse('i+i+i+i', grammar).join('\n'));

var grammar = [
  Rule('S', [NT('A'), NT('A'), NT('A'), NT('A')]),
  Rule('A', [T('a')]),
  Rule('A', []),
  Rule('A', [NT('E')]),
  Rule('E', [])
]


console.log(parse('a', grammar).join('\n'));