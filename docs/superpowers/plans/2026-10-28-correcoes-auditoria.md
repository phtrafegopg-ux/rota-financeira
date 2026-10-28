# Correções da auditoria

> Execução: superpowers:executing-plans, no clone atual em branch própria; preservar dependências e arquivos do usuário.

Objetivo: corrigir os quatro casos reproduzidos na auditoria do commit f90f830, sem mudar formato de backup, parâmetros criptográficos, SQL ou recursos comerciais.

## Escopo

- `core.js`: validar conteúdo antes da restauração; descartar visualização de comprovante atrasada após bloqueio/troca de cofre.
- `security-center.js`: marcar alterações confirmadas por restauração local/troca de senha; preservar limpeza de pendência e opt-in na restauração remota; impedir renderização de upload obsoleto.
- `tests/audit-regressions.mjs`, `tests/restore-commit.mjs`: regressões de navegador e conteúdo inválido; dados exclusivamente fictícios.
- Workflow, AGENTS e cache: incorporar a nova suite e distribuir os recursos atualizados.

## Passos

- [x] Escrever regressões e verificar falhas antes das correções.
- [x] Corrigir visualização e resposta tardias com contexto capturado.
- [x] Validar tipos, datas, valores e coleções usados pelos renderizadores antes de substituir dados, preservando campos opcionais históricos.
- [x] Marcar pendência após gravação confirmada, sem enviar automaticamente o cofre recém-restaurado da nuvem.
- [x] Executar testes Node, navegador, responsividade/PWA/abas e verificar diff.
- [x] Revisar e abrir PR com evidências; PR #15 integrado e publicado após autorização do responsável.

Riscos a verificar: senha errada e quota preservam estado; backup antigo válido continua aceito; bloqueio/login novo invalidam respostas; restauração remota mantém opt-in desligado; nenhuma imagem referenciada é excluída.

## Evidência local

Auditoria estática, sintaxe dos oito scripts, 17 casos Node e seis suites Chromium/Playwright 1.56.1 aprovados. A nova suite possui dez cenários; a validação de conteúdo cobre 16 estruturas inválidas antes de tocar nas imagens/cofre. O teste legado inválido também falhou antes de corrigir a migração.

Uma fixture antiga injetava entrada sem id, diferente do formulário real; recebeu id sintético. Os testes completos de recuperação continuam comparando estado e imagem. Campos opcionais históricos são preservados; dados malformados são recusados sem substituição. Nenhum backup pessoal foi aberto e nenhum SQL foi alterado/aplicado. Node local 24.22.0; PostgreSQL 16/Node 22 dependem dos checks da PR atual.

## Revisão independente

O revisor reproduziu a ausência de settings.initialDate aceita pela primeira versão da validação. O campo é necessário ao renderizador e passou a ser obrigatório; regressões cobrem ausência em arquivo cifrado e legado e preservação do destino. Fixtures Node esparsas receberam data sintética válida, sem enfraquecer os asserts. Não foram confirmados outros achados importantes no diff revisado. A correção desse achado foi verificada pelo executor; não há afirmação de pentest externo.

## Publicação confirmada

[PR #15](https://github.com/phtrafegopg-ux/rota-financeira/pull/15), commit `59faa647b6c08e0efd285c2c2d60091e1aaa5523`: checks Node 22/PostgreSQL 16 e deploy aprovados. Verificação após publicação confirmou arquivos, abertura offline, proteção entre abas e os dez cenários de regressão com dados fictícios e Supabase bloqueado. A revisão externa e demais critérios de lançamento continuam pendentes, conforme [entrega consolidada](../../ENTREGA-BETA-PRIVADA.md).
