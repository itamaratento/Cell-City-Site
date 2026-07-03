#!/usr/bin/env node
// Verifica o release ATIVO das Firestore Rules de um projeto via
// firebaserules.googleapis.com (nunca confiar só no "Publicar" do console —
// lição registrada em 2026-07-01) e compara com o arquivo-fonte oficial.
// Uso: node verify-firestore-rules.mjs --project cellcity-crm-dev --file ../CRM/firestore.rules
// Requer: gcloud autenticado (gcloud auth login) com acesso ao projeto.

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : def;
}

const project = arg('project');
const file = arg('file', resolve(__dirname, '../CRM/firestore.rules'));

if (!project) {
  console.error('Uso: node verify-firestore-rules.mjs --project <cellcity-crm|cellcity-crm-dev> [--file caminho/para/firestore.rules]');
  process.exit(1);
}

function accessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function main() {
  const token = accessToken();
  const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': project };

  const releaseName = `projects/${project}/releases/cloud.firestore`;
  const relRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, { headers });
  if (!relRes.ok) {
    console.error(`❌ Não achou release ativo em ${project}: HTTP ${relRes.status}`);
    console.error(await relRes.text());
    process.exit(1);
  }
  const release = await relRes.json();
  const rulesetId = release.rulesetName; // projects/{p}/rulesets/{id}

  const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetId}`, { headers });
  const ruleset = await rsRes.json();
  const activeSource = ruleset.source.files[0].content;

  const localSource = readFileSync(file, 'utf8');

  const norm = s => s.replace(/\r\n/g, '\n').trim();
  const same = norm(activeSource) === norm(localSource);

  console.log(`Projeto:        ${project}`);
  console.log(`Release ativo:  ${release.name}`);
  console.log(`Ruleset:        ${rulesetId}`);
  console.log(`Arquivo local:  ${file}`);
  console.log(same
    ? '✅ Release ativo IDÊNTICO ao arquivo local.'
    : '❌ Release ativo DIFERENTE do arquivo local — não confiar no console, investigar antes de prosseguir.');
  process.exit(same ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
