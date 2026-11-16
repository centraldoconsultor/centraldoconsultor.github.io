// qa/smoke.spec.js — agente de QA (teste de fumaça) da Central do Consultor
// Passa pelas telas públicas, pelas telas de login e (com conta de QA) por todas as abas da Central,
// no computador e no celular. Falha se: página não abre, erro de JavaScript, resposta 5xx,
// tela vazia, rolagem para o lado no celular, ou função protegida aceitando acesso sem login.
const { test, expect } = require("@playwright/test");

const SITE = process.env.SITE || "https://centralconsultorsaude.com.br";
const FN = "https://tqhrjivlfpexmhkwakwl.supabase.co/functions/v1/";
const ABAS = ["hoje", "prospeccao", "followup", "esteira", "posvenda", "clientes", "cotador", "comissoes", "feedback", "cronograma"];
const PUBLICAS = ["/", "/assinar/", "/termos/", "/privacidade/", "/exclusao-de-dados/", "/teste-ia/", "/proposta/", "/central/", "/central/cotador.html", "/caixa/", "/admin/"];

function vigiar(page) {
  const erros = [];
  page.on("pageerror", (e) => erros.push("JS: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500) erros.push(`HTTP ${r.status()} ${r.url()}`); });
  return erros;
}

for (const tela of [{ nome: "computador", w: 1280, h: 800 }, { nome: "celular", w: 390, h: 844 }]) {
  test.describe(`Telas (${tela.nome})`, () => {
    test.use({ viewport: { width: tela.w, height: tela.h } });

    for (const p of PUBLICAS) {
      test(`abre ${p}`, async ({ page }) => {
        const erros = vigiar(page);
        const r = await page.goto(SITE + p, { waitUntil: "load" });
        expect(r.status(), "status da página").toBeLessThan(400);
        await page.waitForTimeout(1500);
        await expect(page.locator("body")).not.toBeEmpty();
        const larg = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(larg, "rolagem para o lado").toBeLessThanOrEqual(2);
        expect(erros).toEqual([]);
      });
    }

    test("prévia do link da proposta (WhatsApp)", async ({ request }) => {
      const html = await (await request.get(SITE + "/proposta/")).text();
      expect(html).toContain('property="og:image"');
      expect((await request.get(SITE + "/img/og-proposta.jpg")).status()).toBe(200);
    });

    test("login e todas as abas da Central (conta de QA)", async ({ page }) => {
      test.skip(!process.env.QA_EMAIL, "sem conta de QA configurada (segredos QA_EMAIL / QA_SENHA)");
      const erros = vigiar(page);
      await page.goto(SITE + "/central/");
      await page.fill("#ccEmail", process.env.QA_EMAIL);
      await page.fill("#ccSenha", process.env.QA_SENHA);
      await page.click("#ccBtn");
      await page.waitForLoadState("networkidle");
      for (const aba of ABAS) {
        await page.goto(`${SITE}/central/#${aba}`);
        await page.waitForTimeout(2500);
        await expect(page.locator("text=Não consegui")).toHaveCount(0);
      }
      expect(erros).toEqual([]);
    });
  });
}

test("servidor: funções protegidas recusam acesso sem login", async ({ request }) => {
  const backup = await request.post(FN + "backup", { data: { acao: "listar" } });
  expect([401, 403]).toContain(backup.status());
  const mcp = await request.post(FN + "mcp-central/cc_" + "0".repeat(48), { data: {} });
  expect([401, 403]).toContain(mcp.status());
  const vigia = await request.post(FN + "vigia", { data: {} });
  expect([401, 403]).toContain(vigia.status());
});
