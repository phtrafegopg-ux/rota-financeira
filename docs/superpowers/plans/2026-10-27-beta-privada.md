# Beta privada — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** entregar evidência reproduzível de recuperação dos comprovantes, funcionamento offline e atualização sem perda de dados, corrigindo somente falhas demonstradas.

**Architecture:** manter a PWA estática e os scripts atuais. Exercitar o app real em contextos Chromium isolados, com dados fictícios e sem Supabase de produção. Reaproveitar os testes existentes e acrescentar uma suite apenas para o ciclo offline/atualização.

**Tech Stack:** JavaScript/Web Crypto, IndexedDB, service worker, Node, Playwright 1.56.1 e Chromium; CI com Node 22 e PostgreSQL 16.

**Spec:** escopo abaixo, escolhido pelo agente após o usuário autorizar conduzir o planejamento e concluir o trabalho no Codex em 27/10/2026. Não autoriza merge, publicação ou mudanças em produção.

## Escopo e escolhas

Consolidar primeiro a beta privada. A alternativa comercial depende de pagamentos, operação e análise jurídica; permanece fora desta entrega. Não reescrever arquitetura, alterar schema criptográfico, criar novas contas ou ativar PRO/prêmios. Preferir ampliar testes que já existem a duplicar harnesses.

Esta entrega conclui uma etapa técnica da beta, não certifica lançamento público. Testes físicos, revisão externa e operação real de Auth/backup continuam sendo critérios separados, ainda pendentes.

## Global Constraints

- Nunca acessar dados financeiros reais, cofres de produção, segredos ou perfis pessoais.
- Preservar schema 2, AES-256-GCM, PBKDF2-SHA256 com 310.000 iterações, CAS/RLS e consentimento.
- Dados fictícios e backups de teste devem permanecer no diretório temporário do sistema; nenhum backup no Git.
- Não acrescentar dependências de produto; usar Playwright na versão da CI.
- Só modificar o app quando um teste demonstrar falha; registrar testes que já passam como cobertura adicionada.
- Não chamar alteração de documentação de aprovação para deploy. Preservar o PR #10 independente deste trabalho.

## Review Focus

1. Backup portável deve incluir bytes das imagens, não só referências IndexedDB do primeiro contexto — tarefa 1.
2. Cancelamento/senha errada não podem substituir estado ou imagens do destinatário — tarefa 1.
3. Cofre deve reabrir offline após fechar/reabrir a página — tarefa 2.
4. Atualização não pode eliminar cofre, provas, metadados ou caches de outros produtos — tarefa 2.
5. Falhas de exportação e armazenamento não devem emitir confirmação falsa nem incentivar limpeza do navegador — tarefa 1 e critérios manuais da tarefa 3.

## Tarefa 1 — recuperação portável com comprovantes

**Arquivos:** ampliar `tests/cloud-flow.mjs` e `tests/browser-smoke.mjs`; corrigir `core.js`/`security-center.js` somente se os testes falharem.

**Interfaces existentes:** `proofStorePut(ref,image,key=vaultKey)`, `proofStoreRead(ref,key=vaultKey)`, `portableVault()`, `restorePortableState(state,key,salt,beforeCommit=()=>{})`, `downloadJSON()`, `#importFile`, `form[data-cloud-restore]` e `window.rfSecurityStatus()`.

- [ ] Criar imagem sintética pequena e lançamento fictício com `proofs`/`imageRef` no primeiro contexto. Validar leitura cifrada no IndexedDB e backup que não contenha o texto/imagem em claro.
- [ ] Ampliar a restauração de nuvem já simulada em `tests/cloud-flow.mjs`: depois de cancelar, errar senha e restaurar corretamente em outro contexto, confirmar que `proofStoreRead` devolve os bytes originais, que o contexto original continua intacto e que não houve upload do destinatário.
- [ ] Ampliar `tests/browser-smoke.mjs`: baixar o JSON pela interface, importar em novo contexto e comparar lançamento e imagem. Executar também senha errada, cancelamento e falha de leitura de imagem na exportação, exigindo preservação dos dados e ausência de download falso.
- [ ] Executar `node tests/browser-smoke.mjs` e `node tests/cloud-flow.mjs`. Se houver falha de produto, registrar causa, corrigir minimamente e repetir até passar. Se já passar, não alterar o produto.
- [ ] Commit: `test: validar recuperação de comprovantes entre navegadores`.

## Tarefa 2 — offline e atualização do PWA

**Arquivos:** criar `tests/pwa-offline.mjs`; integrar em `.github/workflows/security-checks.yml`. Corrigir `sw.js`, `updater.js` ou registro em `core.js` somente se houver falha demonstrada.

**Interfaces existentes:** `./sw.js`, `CACHE`, `ASSETS`, mensagem `{type:'SKIP_WAITING'}` e registro em `core.js` também para localhost. `updater.js` observa atualização em HTTPS. Não confundir teste do protocolo de atualização com teste da barra visual HTTPS.

