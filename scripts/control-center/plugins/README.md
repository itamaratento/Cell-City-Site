# plugins/

Reservado para a Versão 3.0 do Roadmap (Automação Inteligente — ver
`../README.md`): auditorias automáticas, monitoramento, alertas.

## Convenção (Plugin Loader, Fase 1.1)

`../lib/plugin-loader.sh` carrega automaticamente, na inicialização do
Control Center, todo arquivo que existir em:

```
plugins/<nome-do-plugin>/plugin.sh
```

Nenhum plugin precisa ser registrado em `core/menu.sh` nem em
`config/modules.conf` — o loader varre a pasta sozinho. Sem nenhum plugin
instalado (caso desta Fase 1.1), o loader não encontra nada e não faz
nada: `_cc_load_plugins` sempre roda, mesmo vazia.

O formato interno de `plugin.sh` (o que ele pode registrar, quais funções
de `lib/` ele pode chamar) ainda não está definido — fica para a Sprint da
Versão 3.0. Por enquanto, nenhum módulo de `modules/` deve depender desta
pasta.
