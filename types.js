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