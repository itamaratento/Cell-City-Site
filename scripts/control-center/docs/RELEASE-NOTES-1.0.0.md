# Release Notes — Cell City Control Center 1.0.0

**Data:** 2026-07-12 · **Comando:** `cellcity` · **Ambiente:** Terminal Ubuntu

## O que é

Central única de operação técnica do Cell City CRM no terminal: 10
módulos que envelopam os fluxos oficiais do projeto (release, backup,
branches, banco, diagnóstico, auditorias, manutenção, governança de IAs
e configurações) atrás de uma UX consistente — sem substituir nenhum
fluxo homologado (`subir`/`subir-ok`/`rollback` continuam sendo o único
caminho de publicação, o Sistema Oficial de Backup continua sendo o
único caminho de backup).

## Destaques da 1.0.0

- **10 módulos completos, zero placeholders**, todos homologados
  individualmente com parecer CCC-HOM-001 (ver `docs/`).
- **Princípio "envelopar, nunca reimplementar"** em todo módulo que toca
  fluxo já existente; operações destrutivas sempre com confirmação
  explícita (dupla, na Manutenção) e recuperação via `_trash/`.
- **158 testes automatizados, 100% aprovados** na certificação; ShellCheck
  sem erros nos 104 scripts.
- Abertura em ~0,14s; moldura responsiva de 40 a 200 colunas; funciona
  em TERM=dumb; português correto em toda a interface.

## Segurança

Certificação completa sem vulnerabilidades críticas remanescentes —
incluindo a eliminação de um bug latente grave na Manutenção (lógica
invertida que poderia excluir permanentemente arquivos protegidos) e a
blindagem do framework contra loop infinito com stdin esgotado.
Detalhes: `docs/PARECER-CCC-HOM-001-V1.0.md` §2.2.

## Como usar

```
cellcity          # abre o menu principal (10 módulos)
```

Navegação: números para entrar, `Voltar` é sempre o último número do
submenu, `0` sai do Control Center de qualquer tela.

## Publicação desta versão

- Tag preparada: **`control-center-v1.0.0`** (local). O nome `v1.0.0` já
  pertence a uma release do site (criada 2026-07-11, pública no origin) —
  a tag do Control Center é namespaced para não colidir.
- Backup oficial da versão registrado no repositório Cell-City-Backup.
- **Push/promoção a `main` aguardam autorização do proprietário** (via
  módulo Release / `subir-ok`, como todo o resto do projeto).

## Próximos passos (Versão 2.0 — planejada)

Administração dos módulos do CRM (Financeiro, Caixa, OS, Estoque, RBAC,
Auditorias etc.) — ver Roadmap no `README.md`. Módulos novos nascem como
placeholder (`_cc_placeholder`) e entram pelo Manifesto, sem tocar no
framework.
