# AGENTS.md — Rota Financeira

## Propósito e escopo

Aplicativo experimental de controle financeiro para motoristas e entregadores: receitas por plataforma, gastos, contas, dívidas, metas, comprovantes, histórico e projeções mensais. O planejamento de 12 meses é uma direção do produto; não inserir datas fixas, dívidas ou valores de uma pessoa no código público. As projeções dependem dos lançamentos do usuário e não são garantia de renda.

Repositório: https://github.com/phtrafegopg-ux/rota-financeira
Publicação: https://phtrafegopg-ux.github.io/rota-financeira/

Revisão documental em 28/10/2026 sobre a base funcional `59faa647b6c08e0efd285c2c2d60091e1aaa5523`, após integrar o PR #15. A entrega técnica e seus limites estão em `docs/ENTREGA-BETA-PRIVADA.md`. Antes de trabalhar, confira a estrutura e os workflows atuais. Código e configuração atuais prevalecem sobre descrições históricas. Este arquivo orienta agentes na raiz e nas subpastas, respeitando instruções específicas de cada diretório.

## Arquitetura real e onde encontrar o código

PWA estática, sem framework, bundler ou servidor próprio neste repositório. HTML, CSS e JavaScript são publicados diretamente no GitHub Pages. Não há `package.json`, lockfile, comando `npm test` nem etapa de build da aplicação na base inspecionada. Não criar infraestrutura para uma alteração que não precise dela.

| Arquivo ou diretório | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura, CSS base embutido, CSP e ordem dos scripts `defer`. |
| `core.js` | Estado, cálculos, renderização, formulários, cofre, importação/exportação e comprovantes. Contém também implementações antigas de nuvem, substituídas pela camada segura. |
| `security-center.js` | Fluxos efetivos de Auth, renovação de sessão, backup com revisão, restauração, consentimento, pendências, bloqueio/logout e notificações discretas. |
| `cloud-config.js` | Configuração pública de Supabase aplicada somente ao hostname oficial; não altera os testes em localhost. |
| `insights.js` | Indicadores e gráfico calculados localmente a partir do cofre desbloqueado. |
| `branding.js`, `branding.css`, `marca-aprovada.svg`, `icon.svg` | Identidade visual e recursos gráficos. |
| `styles-v3.css`, `styles-v4.css`, `styles-responsive.css` | Camadas de estilos; a camada responsiva é carregada por último. |
| `online-ranking.js`, `subscriptions.js` | Consulta de ranking revisado e status de assinatura; interfaces de pré-lançamento. |
| `manifest.webmanifest`, `sw.js`, `updater.js` | Instalação PWA, cache de recursos e fluxo de atualização. |
| `tutorial-rota-financeira.mp4`, `tutorial-poster.jpg` | Tutorial público narrado com dados fictícios, aberto por botão na tela de acesso e em Ajustes. |
| `supabase/01_seguro.sql` | Esquema, privilégios, políticas RLS e RPC CAS. Não executar automaticamente em produção. |
| `tests/*.mjs`, `tests/sql/` | Testes locais, navegador com dados fictícios e banco descartável. |
| `tests/pwa-offline.mjs` | Reabertura offline e ativação de atualização, preservando cofre, comprovantes, metadados e caches alheios. |
| `tests/multi-tab.mjs` | Proteção contra edição concorrente do mesmo cofre em abas do mesmo perfil. |
| `tests/audit-regressions.mjs` | Bloqueio durante leitura/envio, validação de importação, migração legada e pendência após troca de senha/importação. |
| `docs/BETA-PRIVADA.md` | Evidências técnicas e roteiro de homologação física ainda pendente. |
| `docs/ENTREGA-BETA-PRIVADA.md` | Consolidação da entrega, evidências da versão funcional, uso da cópia e critérios externos pendentes. |
| `docs/VALIDACAO-RECUPERACAO-2026-10-27.md` | Rodada ampliada de recuperação e troca de senha, com resultados e limites. |
| `.github/workflows/` | Verificações, PostgreSQL e publicação Pages. |
| `RELEASE-4.0.md`, `SEGURANCA-E-ATIVACAO.md`, `docs/` | Entregas, ativação e registros de auditoria/pendências. |