- [ ] Usar o padrão de servidor Python dos testes existentes, porta 8768 e `process.env.PYTHON || 'python3'`; finalizar servidor/contextos em `finally` e usar temporário do sistema para servir versões de teste, sem editar arquivos durante testes.
- [ ] Servir sob `/rota-financeira/` para exercitar caminhos relativos do GitHub Pages. Esperar service worker ativo e controlador, criar cofre/prova fictícios, desligar rede, recarregar, desbloquear e comparar registros/imagem. Fechar a página, abrir outra no mesmo contexto offline e repetir a leitura.
- [ ] Simular segunda versão alterando somente o nome do cache no diretório temporário. Registrar/atualizar SW, aguardar `waiting`, enviar `SKIP_WAITING`, aguardar novo controlador e conferir estado após recarga offline.
- [ ] Confirmar remoção do cache anterior `rf-pages-*`, preservação de cache fictício de outro produto e ausência de alterações em cofre/prova/metadados pela ativação do SW.
- [ ] Executar `node tests/pwa-offline.mjs`. Corrigir apenas falha comprovada. Acrescentar exatamente esse comando após as suites existentes na CI.
- [ ] Commit: `test: cobrir ciclo offline e atualização do PWA`.

## Tarefa 3 — verificação e entrega

**Arquivos:** criar `docs/BETA-PRIVADA.md`, atualizar este plano com evidências. Atualizar `AGENTS.md` no PR correspondente se a integração exigir novos comandos; não sobrescrever instruções existentes.

- [ ] Rodar `node --check` nos oito scripts listados no workflow, `node tests/security-audit.mjs`, `node --test tests/session-races.mjs tests/crypto-vault.mjs tests/restore-commit.mjs` e as quatro suites de navegador em sequência.
- [ ] Conferir capturas de responsividade e usar somente dados sintéticos. Registrar limites de emulação e versão local do Node; a confirmação de Node 22/PostgreSQL 16 deve vir dos checks do mesmo commit na CI.
- [ ] Revisar o diff completo; uma revisão independente verifica preservação, isolamento e se testes podem passar sem exercitar o recurso.
- [ ] Documentar aceite técnico e roteiro físico: backup pelo responsável antes de atualizar; instalação Android; reabertura sem rede; restauração em outro aparelho com base fictícia; imagem visível; atualização; celular/tablet/desktop e TV física se desejado. Não marcar esses testes manuais como executados sem evidência.
- [ ] Criar commit e PR de escopo próprio; confirmar checks `audit` e `rls`. Não mesclar nem publicar automaticamente.

## Critério de entrega

PR com testes de comprovantes e offline/atualização passando na CI; dados do usuário intocados; roteiro de homologação física disponível; nenhuma promessa de conformidade LGPD ou segurança absoluta. O lançamento da beta em aparelhos reais depende da homologação documentada pelo responsável.

## Registro da execução — 27/10/2026

- Base: `92d345faffa2b044f983d2a7eacf91fa1185db10`, branch `beta/backup-offline-validado`, clone novo em pasta própria. Nenhum checkout pessoal foi alterado.
- Preparação: Playwright 1.56.1 e Chromium instalados somente na cópia de trabalho; Node local 24.22.0. Node 22/PostgreSQL 16 ficam para os checks da CI do commit entregue.
- Tarefa 1: concluída localmente. Teste reproduziu importação reabrindo cofre após bloqueio (`vaultKey` não nula); após correção do contexto, a mesma verificação passou. Recuperação JSON e nuvem simulada recompõem a imagem em IndexedDB independente. Erro de exportação não baixa arquivo incompleto.
- Tarefa 2: concluída localmente. Suite nova valida subdiretório Pages, reabertura offline e ativação de versão nova preservando estado/imagem/metadados e cache alheio. Comando integrado à CI.
- Decisão: preservar registro/atualizador existentes; `core.js` já registra SW em localhost. O teste aguarda `waiting` e depois `activated`; `controllerchange` sozinho pode anteceder o fim da limpeza de caches. Nenhuma alteração no protocolo de atualização foi necessária.
- Decisão: acrescentar a verificação de importação interrompida à tarefa 1, pois demonstra falha de bloqueio/preservação no próprio fluxo. A correção mantém formato e confirmação existentes.
- Tarefa 3: sintaxe dos oito scripts, auditoria estática, doze testes Node e quatro suites de navegador passaram localmente. As três capturas de 390/768/1920 px foram inspecionadas. Revisão independente e checks remotos ainda devem ser registrados antes de declarar a entrega pronta para avaliação.
- Integração: o guia proposto no PR #10 permanece independente; o novo comando também está documentado em `docs/BETA-PRIVADA.md`. Atualizar o guia de agentes ao integrar as branches, sem descrever como existente na `main` uma suite ainda em revisão.
- Não executados: testes físicos, clique na barra HTTPS, produção Supabase e instalação real no Android. Permanecem explicitamente pendentes no roteiro de homologação.
