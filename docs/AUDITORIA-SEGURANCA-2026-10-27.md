# Auditoria avançada de segurança — Rota Financeira

Data: 27/10/2026. Escopo: versão 4.1, Supabase ycblzalwgzgcpjbjcfvy e publicação GitHub Pages.
Esta revisão não é uma certificação de ausência de vulnerabilidades.

## Evidências e preservação

Consultados advisors de segurança, catálogo de tabelas/views, políticas RLS, privilégios da RPC e das tabelas, histórico de migrações, logs agregados e configuração pública de Auth. Não foram consultados ciphertext, e-mails de usuários, senhas, tokens administrativos ou conteúdo financeiro. Nenhum DDL/DML foi executado em produção. Testes de banco usam apenas usuários fictícios em PostgreSQL descartável na CI.

## Achados corrigidos na branch

| Achado | Efeito e correção | Verificação |
|---|---|---|
| Login atrasado após bloqueio | Resposta podia recriar a sessão; geração de sessão e chave do cofre precisam continuar válidas | Reproduzido antes; teste passou após correção |
| Respostas de leitura após troca de conta | Resultado da conta anterior podia ser aceito; verificar contexto antes/depois das operações | Reproduzido antes; teste passou após correção |
| Renovação concorrente com nova sessão | Respostas antigas não podem substituir a sessão nova nem limpar sua renovação | Testes de renovação, login novo e bloqueio |
| Upload durante bloqueio/troca de cofre | Cancelar antes da gravação e antes de atualizar a âncora local | Teste de empacotamento interrompido |
| Backup grande | Conversão Base64 com spread de todos os bytes causava estouro de pilha; converter em blocos | Falha reproduzida com 400 mil caracteres; round-trip passou |
| Falso positivo no teste CAS | O teste capturava a própria exceção de falha como se fosse conflito esperado | Exigir mensagem RF_REVISION_CONFLICT; suite SQL ampliada |
| Deploy sem depender dos testes | Publicação passa a depender das suites de segurança/navegador e PostgreSQL do mesmo commit | Workflows reutilizáveis e needs no deploy |
| Publicação de arquivos internos | Artefato Pages passa a conter apenas arquivos estáticos do app | Diretório public-site preparado explicitamente |

O formato schema 2, AES-256-GCM, PBKDF2-SHA256 com 310.000 iterações, salts e chaves existentes permanecem compatíveis. Tokens continuam somente em memória. Senha do formulário de nuvem é limpa também em falhas. Cache PWA recebe nova versão para distribuir as correções.

## Exceção técnica mantida: SECURITY DEFINER

Advisor `authenticated_security_definer_function_executable` permanece visível e não foi declarado resolvido.
A RPC `public.rf_write_vault(jsonb,bigint)` é intencionalmente a única escrita disponível ao cliente.
Ela obtém o dono de `auth.uid()` e não de um parâmetro; usuários comuns têm somente SELECT no cofre,
sem INSERT/UPDATE/DELETE. A revisão esperada evita substituição silenciosa por versões antigas.
`anon` não tem EXECUTE; `PUBLIC` não tem grant de execução. Clientes não têm CREATE no schema public.
O search_path atual é fixado em pg_catalog,public; tabelas e auth.uid estão qualificadas.
Trocar para INVOKER sem redesenhar os privilégios quebraria a escrita; conceder escrita direta para silenciar o aviso enfraqueceria CAS.

