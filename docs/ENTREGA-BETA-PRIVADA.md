# Entrega técnica da beta privada — Rota Financeira

Consolidação em 28/10/2026. Base funcional publicada: `59faa647b6c08e0efd285c2c2d60091e1aaa5523`, integrada pelo [PR #15](https://github.com/phtrafegopg-ux/rota-financeira/pull/15). Este documento encerra a etapa técnica validada; não libera lançamento público, cobrança ou premiações.

Aplicativo: https://phtrafegopg-ux.github.io/rota-financeira/.

## Entregue e verificado

| Área | Evidência e limite |
| --- | --- |
| Controle e cálculos locais | Lançamentos, contas, dívidas, metas, histórico, projeções e indicadores no cofre individual. Projeções dependem dos dados informados. |
| Cofre e comprovantes | Schema 2, AES-256-GCM e PBKDF2-SHA256 com 310.000 iterações preservados. Imagens cifradas no IndexedDB e incorporadas ao backup portátil. Senha errada, adulteração, quota e operações obsoletas cobertas pelos testes. |
| Recuperação | Arquivo legado/cifrado validado antes da substituição; imagem restaurada em armazenamento independente. Estruturas inválidas e migração legada inválida preservam o destino/origem. |
| Bloqueio e abas | Uma aba desbloqueada por perfil/origem, com Web Locks. Leituras de imagens, uploads e trocas de senha atrasados não reabrem a apresentação do cofre bloqueado nos casos exercitados. |
| Nuvem | Auth, renovação, vínculo de conta, pendência persistente e CAS exercitados com API simulada. RLS/grants/CAS testados em PostgreSQL 16 descartável. Isso não comprova a configuração privada nem a operação do Supabase real. |
| Offline e atualização | Reabertura e ativação de nova versão preservam cofre, imagens e metadados em testes de PWA. Conferência adicional da publicação em HTTPS, com perfis isolados e Supabase bloqueado. |
| Responsividade | Sete telas de 280 a 2560 px em Chromium; emulação não equivale a homologação física de todos os sistemas ou TVs. |
| Relatos do responsável | Preservação dos dados após atualização, consulta em modo avião e restauração do kit fictício no segundo aparelho com comprovante aberto. Modelo, sistema e navegador não informados; não são observação direta do agente. |

## Evidências da versão funcional

- Sintaxe dos oito scripts e auditoria estática aprovadas.
- 17 casos Node, incluindo rejeição de 16 estruturas inválidas antes da gravação.
- Seis suites Chromium/Playwright 1.56.1; a nova suite de auditoria exercita dez cenários.
- Node local 24.22.0. CI usa Node 22 e PostgreSQL 16.
- [Checks e deploy do commit funcional](https://github.com/phtrafegopg-ux/rota-financeira/commit/59faa647b6c08e0efd285c2c2d60091e1aaa5523/checks) aprovados.
- Após o deploy, arquivos `core.js`, `security-center.js` e `sw.js` comparados com o clone. Regressões exercitadas também no site publicado, em contextos descartáveis exclusivamente fictícios.

Os quatro achados da auditoria foram corrigidos no PR #15: comprovante apresentado após bloqueio; importação inválida substituindo o cofre; ausência de pendência após troca de senha/importação; resposta de upload redesenhando Ajustes após bloqueio. Revisão independente acrescentou a exigência da data do saldo inicial, também coberta por regressões. Não se trata de pentest externo nem garantia de ausência de outras falhas.

## Uso e cópia para o PC

1. Guarde backup JSON criptografado fora do repositório antes de atualizar, restaurar ou trocar de aparelho. O agente não deve receber esse arquivo.
2. Feche as abas antigas e reabra o endereço oficial. Use navegador atualizado com Web Locks. Confira saldos e comprovantes por conta própria.
3. Para guardar o projeto no PC, extraia a cópia do código em pasta própria e mantenha `AGENTS.md` na raiz. O ZIP de fontes não é um instalador e não contém seus dados.
4. Abrir `index.html` por `file://` não substitui a PWA. Para desenvolvimento, use localhost e os comandos conferidos em [AGENTS.md](../AGENTS.md).
5. Para recuperar em outro aparelho, use a senha original do backup. Senha do Supabase Auth não recupera a chave do cofre. Nunca importe uma base fictícia sobre a instalação pessoal.

Backup automático exige cofre desbloqueado, app aberto, login válido e consentimento. Só considere a nuvem atualizada após confirmação. Conflitos não são mesclados nem sobrescritos automaticamente. O relatório TXT contém texto claro e deve ser guardado como documento sensível.

## Critérios ainda não concluídos

| Critério | Responsável pela conclusão e evidência necessária |
| --- | --- |
| Homologação física restante | Responsável pelo produto: registrar aparelhos/sistemas/navegadores e executar os casos ainda abertos em [BETA-PRIVADA.md](BETA-PRIVADA.md), inclusive atualização pela barra HTTPS e cancelamento/senha errada no destino. |
| Auth/e-mail/antiabuso em ambiente dedicado | Operador do serviço: contas fictícias, confirmação/recuperação de login, entrega de e-mail, limites e controles de abuso verificados sem usar cofres pessoais. |
| Operação de banco e recuperação de desastre | Operador do serviço: retenção, backups/PITR, restauração ensaiada, monitoramento e resposta a incidentes documentados em ambiente isolado. |
| Proteção administrativa | Proprietário do GitHub/Supabase: confirmar regras de branch, acessos administrativos e configurações privadas. Observações históricas não equivalem ao estado atual confirmado. |
| Privacidade e termos | Responsável pelo produto e revisão especializada: identificar operador/controlador, finalidade, retenção, exclusão/acesso, canal de suporte e documentos aprovados. Nenhuma conformidade LGPD foi certificada. |
| Auditoria externa | Profissional independente: revisar aplicação, infraestrutura, Auth/RLS e operação; registrar achados, correções e aceite. A revisão por agentes não substitui essa etapa. |

Esses itens não são resolvidos por marcar checkboxes, gerar documentos genéricos ou repetir testes simulados. Serviços de produção, dados reais e decisões administrativas/jurídicas não foram alterados neste encerramento.

## Recursos comerciais

PRO permanece informativo, sem checkout ou cobrança. Ranking lê somente resultados publicados por revisão administrativa; não existe publicação automática de comprovantes nem premiação ativa. Pagamentos, antifraude e disputas não fazem parte do aceite desta beta.

**Resultado:** entrega técnica disponível para avaliação privada com backups e os limites acima. Homologação física completa, beta multiusuário operacional e lançamento público/comercial permanecem separados e pendentes.
