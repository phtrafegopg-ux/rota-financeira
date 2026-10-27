# Beta privada — validação e próximos critérios

## Escopo desta entrega

Esta etapa valida recuperação de comprovantes e o ciclo offline/atualização com dados fictícios. Não representa liberação comercial, auditoria independente ou homologação de todos os aparelhos.

A importação de arquivo tinha uma corrida reproduzida: bloquear o cofre durante a derivação da senha permitia que a operação atrasada o reabrisse. A correção captura a chave e o estado de origem e verifica esse contexto antes de prosseguir e antes da gravação final. Cancelar, informar senha errada ou bloquear preserva o cofre anterior. O formato dos backups e os parâmetros criptográficos não mudaram.

## Evidências automatizadas

| Verificação | Como reproduzir | Resultado esperado |
| --- | --- | --- |
| Backup JSON pela interface, restauração em outro contexto e comprovante | `node tests/browser-smoke.mjs` | Arquivo cifrado; imagem recuperada; origem preservada; cancelamento/senha errada/bloqueio não substituem destino. Imagem ausente impede download incompleto. |
| Backup de nuvem simulado e recuperação em outro contexto | `node tests/cloud-flow.mjs` | Imagem recuperada sem depender do IndexedDB original e sem upload pelo destinatário; conflitos e vínculo de conta preservados. |
| Reabertura offline e atualização sob `/rota-financeira/` | `node tests/pwa-offline.mjs` | Registros, imagem e metadados sobrevivem à recarga, reabertura da página e nova versão; cache alheio preservado. |
| Sessão, criptografia e commit de restauração | `node --test tests/session-races.mjs tests/crypto-vault.mjs tests/restore-commit.mjs` | Doze casos aprovados, incluindo senha errada, conteúdo adulterado e respostas atrasadas. |
| Layout | `node tests/responsive-layout.mjs` | Sete telas de 280 a 2560 px, abas e modais sem overflow nem mudança dos dados. |
| Isolamento do banco | `.github/workflows/postgres-security.yml` | PostgreSQL 16 descartável com RLS, CAS e isolamento A/B aprovados. Nunca executar o bootstrap no Supabase real. |

A suite PWA usa servidor local, cópia temporária dos arquivos e dois nomes de cache para simular atualização. Não modifica o checkout durante sua execução. Ela testa o protocolo real de ativação do service worker; não testa o clique na barra HTTPS de `updater.js`, a instalação pelo menu do Android ou funcionamento em TV física.

Os testes de navegador usam Playwright 1.56.1 e Chromium. Requisitos e comandos de preparação estão em `.github/workflows/security-checks.yml` e no guia `AGENTS.md`. O comando `node tests/pwa-offline.mjs` integra a mesma verificação antes de deploy. A bateria local passou em Node 24 e os checks `audit`/`rls` do PR #11 passaram em Node 22/PostgreSQL 16. Os PRs #10 e #11 foram integrados na `main` em 27/10/2026 após autorização do responsável. O commit integrado é `869e5860730ce47952745376da2a663bccb7ea0f`; a publicação também executa suas próprias verificações antes do deploy. Evidência em https://github.com/phtrafegopg-ux/rota-financeira/pull/11.

## Homologação física — pendente

Use base fictícia em perfil/dispositivo de teste. Para atualizar uma instalação com dados reais, o responsável deve primeiro exportar e guardar backup cifrado fora do repositório; o agente não deve receber nem abrir esse arquivo. Não restaurar dados fictícios por cima de uma instalação pessoal.

- [ ] Android/Chrome: instalar a versão revisada pelo menu do navegador e registrar aparelho, versão do sistema/navegador e commit.
- [ ] Criar lançamentos e comprovante sintéticos, fechar e reabrir o app, conferir imagem e saldo.
- [ ] Ativar modo avião, abrir o app instalado, desbloquear, conferir e registrar um lançamento; fechar e reabrir novamente.
- [ ] Exportar backup sintético e restaurar em outro perfil/aparelho, usando a senha original. Conferir lançamentos e comprovante; cancelar e errar senha antes, verificando preservação do destino.
- [ ] Voltar à rede, disponibilizar nova versão de teste e usar a barra de atualização HTTPS. Conferir dados após atualizar e depois offline.
- [ ] Conferir celular, tablet e desktop: teclado, foco, zoom, textos longos, abas, formulários e modais. TV física deve ser registrada separadamente se for plataforma de uso pretendida.
- [ ] Para uma futura beta com nuvem real, validar Auth, e-mail, RLS/CAS e restauração em ambiente dedicado somente com contas fictícias; esta entrega não usa nem modifica produção.

Registrar cada resultado como aprovado/reprovado/pendente, com ambiente e evidência sem dados pessoais. Teste não executado permanece pendente. Um defeito de perda de dados ou isolamento impede avançar a beta naquele fluxo.

## Fora desta entrega

PRO, cobrança, premiações, recuperação de chave sem senha original, auditoria externa, conformidade LGPD e operação de backup/PITR. Também permanecem pendentes as configurações de Auth e proteção administrativa registradas na auditoria; não foram alteradas ou declaradas resolvidas.

O responsável autorizou integrar e publicar esta etapa técnica. Isso não conclui a homologação física, não autoriza alterar dados/serviços de produção e não substitui o backup antes de atualizar uma instalação pessoal. Os resultados de publicação e da verificação do site acompanham o resumo da entrega; qualquer teste físico não executado continua pendente.
