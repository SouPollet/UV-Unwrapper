const fs = require('fs');
const code = fs.readFileSync('public/xatlas_web.js', 'utf8');
const obj = { self: {} };
new Function('self', code)(obj.self);
console.log("type:", typeof obj.self.XAtlas);
if (typeof obj.self.XAtlas === 'function') {
    const res = obj.self.XAtlas();
    console.log("invoked result type:", typeof res);
    console.log("invoked keys:", res ? Object.keys(res) : 'none');
} else {
    console.log("keys:", Object.keys(obj.self.XAtlas));
}