Os scripts compartilham funções e estado globais. Ordem atual: `core.js`, `branding.js`, `cloud-config.js`, `security-center.js`, `insights.js`, `online-ranking.js`, `subscriptions.js`, `updater.js`. Algumas camadas envolvem ou substituem funções anteriores. Ao rastrear `render`, `save`, `vaultPage`, `handleCloudForm`, `fetchCloudVault`, `cloudUpload` ou `cloudDownload`, procure todas as definições e seus chamadores; ler apenas `core.js` dá uma visão incompleta.

Para se orientar, execute `rg --files` e pesquise símbolos com `rg -n 'cloudUpload|rf_write_vault|p_expected_revision' core.js security-center.js supabase tests`. Consulte um grafo Graphify existente quando útil. Criar grafo, hooks ou configuração do projeto depende de solicitação; a extração padrão deve ser local e restrita a código. Não enviar documentação, dados ou código privado a outro provedor/modelo nem configurar proxy ou API paga.

## Dados, criptografia e sincronização: invariantes

- O estado financeiro local é cifrado em `localStorage`, chave `rota_financeira_vault_v2`. O envelope tem `schema: 2`, salt, IV, ciphertext e metadados. Preservar compatibilidade com backups existentes.
- Web Crypto usa AES-256-GCM e PBKDF2-SHA256 com 310.000 iterações, salt aleatório de 16 bytes e IV novo de 12 bytes. Não reduzir parâmetros, reutilizar IV ou trocar o formato sem migração testada e backup.
- Comprovantes grandes ficam cifrados separadamente no IndexedDB `rota_financeira_provas_v23`, object store `proofs`; a referência participa da autenticação AES-GCM. Backups portáteis reincorporam as imagens antes da cifragem. Não exportar apenas referências locais.
- A senha do cofre e a senha do Supabase Auth têm funções diferentes. A senha do cofre não vai ao servidor. Redefinir o login não recupera a chave; é necessária a senha original do backup. Não existe recuperação de chave pelo servidor.
- Tokens de acesso e renovação permanecem em memória. Não persistir tokens em armazenamento do navegador, logs ou fixtures. Configuração pública, consentimento, âncora de revisão e pendências usam `localStorage`; esses metadados não equivalem ao cofre cifrado.
- Backup automático é opt-in, vinculado ao projeto e à conta. Exige app aberto, cofre desbloqueado e sessão válida; não prometer sincronização em segundo plano com o app fechado. Envio manual também exige autenticação e ação consciente.
- A escrita efetiva usa `public.rf_write_vault(jsonb,bigint)`, com `p_vault` cifrado e `p_expected_revision`. A primeira criação usa revisão esperada zero; atualizações exigem a revisão existente e incrementam `revision`. `RF_REVISION_CONFLICT` deve bloquear a sobrescrita, sem tentativa forçada ou fusão automática.
- A RPC usa `auth.uid()` para definir o dono, nunca um `user_id` aceito do cliente. Ela é `SECURITY DEFINER` intencionalmente, com `search_path` fixado e execução revogada de `PUBLIC`/`anon`. Não liberar escrita direta nem remover a verificação do dono para silenciar um advisor.
- RLS limita leitura de `finance_vault` e `rf_subscriptions` ao dono. `rf_weekly_rankings` permite leitura por autenticados; clientes não escrevem ranking nem assinaturas. A RPC rejeita envelopes estruturalmente inválidos e maiores que 5 MiB; isso não prova a integridade criptográfica do conteúdo.
- Preservar vínculo de conta, âncora de revisão, indicador persistente de alterações pendentes e invalidação de respostas atrasadas após bloqueio, logout, login novo ou troca de cofre. Só confirmar backup após resposta válida do servidor.
- Restauração exige backup prévio, consentimento, senha correta, validação e contexto ainda válido antes de substituir o cofre. Em erro ou cancelamento, preservar os dados. Uma requisição já aceita pelo servidor não é desfeita pelo bloqueio local.
- Somente uma aba pode manter o cofre desbloqueado no mesmo perfil/origem. A reserva Web Locks usa a chave `rota_financeira_vault_v2` e é liberada após a fila de salvamento ao bloquear, ou pelo navegador ao fechar a aba. Navegadores sem Web Locks precisam ser atualizados; o app preserva o cofre e não abre edição sem essa proteção. Todas as abas devem executar a versão atualizada.
- Ao anexar comprovantes, imagens referenciadas por uma gravação já confirmada não podem ser removidas por erro de conferência tardia ou bloqueio. A confirmação usa o snapshot e a chave capturados; ao assumir o cofre de outra aba, recuperar o marcador persistido de backup pendente.

