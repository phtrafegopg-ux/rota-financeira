# Tutorial dentro do aplicativo

Pedido: permitir assistir no próprio Rota Financeira ao vídeo narrado já aprovado, inclusive pelo celular.

Decisão: player HTML nativo em modal, com controles e `playsinline`, aberto por botão na tela de acesso e em Ajustes. Sem login, autoplay, dependência ou serviço externo. Arquivo público sintético com aproximadamente 9 MB, servido pelo mesmo GitHub Pages. `preload=none`; fora do cache offline. Link direto em outra aba como alternativa ao player.

Alternativa descartada: hospedar em plataforma externa exigiria outra conta/publicação e dependência de player de terceiros. Não modificar a edição nem os dados financeiros.

## Escopo e verificação

- [x] Adicionar regressão de navegador antes da implementação: acesso bloqueado e Ajustes, nenhum carregamento antecipado do MP4, modal responsivo e armazenamento intacto.
- [x] Copiar somente o MP4 validado para `tutorial-rota-financeira.mp4` e conferir hash; extrair uma capa leve em `tutorial-poster.jpg` e publicar somente esses dois arquivos específicos na allowlist de `.github/workflows/pages.yml`.
- [x] Reaproveitar modal/eventos existentes em `core.js`, com painel compartilhado nas duas telas; estilos na camada responsiva.
- [x] Atualizar versão do cache dos scripts/estilos, mantendo o vídeo fora de `ASSETS`.
- [x] Executar sintaxe, auditoria, Node e suites de navegador; conferir capturas e revisão independente.
- [ ] Abrir PR, verificar checks e publicar somente com autorização correspondente. Conferir resposta HTTP e acesso isolado depois do deploy.

Limites: assistir exige conexão; não comprovar reprodução em todos os aparelhos por teste de desktop. O vídeo usa apenas dados fictícios e apresenta a beta privada. Nenhum armazenamento do usuário deve ser lido ou alterado para assistir.

## Evidência local

A regressão falhou antes da implementação, por ausência do botão. Depois passaram sintaxe dos oito scripts, auditoria estática, 17 testes Node e seis suites de navegador. A suite browser-smoke verifica o MP4 real por HTTP, acesso sem cofre e em Ajustes, ausência de carregamento antecipado, modal em 280/390/820/1920 px e armazenamento inalterado. Capturas móveis foram inspecionadas. Arquivo idêntico ao MP4 exportado e validado; capa extraída da demonstração fictícia.

Revisão independente não confirmou achado importante; ffprobe conferiu H.264/yuv420p + AAC, 1080×1920 e 4min18s. Não houve leitura de dados reais, alteração de formato do cofre ou validação física de todos os celulares. A confirmação da publicação deve vir dos checks do commit atual e de uma verificação HTTPS isolada após o deploy.
