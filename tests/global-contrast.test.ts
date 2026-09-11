import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const globalStyles = readFileSync("src/app/globals.css", "utf8");
const button = readFileSync("src/components/ui/button.tsx", "utf8");
const dialog = readFileSync("src/components/ui/dialog.tsx", "utf8");
const alertDialog = readFileSync("src/components/ui/alert-dialog.tsx", "utf8");
const sheet = readFileSync("src/components/ui/sheet.tsx", "utf8");
const input = readFileSync("src/components/ui/input.tsx", "utf8");
const textarea = readFileSync("src/components/ui/textarea.tsx", "utf8");
const select = readFileSync("src/components/ui/select.tsx", "utf8");
const chart = readFileSync("src/components/ui/chart.tsx", "utf8");

test("el tema oscuro se aplica desde la raíz para cubrir páginas y portales", () => {
  assert.match(rootLayout, /className=\{`\$\{inter\.variable\} \$\{anton\.variable\} dark`\}/);
  assert.match(rootLayout, /<body className="[^"]*bg-background[^"]*text-foreground[^"]*"/);
});

test("el tema oscuro conserva texto claro sobre el fondo general oscuro", () => {
  assert.match(globalStyles, /\.dark\s*\{[\s\S]*?--background:\s*240 10% 3\.9%;/);
  assert.match(globalStyles, /\.dark\s*\{[\s\S]*?--foreground:\s*0 0% 98%;/);
  assert.match(globalStyles, /body\s*\{\s*@apply bg-background text-foreground;/);
});

test("los controles compartidos declaran texto legible incluso sin fondo propio", () => {
  assert.match(button, /text-sm font-medium text-foreground/);
  assert.match(button, /outline:\s*\n?\s*"[^"]*bg-background[^"]*text-foreground/);
  assert.match(button, /ghost:\s*"[^"]*text-foreground/);
  assert.match(input, /bg-background[^"]*text-foreground/);
  assert.match(textarea, /bg-background[^']*text-foreground/);
  assert.match(select, /bg-background[^"]*text-foreground/);
});

test("portales y capas flotantes no pierden el color del tema", () => {
  for (const source of [dialog, alertDialog, sheet, chart]) {
    assert.match(source, /bg-background[^"']*text-foreground/);
  }
});