- Validar campos, tipos, datas e coleções antes de restaurar qualquer estado. Migração inválida deve preservar os dados legados. Importação local e troca de senha confirmadas marcam backup pendente; restauração remota mantém a revisão confirmada e desativa envio automático.
- Visualização de comprovantes e resultados de upload atrasados não podem exibir dados, alertas ou redesenhar Ajustes depois de bloqueio/troca de contexto.

## Segurança, privacidade e preservação

1. Nunca acessar, consultar, descriptografar ou publicar dados financeiros reais, comprovantes, backups pessoais, e-mails de usuários ou sessões para desenvolver/testar. Usar exclusivamente dados fictícios. Não consultar nem baixar cofres de produção, mesmo cifrados.
2. Nunca obter, imprimir ou versionar senhas, tokens, JWT secrets, chaves `secret` ou `service_role`. O frontend pode conter somente URL e chave publishable/anon; a proteção depende de Auth, grants e RLS. Não copiar a chave pública para exemplos desnecessariamente.
3. Antes de atualização no dispositivo com dados, restauração, migração, troca de conta/senha/origem ou alteração de armazenamento, exigir que o responsável exporte e guarde backup criptografado fora do repositório. O agente não deve abrir esse arquivo. Validar restauração com dados fictícios em ambiente isolado.
4. Nunca limpar `localStorage`, IndexedDB, cofres, registros ou backups do usuário para resolver erro. Nunca sobrescrever dados silenciosamente. Exportar ambas as versões e reconciliar conscientemente um conflito, pelo responsável, sem expor os valores ao agente.
5. Não executar `tests/sql/*` em Supabase real. Não aplicar SQL, mudar Auth, políticas ou migrações de produção sem escopo explícito, revisão do impacto, backup operacional e plano de reversão.
6. Preservar CSP com `script-src 'self'`, escaping com `esc`, validação nas entradas, HTTPS e tratamento de falhas de rede/quota. Não inserir scripts inline, dependências remotas ou dados do usuário em HTML sem escape.
7. Não expor valores financeiros em notificações, capturas, logs, issues ou PRs. O relatório TXT exportado deliberadamente contém texto claro; tratá-lo como documento sensível. Backup JSON criptografado não torna prints e relatórios públicos seguros.
8. LGPD é requisito de lançamento: finalidade, minimização, consentimento aplicável, retenção, exclusão, acesso, resposta a incidentes e documentos de privacidade precisam ser definidos e revisados. Não declarar conformidade ou segurança absoluta por haver criptografia ou testes.

O relatório `docs/AUDITORIA-SEGURANCA-2026-10-27.md` registra limitações: proteção contra senhas vazadas desabilitada à época, configurações privadas de Auth e backups/PITR não verificados, revisão externa pendente e riscos de XSS/aparelho comprometido. Não tratar observações históricas como estado atual confirmado. Logout é local e não garante revogação imediata de um JWT já copiado.

## Desenvolvimento e comandos verificados

Execute os comandos a partir da raiz de um clone completo. CI usa Node **22**, Playwright **1.56.1**, Chromium e PostgreSQL **16**. Não assumir que essas ferramentas estejam instaladas no PC. Preservar dependências, lockfiles, pins de Node e `packageManager` que venham a existir. Se houver apenas `engines`, selecionar versão compatível explicitamente com mise; não reescrever as declarações.

Verificações sem dependências externas, conforme `.github/workflows/security-checks.yml`:

```text
node --check core.js
node --check insights.js
node --check security-center.js
node --check branding.js
node --check updater.js
node --check sw.js
node --check online-ranking.js
node --check subscriptions.js
node tests/security-audit.mjs
node --test tests/session-races.mjs tests/crypto-vault.mjs tests/restore-commit.mjs
```

Testes de navegador, com instalação usada na CI:

```text
npm install --no-save playwright@1.56.1
npx playwright install chromium
node tests/browser-smoke.mjs
node tests/cloud-flow.mjs
node tests/responsive-layout.mjs
node tests/pwa-offline.mjs
node tests/multi-tab.mjs
node tests/audit-regressions.mjs
```