Aceitação técnica restrita a esta arquitetura e esta versão, sujeita a revisão quando a RPC mudar.
Ela executa como proprietário privilegiado e contorna RLS: a checagem explícita do dono é indispensável.
A validação do envelope é estrutural; o banco não possui a chave para provar que o ciphertext é um cofre íntegro.
Integridade criptográfica é verificada no dispositivo ao restaurar.
[Orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Pendências externas e riscos residuais

| Situação | Estado e ação necessária |
|---|---|
| Leaked Password Protection | Desabilitada, confirmada pelo advisor. Organização no plano Free. A documentação exige Pro ou superior. Exige decisão de custo e ativação no painel; não houve upgrade nem falsa correção por validação apenas no navegador |
| Configuração privada de Auth | Conector não fornece leitura/alteração de configuração de Auth. JWT TTL, limites, CAPTCHA, allowlist de redirects, MFA e reautenticação ainda exigem conferência pelo responsável no painel |
| Backups/PITR do provedor | Retenção, habilitação e teste de restauração do provedor não foram verificáveis com o conector. Exportação criptografada do app não equivale a backup operacional/PITR. Testar recuperação em ambiente isolado e manter cópia externa criptografada |
| Proteção da main | API informa main sem proteção de branch. A trava de deploy protege o workflow proposto; administrador pode alterar workflows ou fazer push direto. Configurar revisão e checks obrigatórios no repositório |
| Logout e tokens já emitidos | Logout atual é local: remove tokens da memória. Não promete revogação de um token já copiado; JWT pode permanecer válido até expirar. Exige política de TTL/revogação e eventual checagem de sessão no servidor para garantia mais forte |
| Requisição já recebida pelo servidor | Invalidar contexto evita novas etapas e confirmações locais; não desfaz um upload já aceito pelo servidor antes do bloqueio. CAS e vínculo do usuário continuam sendo a proteção do lado do banco |
| XSS, extensão maliciosa, aparelho comprometido | Cofre desbloqueado está em memória. CSP bloqueia scripts externos/inline, mas connect-src ainda permite HTTPS amplo para instalações próprias. Metadados de sincronização ficam no localStorage. Não há garantia contra código com controle da mesma origem/aparelho |
| Relatório TXT | Exportação deliberada contém informações financeiras em texto claro. Guardar como documento sensível; backup JSON continua criptografado |
| Senha e dispositivo perdidos | Não existe recuperação da chave pelo servidor. Exigir senha forte e cópias criptografadas testadas, guardadas separadamente da senha |

[Senha vazada e disponibilidade por plano](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Nenhuma destas pendências é contabilizada como resolvida ou como aceite definitivo do responsável.

## Auth e RLS observados

Auth público: cadastro por e-mail ativo, confirmação de e-mail exigida (`mailer_autoconfirm=false`), login anônimo desabilitado, provedores sociais e telefone desabilitados.
A API pública recusou com 401 tanto SELECT do cofre quanto RPC sem login; o teste da RPC usou envelope vazio, rejeitado sem gravação.
Todas as três tabelas públicas e as tabelas Storage inspecionadas têm RLS. Não há views públicas no catálogo consultado.
Cofres e assinaturas são legíveis somente pelo próprio auth.uid(); ranking oficial é legível por autenticados, intencionalmente, sem escrita do cliente.
Não há políticas Storage concedendo acesso a usuários neste projeto. Logs disponíveis foram apenas contados por serviço; isto não prova ausência de incidentes.

## Modelo de ameaças

| Ator ou falha | Ativo/limite | Controles e limite remanescente |
|---|---|---|
| Visitante sem login | Cofre, assinatura, RPC | Grants mínimos, RLS e Auth; chamadas anônimas rejeitadas |
| Usuário autenticado B | Dados de A | auth.uid no banco, SELECT por dono, RPC sem user_id externo; testes A/B e tentativa de user_id no JSON |
| Segundo aparelho com revisão antiga | Cofre atualizado | CAS transacional no servidor, âncora vinculada à conta e bloqueio de conflito |
| Resposta de rede atrasada | Sessão e âncora atuais | Geração da sessão, identidade e chave verificadas; não desfaz requisição concluída |
| Arquivo adulterado/senha errada | Restauração local | AES-GCM antes da substituição, consentimento e testes de cancelamento/senha errada |
| Roubo do armazenamento local | Dados e imagens em repouso | Cofre e comprovantes criptografados; força da senha determina resistência a ataque offline |
| Comprometimento da conta GitHub/SQL admin | Código entregue e dados do servidor | Deploy com testes reduz erro acidental; não protege contra administrador malicioso. Branch protection pendente |
| Falha/quota/limpeza do aparelho | Disponibilidade | Avisos locais e exportação; backup externo e recuperação do provedor ainda precisam de operação humana |

## Validação

Testes novos: doze casos de sessão e criptografia, sem usuários reais. Suites existentes: auditoria estática, navegador básico, fluxo de nuvem simulado (inclui cancelar/errar/acertar senha na restauração), responsividade e PostgreSQL RLS/CAS em CI.
O resultado definitivo da CI e a URL da PR são registrados no resumo de entrega. Somente checks aprovados permitem o job de publicação. Não executar os arquivos tests/sql no projeto real.
