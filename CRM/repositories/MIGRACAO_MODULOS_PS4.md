# Migração de Módulos — PS-4 (Adaptação Multiempresa)

## Resumo

17 módulos usam Firestore diretamente (sem repositórios) e precisam
de adaptação para multiempresa. O padrão de migração é:

1. Importar `injectTenantFilter, tData` de `shared/tenant-query.js`
2. Adicionar `...injectTenantFilter([])` nas queries
3. Envolver dados de escrita com `tData()`

## Módulos Prioritários (já adaptados)

| Módulo | Status | Mudança |
|--------|--------|---------|
| `compras/compras.js` | ✅ Adaptado | Queries + writes com tenant |

## Módulos Restantes (documentados)

| Módulo | Prioridade | Linhas | Complexidade |
|--------|-----------|--------|-------------|
| `os/os.js` | Crítica | 2759 | Muito Alta |
| `financeiro/financeiro.js` | Crítica | 1131 | Alta |
| `crm-comercial/crm.js` | Alta | 1125 | Alta |
| `crm-comercial/entrada.js` | Alta | 421 | Média |
| `importar/importar.js` | Alta | 410 | Média |
| `dashboard/dashboard-alertas.js` | Média | ~200 | Baixa |
| `dashboard/dashboard-busca.js` | Média | ~150 | Baixa |
| `dashboard/dashboard-caixa.js` | Média | ~100 | Baixa |
| `dashboard/dashboard-alarme-os.js` | Baixa | ~80 | Baixa |
| `dashboard/dashboard-ui.js` | Baixa | ~50 | Baixa |
| `analise/analise.js` | Baixa | 354 | Média |
| `auditoria/auditoria.js` | Baixa | 203 | Baixa |
| `chat/chat.js` | Baixa | 199 | Baixa |
| `portal-cliente/portal.js` | Média | 2354 | Alta (anônimo) |
| `portal-cliente/admin.js` | Média | 1200+ | Alta (anônimo) |
| `usuarios-permissoes/usuarios-permissoes.js` | Baixa | 819 | Média |

## Padrão de Adaptação

### Para queries (listar documentos):
```javascript
// ANTES
const snap = await getDocs(query(collection(db, 'colecao'), limit(100)));

// DEPOIS
import { injectTenantFilter } from '../../shared/tenant-query.js';
const snap = await getDocs(query(collection(db, 'colecao'), ...injectTenantFilter([]), limit(100)));
```

### Para queries com where:
```javascript
// ANTES
const q = query(collection(db, 'os'), where('phoneDigits', '==', tel));

// DEPOIS
const q = query(collection(db, 'os'), ...injectTenantFilter([where('phoneDigits', '==', tel)]));
```

### Para escritas (criar documentos):
```javascript
// ANTES
await addDoc(collection(db, 'colecao'), { nome: 'João', valor: 100 });

// DEPOIS
import { tData } from '../../shared/tenant-query.js';
await addDoc(collection(db, 'colecao'), tData({ nome: 'João', valor: 100 }));
```

### Para módulos com initModulo():
```javascript
// JÁ TEM acesso a ctx.empresaId — use diretamente:
const ctx = await initModulo();
// ctx.empresaId já está disponível
```

## Módulos que NÃO precisam de adaptação

| Módulo | Motivo |
|--------|--------|
| Dashboard (orquestradores) | Sem Firestore direto |
| `shared/*` libs | Sempre usam ctx ou repositories |
| `portal-cliente/*` | Usam Cloud Functions (Admin SDK) |
