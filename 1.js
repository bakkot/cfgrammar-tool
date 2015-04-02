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



function Rule(name, production) {
  if (!(this instanceof Rule)) return new Rule(name, production);
  this.name = name;
  this.production = production;
}
Rule.prototype.toString = function(){
  return this.name + ' -> ' + this.production.join('');
}



function State(rule, index, predecessor, backPointers) {
  if (!(this instanceof State)) return new State(rule, index, predecessor, backPointers);
  this.rule = rule;
  this.index = index;
  this.predecessor = predecessor;
  this.backPointers = backPointers || [];
  assert(this.index == this.backPointers.length); // honestly could just do away with index at this point
}
State.prototype.done = function(){ return this.index === this.rule.production.length; }
State.prototype.equals = function(other) {
  return this.rule === other.rule
    && this.index === other.index
    && this.predecessor === other.predecessor
    && arraysEqual(this.backPointers, other.backPointers);
}
State.prototype.next = function(){ return this.rule.production[this.index]; } 
State.prototype.toString = function(){
  return '(' + this.rule.name + ' -> ' + this.rule.production.slice(0, this.index).join('')
          + '*' + this.rule.production.slice(this.index).join('') + ', ' + this.predecessor.toString() + ')';
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
  }
  
  
  function completer(state, strPos) {
    var thisSym = NT(state.rule.name);
    for(var i=0; i<queue[state.predecessor].length; ++i) {
      var prevState = queue[state.predecessor][i];
      if(thisSym.equals(prevState.next())) {
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
  for(var i=0; i<rulesMap[startSym].length; ++i) {
    queue[0].push(State(rulesMap[startSym][i], 0, 0));
  }
  
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
  
  return queue;
}


var grammar = [
  Rule('S', [ NT('T'), T('+'), NT('T')]),
  Rule('S', [T('i')]),
  Rule('T', [NT('S')])
]

console.log(parse('i+i+i', grammar).join('\n'));