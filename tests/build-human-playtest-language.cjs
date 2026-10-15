// Offline, general-language preparation. No puzzle, gameplay log or answer input.
// node tests/build-human-playtest-language.cjs /path/to/downloaded-moby-files
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),source=process.argv[2];
if(!source)throw Error('Supply directory containing compound.txt, mobypos.txt, names-m.txt, names-f.txt');
const freq=new Map();
for(const [n,words] of JSON.parse(fs.readFileSync(path.join(root,'assets/language/english-frequency.json'))).bins)
  for(const w of words.split(' '))freq.set(w,n/100);
const dictionary=new Set(fs.readFileSync(path.join(root,'assets/dictionary/en_US-size-60.txt'),'utf8').split(/\r?\n/));
const hashes={},read=name=>{const bytes=fs.readFileSync(path.join(source,name));hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');return bytes.toString('latin1').split(/\r?\n/);};
const pos={};
for(const line of read('mobypos.txt')) {
  const [word,codes]=line.split('\\');
  if(codes&&/^[a-z]+$/.test(word)&&dictionary.has(word)&&(freq.get(word)||0)>=3)pos[word]=codes;
}
const names={},maleNames=new Set(),femaleNames=new Set();
for(const [file,membership] of [['names-m.txt',maleNames],['names-f.txt',femaleNames]]) for(const line of read(file)) {
  const name=line.trim(),w=name.toLowerCase();
  if(name)membership.add(w);
  if(/^[A-Z][a-z]+$/.test(name)&&dictionary.has(name)&&(freq.get(w)||0)>=3) {
    names[w]=Math.min(5.5,freq.get(w));
  }
}
const nameSourceMembership=Object.fromEntries([...new Set([...maleNames,...femaleNames])].sort().map(name=>[
  name,maleNames.has(name)&&femaleNames.has(name)?'B':maleNames.has(name)?'M':'F'
]));
const phrases=new Set(),punctuated=new Set();
for(const raw of read('compound.txt')) {
  const phrase=raw.trim();
  if(/^[a-z]+(?: [a-z]+){1,2}$/.test(phrase)) {
    const words=phrase.split(' ');
    if(words.every(w=>dictionary.has(w)&&(freq.get(w)||0)>=3.4))phrases.add(phrase);
  }
  if(/^[a-z]+(?:-[a-z]+){1,2}$/.test(phrase)&&phrase.split('-').every(w=>dictionary.has(w)&&(freq.get(w)||0)>=4))punctuated.add(phrase);
}
const data={format:'ggg-human-language-v1',source:'Grady Ward, Moby Words II and Part-of-Speech II; existing ESDB and wordfreq',license:'CC-BY-SA-4.0 extract; Moby source public domain by author grant, January 2001',hashes,
  pos,names,nameSourceMembership,phrases:[...phrases].sort(),punctuated:[...punctuated].sort()};
fs.writeFileSync(path.join(root,'assets/language/human-playtest-language.json'),JSON.stringify(data)+'\n');
console.log({pos:Object.keys(pos).length,names:Object.keys(names).length,phrases:phrases.size,punctuated:punctuated.size,bytes:JSON.stringify(data).length});