Essa instalação é para ambiente de teste isolado; não adiciona uma etapa de build. Não apagar dependências locais nem publicar arquivos gerados. Os seis scripts iniciam seu próprio servidor Python nas portas 8765, 8766, 8767, 8768, 8769 e 8770, respectivamente; execute-os em sequência e confirme que as portas estão livres. Usam `process.env.PYTHON` ou `python3`. No PowerShell, se o executável disponível for `python`, configure `$env:PYTHON = 'python'` antes de rodá-los. Não usar o perfil pessoal do navegador nem conectar contas reais. `tests/cloud-flow.mjs` intercepta a API de nuvem com respostas simuladas. `tests/pwa-offline.mjs` usa cópia temporária sob `/rota-financeira/`; valida o protocolo do service worker, não o clique na barra HTTPS nem instalação física.

`tests/multi-tab.mjs` inicia seu servidor na porta 8769. Se a porta estiver ocupada, essa suite, `tests/browser-smoke.mjs` e `tests/audit-regressions.mjs` aceitam `RF_TEST_PORT` com outra porta livre. Não interromper servidores de outros projetos para executar a validação.

Para visualizar manualmente em ambiente isolado, o mesmo servidor padrão usado pelos testes pode ser iniciado com `python3 -m http.server 8765 --bind 127.0.0.1` e aberto em `http://127.0.0.1:8765/index.html`. Use o executável Python disponível e uma porta livre. Web Crypto requer HTTPS ou localhost; abrir por `file://` não substitui esse teste.

