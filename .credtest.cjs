const fs = require('fs');
const YAML = require('C:/Users/Chris/.dsh/profiles/node_modules/js-yaml');
const path = 'C:/Users/Chris/.dsh/.credentials.yaml';
const text = fs.readFileSync(path, 'utf8');
console.log('--- raw repr ---');
console.log(JSON.stringify(text));
let root;
try { root = YAML.load(text); console.log('parse OK'); }
catch (e) { console.log('PARSE FAIL:', e.message); process.exit(1); }
console.log('--- parsed ---');
console.log(JSON.stringify(root, null, 1));
// simulate Rust validate_document
function isRef(name){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name); }
function validate(root){
  if (root === null || root === undefined) return null;
  if (typeof root !== 'object' || Array.isArray(root)) return 'root must be mapping';
  if (root.version === undefined) return 'missing version (flat layout)';
  if (root.version !== 1) return 'version must equal 1, got ' + JSON.stringify(root.version);
  for (const k of Object.keys(root)) if (!['version','refs','records'].includes(k)) return 'unknown top key "'+k+'"';
  const refs = root.refs;
  if (refs === undefined || refs === null) return null;
  if (typeof refs !== 'object' || Array.isArray(refs)) return '"refs" must be mapping';
  for (const [k,v] of Object.entries(refs)) {
    if (!isRef(k)) return 'refs key "'+k+'" invalid';
    if (typeof v !== 'string' || v.length === 0) return 'refs "'+k+'" value must be non-empty string, got '+JSON.stringify(v);
  }
  return null;
}
const problem = validate(root);
console.log('validate:', problem === null ? 'PASS' : 'FAIL: ' + problem);
