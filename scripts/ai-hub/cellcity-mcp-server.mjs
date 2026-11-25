#!/usr/bin/env node
/**
 * Cell City — Servidor MCP Local (`cellcity-dev-router`)
 *
 * Implementação padrão Model Context Protocol (JSON-RPC 2.0 sobre stdio),
 * zero dependências externas, compatível com Google Antigravity, Cursor e Claude Code.
 *
 * Ferramentas expostas:
 *   - cellcity_hierarchy_status: Diagnóstico em tempo real da hierarquia 1->4 e integrações
 *   - cellcity_dispatch_task: Despacha tarefa de programação respeitando Cursor -> DeepSeek -> Gemini -> Claude Opus
 *   - cellcity_create_sprint_brief: Gera Sprint Brief padronizado (ENGINEERING.md)
 *   - cellcity_check_protected_files: Verifica se arquivos-alvo tocam módulos protegidos da Cell City
 */

import fs from 'node:fs';
import readline from 'node:readline';
import {
  buildSprintBrief,
  checkProtectedFiles,
  dispatchTask,
  getHierarchyStatus,
} from './hierarchy-router.mjs';

const SERVER_INFO = {
  name: 'cellcity-dev-router',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'cellcity_hierarchy_status',
    description: 'Retorna status em tempo real da hierarquia obrigatória de programação da Cell City (1. Cursor, 2. DP/DeepSeek, 3. Gemini/Antigravity, 4. Claude Opus) e das integrações (GitHub, Google Drive, Docs, Slides, Firebase).',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Caminho opcional do repositório Cell-City-Site' },
      },
    },
  },
  {
    name: 'cellcity_dispatch_task',
    description: 'Despacha uma tarefa de programação seguindo estritamente a hierarquia da Cell City (1. Cursor, 2. DP/DeepSeek, 3. Gemini, 4. Claude Opus apenas com justificativa). Gera Handoff Pack automaticamente se API key ainda não estiver configurada.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'Descrição técnica e cirúrgica da tarefa de código' },
        tier: {
          type: 'string',
          enum: ['auto', 'cursor', 'deepseek', 'gemini', 'claude-opus'],
          description: 'Nível desejado (padrão: auto, priorizando Cursor -> DeepSeek)',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de arquivos-alvo permitidos (máximo 1 módulo por vez)',
        },
        model: { type: 'string', description: 'Modelo opcional (ex.: deepseek-chat, deepseek-reasoner)' },
        repo: { type: 'string', description: 'Caminho do repositório' },
        dry_run: { type: 'boolean', description: 'Se true, gera apenas o Handoff Pack sem invocar APIs externas' },
        allow_fallback: { type: 'boolean', description: 'Se true, permite fallback automático Cursor -> DeepSeek -> Gemini (nunca auto-Opus)' },
        allow_opus_fallback: { type: 'boolean', description: 'Exigido somente para Nível 4 (emergência)' },
        reason: { type: 'string', description: 'Justificativa de escalonamento quando não usar Nível 1' },
      },
    },
  },
  {
    name: 'cellcity_create_sprint_brief',
    description: 'Gera um Sprint Brief compatível com ENGINEERING.md e CLAUDE.md para delegação segura ao Cursor ou DP/DeepSeek.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'Objetivo e problema da Sprint' },
        tier: { type: 'string', enum: ['cursor', 'deepseek', 'gemini'], description: 'Programador designado' },
        files: { type: 'array', items: { type: 'string' }, description: 'Arquivos-alvo permitidos' },
        reason: { type: 'string', description: 'Observação ou justificativa opcional' },
      },
    },
  },
  {
    name: 'cellcity_check_protected_files',
    description: 'Valida se uma lista de arquivos contém módulos protegidos da Cell City (firebase.js, auth.js, config.js, global.css, firestore.rules, storage.rules, functions/*).',
    inputSchema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: { type: 'array', items: { type: 'string' }, description: 'Caminhos dos arquivos a verificar' },
      },
    },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function defaultRepo(provided) {
  if (provided) return provided;
  if (process.env.CELLCITY_REPO && fs.existsSync(process.env.CELLCITY_REPO)) return process.env.CELLCITY_REPO;
  if (fs.existsSync('/home/antigravity/Cell-City-Site')) return '/home/antigravity/Cell-City-Site';
  return process.cwd();
}

async function handleRequest(req) {
  const { id, method, params = {} } = req;

  if (method === 'notifications/initialized' || id === undefined) {
    return;
  }

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params.name;
    const args = params.arguments || {};

    try {
      let payload;
      if (toolName === 'cellcity_hierarchy_status') {
        payload = getHierarchyStatus(defaultRepo(args.repo));
      } else if (toolName === 'cellcity_dispatch_task') {
        payload = await dispatchTask({
          task: args.task,
          tier: args.tier || 'auto',
          files: args.files || [],
          model: args.model || '',
          repo: defaultRepo(args.repo),
          dryRun: Boolean(args.dry_run),
          allowFallback: Boolean(args.allow_fallback),
          allowOpusFallback: Boolean(args.allow_opus_fallback),
          reason: args.reason || '',
        });
      } else if (toolName === 'cellcity_create_sprint_brief') {
        payload = buildSprintBrief({
          task: args.task,
          tier: args.tier || 'cursor',
          files: args.files || [],
          reason: args.reason || '',
        });
      } else if (toolName === 'cellcity_check_protected_files') {
        const hits = checkProtectedFiles(args.files || []);
        payload = {
          safe: hits.length === 0,
          protected_hits: hits,
          policy: hits.length ? 'EXIGE autorização explícita e backup prévio' : 'Liberado para edição isolada em branch develop/feature',
        };
      } else {
        sendError(id, -32601, `Ferramenta desconhecida: ${toolName}`);
        return;
      }

      const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text }],
        },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [{ type: 'text', text: `Erro: ${err.message}` }],
        },
      });
    }
    return;
  }

  sendError(id, -32601, `Método não suportado: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    handleRequest(req).catch((err) => {
      if (req.id !== undefined) sendError(req.id, -32603, err.message);
    });
  } catch (err) {
    sendError(null, -32700, `JSON inválido: ${err.message}`);
  }
});
