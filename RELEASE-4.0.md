# Rota Financeira 4.0 — Segurança e experiência premium

## Entregas desta versão

- **Código e privacidade:** extrair a lógica JavaScript do HTML para `core.js`, reforçando a política `script-src 'self'`. Remover avisos específicos de dívidas de uma única pessoa e datas fixas de início; um novo motorista recebe um cofre vazio e planejamento relativo ao mês atual.
- **Interface:** painel móvel com KPIs de receita líquida e bruta, custos das plataformas, número de dias registrados e barras dos últimos sete dias do mês selecionado. Dados calculados exclusivamente do cofre já desbloqueado no dispositivo, sem chamadas externas.
- **Planejamento:** projeção do saldo de abertura do mês vinculada ao saldo inicial e lançamentos de cada usuário, em vez de um mês fixo de 2026.
- **Backup:** registrar localmente o estado de alterações ainda não confirmadas, manter aviso após reiniciar o aplicativo e recuperá-lo ao autenticar, inclusive para gravações em versões anteriores detectadas por timestamps.
- **Conta:** botão para encerrar a sessão Supabase apenas no dispositivo, sem apagar o cofre local e sem enviar dados inadvertidamente. Alternância de usuários permanece condicionada a exportação, login e restauração consciente; não há fusão automática.
- **Plano PRO:** interface informativa Grátis / PRO (R$ 19,90 como preço **planejado**); sem checkout nem ativação de pagamento. A consulta de status é feita somente pelo servidor e exige período válido de assinatura.
- **Testes:** CI com Chromium simulando celular e desktop; validações de layout, login, recovery, pendências de backup, conflito de revisão, logout e isolamento PostgreSQL.

## Invariantes importantes

1. **Nenhum dado financeiro pode ir para o repositório GitHub.** O aplicativo usa chave publicável de projeto, não `service_role`.
2. A nuvem recebe JSON cifrado com AES-GCM e apenas depois do consentimento do motorista, ou quando ele clica em sincronizar com login ativo.
3. Os comprovantes permanecem dentro do backup criptografado. Os pontos locais não se tornam oficiais sem revisão.
4. A revisão de segurança não garante invulnerabilidade. Precisamos de auditoria independente, teste de desastre, testes no Android físico e avaliação da LGPD antes do lançamento.
5. A função `public.rf_write_vault` usa `SECURITY DEFINER` intencionalmente para executar escrita CAS revogada de tabela direta. A auditoria Supabase ainda emite alerta sobre esse privilégio; requer avaliação especializada.
6. O painel do Supabase está com **proteção contra senhas comprometidas desabilitada** (aviso do advisor). Ativá-la e configurar limites de autenticação antes de um beta aberto, conforme https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
7. O app nunca deve garantir sincronização completa sem receber confirmação do servidor. Avisos visuais de pendência são fundamentais.
8. Não há qualquer sistema de cobrança em produção, pagamento confirmado por webhook ou prêmio em dinheiro ativado.

## Após publicar

- Fazer backup manual criptografado antes de atualizar o PWA.
- Abrir o app atualizado, desbloquear o cofre e conferir saldos, metas, comprovantes e contas.
- Se houver alterações locais pendentes, autenticar na mesma conta e verificar revisão do servidor antes de sincronizar.
- Confirmar que o gráfico do mês corresponde aos registros de plataformas e que a Central de proteção indica a última cópia confirmada ou a pendência real.
- Testar logout da nuvem: a sessão deve terminar sem excluir os dados do aparelho.
- Não testar pagamentos reais, premiações ou múltiplas escritas concorrentes na conta financeira principal.
