#!/usr/bin/env node
// Aplica CORS no bucket do Firebase Storage.
// Rode DEPOIS de ativar o Storage no Firebase Console:
//   node apply-cors.js
//
// Requer: firebase CLI autenticado (firebase login)

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUCKET = 'cellcity-crm.firebasestorage.app';
const CORS_FILE = path.join(__dirname, 'cors.json');

function getToken() {
  const cfgFile = path.join(process.env.HOME, '.config/configstore/firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  const token = cfg?.tokens?.access_token;
  if (!token) throw new Error('Token não encontrado. Execute: firebase login');
  return token;
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function checkBucket(token) {
  const res = await request({
    hostname: 'storage.googleapis.com',
    path: `/storage/v1/b/${encodeURIComponent(BUCKET)}`,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res;
}

async function applyCors(token) {
  const corsConfig = JSON.parse(fs.readFileSync(CORS_FILE, 'utf8'));
  const body = JSON.stringify({ cors: corsConfig });

  const res = await request({
    hostname: 'storage.googleapis.com',
    path: `/storage/v1/b/${encodeURIComponent(BUCKET)}?fields=cors`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  return res;
}

async function main() {
  console.log('🔍 Verificando bucket:', BUCKET);
  const token = getToken();

  const check = await checkBucket(token);
  if (check.status === 404) {
    console.error('\n❌ Bucket não encontrado!');
    console.error('');
    console.error('O Firebase Storage ainda não foi ativado.');
    console.error('');
    console.error('Passos para ativar:');
    console.error('  1. Acesse: https://console.firebase.google.com/project/cellcity-crm/storage');
    console.error('  2. Clique em "Vamos começar" (Get started)');
    console.error('  3. Escolha "Iniciar no modo de produção"');
    console.error('  4. Selecione a região: southamerica-east1');
    console.error('  5. Clique em Concluído');
    console.error('');
    console.error('Depois rode novamente: node apply-cors.js');
    process.exit(1);
  }

  if (check.status !== 200) {
    console.error('❌ Erro ao verificar bucket:', check.status, check.body);
    process.exit(1);
  }

  console.log('✅ Bucket encontrado:', check.body.name);
  console.log('   Location:', check.body.location);
  console.log('   CORS atual:', JSON.stringify(check.body.cors || []));
  console.log('');
  console.log('📤 Aplicando nova configuração CORS...');

  const result = await applyCors(token);
  if (result.status === 200) {
    console.log('✅ CORS aplicado com sucesso!');
    console.log('   Configuração:', JSON.stringify(result.body.cors, null, 2));
    console.log('');
    console.log('🚀 Upload de imagens no catálogo agora deve funcionar.');
  } else {
    console.error('❌ Falha ao aplicar CORS:', result.status, result.body);
    process.exit(1);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
