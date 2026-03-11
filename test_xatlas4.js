const fs = require('fs');
const code = fs.readFileSync('public/xatlas_web.js', 'utf8');
const scope = { self: {} };
new Function('self', code)(scope.self);
console.log(Object.keys(scope.self.XAtlas));
console.log(typeof scope.self.XAtlas);
if (typeof scope.self.XAtlas === 'object') {
    console.log("XAtlas has XAtlasAPI?", !!scope.self.XAtlas.XAtlasAPI);
}
