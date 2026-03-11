const vm = require('vm');
const fs = require('fs');

const code = fs.readFileSync('public/xatlas_web.js', 'utf8');

const ctx = {
  self: {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console
};

ctx.self.addEventListener = function() {}; // stub for comlink

vm.createContext(ctx);
try {
  vm.runInContext(code, ctx);
} catch (e) {
  console.log("Error:", e);
}

if (ctx.self && ctx.self.XAtlas) {
    console.log('type of self.XAtlas:', typeof ctx.self.XAtlas);
    if (typeof ctx.self.XAtlas === 'object') {
      console.log('keys in self.XAtlas:', Object.keys(ctx.self.XAtlas));
    } else if (typeof ctx.self.XAtlas === 'function') {
      console.log('toString:', ctx.self.XAtlas.toString().substring(0, 100));
      console.log('keys of function:', Object.keys(ctx.self.XAtlas));
      const result = ctx.self.XAtlas();
      console.log('result of XAtlas():', typeof result, result ? Object.keys(result) : null);
    }
} else {
    console.log("XAtlas not found on self.");
}
