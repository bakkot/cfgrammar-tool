CFGrammar-Tool
==============

A JavaScript library for working with [context-free grammars](http://en.wikipedia.org/wiki/Context-free_grammar). It's also a node.js module (`npm install cfgrammar-tool`).


Features
--------

* Parsing. The implementation is [Earley's algorithm](http://en.wikipedia.org/wiki/Earley_parser), so arbitrary CFGs are supported without transformation. Optionally keep track of two parses or all parses, so as to catch ambiguity. Note that tracking all parses can take exponential or infinite time (though the latter possibility can be detected in advance).

* Generation. Given a grammar, generate a string of length *n* in its language. All such strings are generated with non-zero probability, and if the grammar is unambiguous and does not contain nullable nonterminals then strings are generated uniformly at random. Requires *n*^2 preprocessing time, then linear time for each string.
 - Useful for automatic testing when QuickCheck and its ilk aren't generating sufficiently structured data. For example, `test.js` contains a CFG for CFGs, which was used to automatically test this very application. 

* Diagnostics and manipulation. Find/remove unreachable symbols, symbols which do not generate any string, nullable symbols, duplicate rules, unit productions (A -> B), etc.


Example
-------

```javascript
var cfgtool = require('cfgrammar-tool');
var types = cfgtool.types;
var parser = cfgtool.parser;
var generatorFactory = cfgtool.generator;

var Grammar = types.Grammar;
var Rule = types.Rule;
var T = types.T;
var NT = types.NT;
var exprGrammar = Grammar([
  Rule('E', [NT('E'), T('+'), NT('T')]),
  Rule('E', [NT('T')]),
  Rule('T', [NT('T'), T('*'), NT('F')]),
  Rule('T', [NT('F')]),
  Rule('F', [T('('), NT('E'), T(')')]),
  Rule('F', [T('n')])
]);

parser.parse(exprGrammar, 'n*(n+n)').length > 0; // true
parser.parse(exprGrammar, 'n(n+n)').length > 0; // false

var generator = generatorFactory(exprGrammar);
generator(21); // something like 'n*((n+(n)*n+n+n*n))*n'
```

TODO
----

* General code cleanup; this was mostly written in a couple of marathon sessions to try to get a tool based on it up, and the haste shows. Strict mode and linting, too.

* Normal forms: put a grammar in [Chomsky normal form](http://en.wikipedia.org/wiki/Chomsky_normal_form), [Greibach normal form](http://en.wikipedia.org/wiki/Greibach_normal_form), or others.

* Import and export: parse and produce [BNF](http://en.wikipedia.org/wiki/Backus%E2%80%93Naur_Form) and other representations of grammars.

* Automatic tokenization. Currently all tokens are implicitly single-character strings, at least on the parsing end, which is often not what you want.

* ~~[Port to a language with a proper type system](https://github.com/bakkot/cfgrammar)~~.

* Put up a demo page on gh-pages.

License
-------

Licensed under the [MIT license](http://opensource.org/licenses/MIT). If you're making public or commercial use of this library, I encourage (but do not require) you to tell me about it!
