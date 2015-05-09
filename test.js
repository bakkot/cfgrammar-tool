var parse = require('./parser').parse;
var subtreePrinter = require('./printers').subtreePrinter;
var rewritePrinter = require('./printers').rewritePrinter;
var generator = require('./generate');

var grammar3 = Grammar([
  Rule('S', [ NT('T'), T('+'), NT('T')]),
  Rule('S', [T('i')]),
  Rule('T', [NT('S')])
])

//parse('i+i+i+i', grammar3).join('\n')

var grammar2 = Grammar([
  Rule('S', [NT('A'), NT('A'), NT('A'), NT('A')]),
  Rule('A', [T('a')]),
  Rule('A', []),
  Rule('A', [NT('E')]),
  Rule('E', [])
])

//console.log(grammar2.annotateNullables())
//console.log(grammar2.symbolMap);
//parse('a', grammar2).join('\n')

var grammar1 = Grammar([
  Rule('S', [NT('X'), NT('S'), NT('X')]),
  Rule('S', [NT('A')]),
  Rule('A', [T('a'), NT('T'), T('b')]),
  Rule('A', [T('b'), NT('T'), T('a')]),
  Rule('X', [T('a')]),
  Rule('X', [T('b')]),
  Rule('T', [NT('X'), NT('T')]),
  Rule('T', [])
])

//console.log(grammar1.annotateNullables())
//console.log(grammar1.symbolMap);
//parse('aabaaabaaa', grammar1).join('\n')

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
//parse('aaa', grammar);

/*
console.log(grammar.annotateUnreachables())
console.log(grammar.annotateNullables())
console.log(grammar.annotateUseless())
console.log(grammar.annotateSelfDeriving())
//*/


var grammar4 = Grammar([
  Rule('A', [NT('B'), NT('B')]),
  Rule('A', [NT('B')]),
  Rule('B', [T('b')]),
  Rule('B', [NT('A')]),
  Rule('B', [])
])




/*
o = grammar1.deNulled()
for(var i=0; i<o.rules.length; ++i) {
  console.log(o.rules[i].toString())
}


var parses = parse('aabaaabaaa', grammar1);
for(var i=0; i<parses.length; ++i) {
  rewritePrinter(parses[i]);
}
console.log()
var parses = parse('aabaaabaaa', o);
for(var i=0; i<parses.length; ++i) {
  rewritePrinter(parses[i]);
}

*/


x = grammar4.deNulled();
x.printRules()
console.log(x.annotateSelfDeriving())
console.log(grammar4.annotateSelfDeriving())

f = generator(grammar4);
console.log(f(4));



// TODO some testing about the proper order to strip things, to make grammar as small as possible.