# Plano da auditoria avançada — etapa 1

Escopo autorizado: GitHub phtrafegopg-ux/rota-financeira e Supabase ycblzalwgzgcpjbjcfvy.
Preservar usuários, cofre e esquema criptográfico. Executar nesta sessão em branch própria.

- [x] Consultar advisors, políticas, privilégios e definição da RPC sem ler o conteúdo dos cofres.
- [x] Examinar Auth público, armazenamento de sessão, importação/exportação, criptografia e publicação.
- [x] Reproduzir respostas atrasadas de login e leitura após mudança de contexto em testes isolados.
- [x] Invalidar operações pendentes após bloqueio, logout, novo login ou mudança de cofre/conta.
- [x] Corrigir falso positivo do teste SQL de revisão obsoleta e adicionar casos negativos.
- [x] Exigir testes de navegador e PostgreSQL antes da publicação; publicar apenas arquivos do app.
- [ ] Executar verificações completas, abrir PR e registrar resultados e limitações.

Revisar especialmente: bloqueio durante requisição, troca A/B durante leitura, renovação concorrente,
backup existente sem âncora local, restauração com senha errada e revisão obsoleta.