Teste de banco: usar apenas PostgreSQL 16 **descartável**, banco `rota_test`, com `psql` e variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` apontando para esse ambiente. O workflow `.github/workflows/postgres-security.yml` cria o serviço e define essas variáveis. Então executa, nesta ordem:

```text
psql -X -v ON_ERROR_STOP=1 -f tests/sql/00_bootstrap.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/01_seguro.sql
psql -X -v ON_ERROR_STOP=1 -f tests/sql/02_rls_cases.sql
```

O bootstrap cria papéis, Auth simulado e usuários fictícios; não foi feito para banco existente. A suite verifica isolamento A/B, grants, CAS, assinatura e casos inválidos. Não demonstra configuração correta de um projeto Supabase real.

## Responsividade e acessibilidade

Manter celular, tablet, desktop e telas grandes/TV utilizáveis: sem rolagem horizontal global, rótulos cortados ou elementos saindo dos cards. Preservar os textos de “Corridas e entregas”, gastos e entradas. Usar as classes e camadas existentes; largura flexível, `min-width: 0`, quebra de texto e limites de conteúdo devem resolver a causa, sem esconder conteúdo com overflow.

`tests/responsive-layout.mjs` percorre as sete telas em 280, 320, 360, 375, 390, 412, 480, 600, 768, 820, 1024, 1366, 1920 e 2560 px, além de abas e modais. Gera capturas em `test-results/`; CI guarda `layout-visual-responsive`. Conferir capturas após mudanças visuais, textos longos, zoom, foco/teclado, rótulos acessíveis e movimento reduzido. Resize e navegação não podem modificar dados. Emulação de largura grande não comprova compatibilidade com navegador/controle remoto de uma TV física.

## Branch, PR, checks e deploy

1. Confira branch, remoto e alterações locais antes de editar. Trabalhe em branch própria a partir da base atual; preserve alterações do usuário. Não fazer push direto na `main`, force-push ou merge sem autorização correspondente.
2. Mantenha o diff no escopo. Commit e PR devem explicar problema, mudança, verificações executadas e limites. Nunca incluir arquivos privados, backups ou capturas com dados reais.
3. PRs para `main` acionam `Verificações de segurança` (job `audit`) e `Testes de isolamento financeiro (PostgreSQL)` (job `rls`). Confira os resultados do commit atual; não presumir aprovação pela execução de uma versão anterior.
4. `Publicar Rota Financeira` roda por push na `main` ou `workflow_dispatch`; `deploy` exige a referência `main` e sucesso dos jobs reutilizáveis `security` e `database` do mesmo workflow. Abrir PR não publica o site.
5. O deploy copia somente `*.html`, `*.js`, `*.css`, `*.svg`, `manifest.webmanifest` e os arquivos específicos `tutorial-rota-financeira.mp4` e `tutorial-poster.jpg` da raiz para `public-site/`, depois usa Pages Actions. Markdown, testes e SQL ficam fora desse artefato. Não ampliar a publicação para o repositório inteiro. O tutorial usa `preload=none`, não tem autoplay e não entra em `ASSETS`; assistir exige internet. Publicar somente material fictício revisado. Ao fechar/substituir o modal ou bloquear, interromper o vídeo e liberar sua fonte.
6. Ao alterar recursos do app, conferir `ASSETS` e versão `CACHE` em `sw.js` e o fluxo em `updater.js`. Não aumentar o cache por edição apenas de documentação. Atualização de PWA com dados requer backup e conferência de saldos/comprovantes pelo responsável.

Na inspeção de 27/10/2026, a API indicava `main` sem proteção de branch. Exigir revisão e checks é a prática deste guia; não afirmar que a configuração já os torna obrigatórios para merge. Não alterar regras administrativas sem solicitação.

## Roadmap e limites comerciais

Metas de evolução, sem promessa de prazo ou conclusão automática:

1. Consolidar beta privada: controle local, planejamento mensal/12 meses, cálculos, responsividade e restauração de backup confiável.
2. Validar beta multiusuário: Auth, RLS/CAS, recuperação entre aparelhos, entrega de e-mail, antiabuso e operação de backup/desastre em ambiente isolado.
3. Antes de lançamento público: auditoria independente, testes em Android físico e demais dispositivos, políticas LGPD/termos, exclusão/retenção, suporte e monitoramento.
4. Liga pública depende de consentimento, revisão humana, antifraude e regras de disputa. Pontos locais são provisórios; capturas não são publicadas automaticamente. Existe consulta de placar revisado, não autorização para ativar competição ou prêmios em dinheiro.
5. PRO permanece planejado. A tela informa R$ 19,90/mês previsto; recursos adicionais e limites comerciais não estão definidos. Não inventar cotas, benefícios, checkout ou cobrança ativa. A consulta só reconhece PRO com `plan=pro`, status `active`/`trialing` e `period_end` futuro, vindos do servidor.
6. Cobrança requer backend autorizado, webhooks verificados e idempotentes, cancelamento e revisão jurídica. Nunca ativar assinatura por flag local nem permitir escrita do cliente em `rf_subscriptions`. Premiações permanecem desativadas até validação jurídica e operacional.

## Como agentes devem trabalhar e verificar

- Use a menor mudança completa, reaproveitando padrões existentes. Evite dependências, abstrações, reestruturações e melhorias fora do pedido. Código, comentários, documentação e commits devem usar redação normal; respostas ao usuário devem ser concisas em português brasileiro.
- Antes de editar, leia o código envolvido, definições substituídas, chamadores, testes, configurações e impacto nos dados. Para lógica nova ou correção não trivial, deixe teste pequeno que reproduza o comportamento relevante.
- Consulte Context7 quando precisar de documentação atual de bibliotecas/APIs. Envie somente perguntas genéricas, sem credenciais, código privado ou dados pessoais.
- Em alteração documental, confira cada caminho/comando citado e revise o diff; não modificar o app para fazer a descrição parecer verdadeira. Em lógica/cofre/nuvem, execute sintaxe, auditoria e testes pertinentes; em interface, acrescente navegador, responsividade e inspeção visual; em SQL, execute a suite isolada. A CI continua sendo a verificação completa antes do deploy.
- Diferencie verificado no código, registrado em documento histórico, testado localmente, confirmado na CI e ainda pendente. Informe falhas e testes não executados; não declarar “100% seguro”, “conforme LGPD” ou “funciona em todas as plataformas”.
- Atualize este guia quando caminhos, comandos ou invariantes mudarem. Não adicionar credenciais, detalhes pessoais ou dependências de uma máquina específica.

## Limites de acesso ao PC e uso desta cópia

Ter acesso ao GitHub não dá acesso automático ao PC. Um agente só pode ler/escrever os caminhos disponibilizados pela sessão e dentro do escopo autorizado. Uma pasta local pode estar vazia ou não ser um clone; confirme antes de usar Git ou executar testes. Não procurar arquivos pessoais, perfis de navegador, backups, senhas ou outras pastas para completar contexto.

Este arquivo é portátil: salvar como `AGENTS.md` na raiz da pasta local ou do clone mantém as instruções disponíveis. Copiar apenas o documento não baixa o aplicativo, não cria um repositório Git, não instala ferramentas e não sincroniza dados. Não substituir um `AGENTS.md` existente sem ler e preservar as instruções relevantes. Não depender de caminhos absolutos, skills ou arquivos privados do computador do autor para entender este guia.
