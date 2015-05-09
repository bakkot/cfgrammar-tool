// A grammar for context-free grammars. BECAUSE I CAN (and to automate testing).
// Specifically, for five-or-fewer-symbol CFGs over [x,y,z].
// Only to be used for generation, not parsing (because I don't want to split up the terminal strings)

var grammarTypes = require('./grammar');
NT = grammarTypes.NT;
T = grammarTypes.T;
Rule = grammarTypes.Rule;
Grammar = grammarTypes.Grammar;

module.exports = Grammar([
  Rule('Grammar', [T('Grammar([\n  '), NT('Rule'), NT('RulesList'), T('\n]);')]),
  Rule('RulesList', [T(',\n  '), NT('Rule'), NT('RulesList')]),
  Rule('RulesList', []),
  Rule('Rule', [T('Rule(\''), NT('NT'), T('\', ['), NT('OptionalSymList'), T('])')]),
  Rule('OptionalSymList', [NT('Sym'), NT('SymList')]),
  Rule('OptionalSymList', []),
  Rule('SymList', [T(', '), NT('Sym'), NT('SymList')]),
  Rule('SymList', []),
  Rule('Sym', [T('T(\''), NT('T'), T('\')')]),
  Rule('Sym', [T('NT(\''), NT('NT'), T('\')')]),
  Rule('T', [T('x')]),
  Rule('T', [T('y')]),
  Rule('T', [T('z')]),
  Rule('NT', [T('A')]),
  Rule('NT', [T('B')]),
  Rule('NT', [T('C')]),
  Rule('NT', [T('D')]),
  Rule('NT', [T('E')])
])