// scripts/checar-paginas.mjs — confere a sintaxe de todo JavaScript das páginas .html e .js do site (usado no CI)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import vm from "node:vm";

const IGNORAR = new Set([".git", "node_modules", "supabase", "qa", "scripts", ".github"]);
const erros = [];
function andar(dir) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { andar(p); continue; }
    const ext = extname(p);
    if (ext === ".js") checar(readFileSync(p, "utf8"), p);
    if (ext === ".html") {
      const html = readFileSync(p, "utf8");
      const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
      let m, i = 0;
      while ((m = re.exec(html))) {
        i++;
        if (/type=["']?(module|application\/(ld\+)?json|text\/plain)/i.test(m[1])) continue;
        checar(m[2], `${p} (script ${i})`);
      }
    }
  }
}
function checar(codigo, onde) {
  try { new vm.Script(codigo, { filename: onde }); } catch (e) { erros.push(`${onde}: ${e.message}`); }
}
andar(process.cwd());
if (erros.length) { console.error("Erros de sintaxe:\n" + erros.join("\n")); process.exit(1); }
console.log("Sintaxe ok em todas as páginas.");
