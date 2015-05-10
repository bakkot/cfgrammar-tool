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
  
  return generate;
}


module.exports = generator;