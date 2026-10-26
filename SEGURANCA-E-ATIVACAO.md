# Rota Financeira 3.1 — Segurança e implantação

## Estado real

- Cofre financeiro local: AES-256-GCM com senha derivada via PBKDF2 (310.000 iterações).
- Comprovantes grandes: IndexedDB com criptografia AES-GCM separada; backups portáteis incorporam imagens.
- Novo design moderno: visual responsivo, foco visível e respeito a movimento reduzido.
- Cadastro/login: Supabase Auth **somente após** criar projeto e ativar autenticação no painel do Supabase.
- Backup automático: **opt-in**, criptografado, somente enquanto estiver com o app aberto e uma sessão de nuvem válida.
- Prevenção de perda: escrita atômica via RPC \`rf_write_vault\`, com revisão por usuário; divergências bloqueiam sobrescrita.
- Recuperação: por senha ORIGINAL do cofre. Redefinir a senha do login do Supabase NÃO recupera a senha de criptografia. Nunca prometa recuperação sem a senha.
- Liga: pontos locais continuam PROVISÓRIOS; visualização online lê apenas \`rf_weekly_rankings\` preenchido por revisão administrativa. Nenhum print envia dados automaticamente ao ranking.
- Assinaturas: acesso PRO é consultado no servidor via \`rf_subscriptions\`; **não há checkout, cobrança nem ativação paga**, pois faltam o provedor de pagamento, webhooks e conformidade legal.
- Premiações: não habilitadas, dependem de antifraude e avaliação jurídica.
- **Não foi realizada auditoria independente, pen test nem avaliação LGPD final. Não existe garantia 100% de segurança.**

## Configuração obrigatória da nuvem

1. Crie um projeto Supabase próprio usando conta sob seu controle e habilite confirmação de e-mail, senha forte e medidas antiabuso em Authentication.
2. No SQL Editor, execute \`supabase/01_seguro.sql\`. Revise o SQL antes em ambientes que já tenham dados.
3. Confirme com duas contas de teste: cada conta só lê seu \`finance_vault\`; requests de inserção/atualização direta da tabela retornam sem permissão; a RPC rejeita revisões antigas.
4. No Rota Financeira, abra Ajustes > Nuvem, informe URL do projeto e chave **publishable/anon**, jamais \`service_role\`, e cadastre-se.
5. **Exporte backup criptografado do aparelho antes de restaurar ou ativar nuvem.**
6. Se a nuvem já tiver cópia existente, restaure-a ou reconcilie manualmente o histórico antes de enviar. O aplicativo bloqueia sobrescrita sem revisão conhecida.
7. Ative backup automático em Central de proteção. O backup funciona enquanto o app estiver aberto, com cofre desbloqueado e login ativo.
8. Para trocar de aparelho: guarde arquivo de backup criptografado; instale no novo aparelho, crie um cofre temporário, faça login e restaure usando a senha ORIGINAL do backup.
9. Teste um conflito de duas sessões; sem revisão correspondente, o segundo envio deve ser bloqueado (não mesclar versões automaticamente).

## Segurança operacional

- Nunca compartilhe prints com nome, saldo ou localização de passageiros.
- A nuvem guarda apenas JSON cifrado; a senha do cofre permanece local.
- \`localStorage\` conserva metadados não secretos de sincronização, e a sessão de nuvem fica na memória; ela não persiste ao reiniciar.
- Dados do primeiro navegador não passam automaticamente ao domínio publicado. Use backup criptografado para migração.
- Há limite operacional de 5 MB para o cofre cifrado no banco; o envio de imagens grandes pode exigir arquitetura separada de objetos criptografados. Não elimine registros sem backup.
- Se o dispositivo tiver malware ou um script malicioso de primeira parte for publicado, criptografia local não elimina esse risco. É necessária revisão de dependências, MFA, monitoramento e testes externos.
- Revise políticas de privacidade, termos, retenção de dados, exclusão de conta e incidentes antes de aceitar outros motoristas.

## Pendências bloqueadoras para comercialização

1. Configuração Supabase em conta sob controle da empresa e testes reais de isolamento de duas contas.
2. Fluxo seguro de redefinição de senha de login e recuperação com chave de emergência independente para o cofre (não implementado).
3. Validação de comprovantes fora do navegador, consentimento explícito, retenção mínima e equipe/regras de revisão; pontuação oficial não pode confiar somente em OCR.
4. Provedor de pagamentos e webhook verificado no servidor com idempotência; nunca definir PRO pelo cliente.
5. Análise das condições legais de atividade empresarial para militar da ativa, normas de promoções comerciais e LGPD.
6. Testes de segurança externos (pentest), análise de dependências, restauração e recuperação de desastres.

## Ordem de lançamento recomendada

- Beta privada: local/offline, design, cofre e backup criptografado testados.
- Beta multiusuário: autenticação, RLS, backup sincronizado com CAS, restauração testada entre aparelhos.
- Liga pública: revisão humana de comprovantes, disputas e consentimento, resultados anônimos.
- Assinaturas: checkout, webhooks, cancelamentos, suporte e obrigações jurídicas validadas.

**Não coloque dados pessoais no GitHub**, pois o repositório é público.
