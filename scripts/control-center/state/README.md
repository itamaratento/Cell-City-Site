# state/

Estrutura de Estado do Sistema (Fase 1.1) — arquivos de controle que vão
registrar, a partir da Fase 2, a última execução de cada rotina de
manutenção do projeto:

| Arquivo               | Registra                                    |
|------------------------|----------------------------------------------|
| `release.json`         | última execução do Release Center             |
| `backup.json`          | último backup (manual ou automático)          |
| `homologacao.json`     | última homologação (Release Completa/Certificação) |
| `restauracao.json`     | última restauração de backup                  |
| `health-check.json`    | último health check automático (Versão 3.0)   |
| `sincronizacao.json`   | última sincronização de branches (develop/main) |

Nesta Fase 1.1 nenhum módulo lê ou escreve estes arquivos ainda — todos os
campos começam `null`, só a estrutura/schema está definida. Quando um
módulo real (Fase 2 em diante) passar a atualizá-los, qualquer leitor
precisa tolerar campo ausente/`null` (nunca assumir que o arquivo já foi
escrito).
