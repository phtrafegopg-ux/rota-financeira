# Validação ampliada de recuperação — 27/10/2026

## Escopo e estado

Rodada autorizada pelo responsável para validar recuperação e segurança da beta privada. Base inspecionada: `5fdd39854f2f3ad0aa98e185b6a9e2d9d666d08c`. Os testes usam exclusivamente estado e imagens fictícios, navegadores isolados e respostas de nuvem simuladas. Nenhuma leitura de cofres, dados pessoais ou configuração privada de produção.

Esta rodada não é pentest, certificação de segurança ou avaliação de conformidade LGPD. A revisão por outro agente verifica o código; não substitui auditoria especializada externa.

## Falha encontrada e correção

`changeVaultPass` verificava a senha atual, mas não mantinha o contexto do início da operação até a gravação. Foi reproduzido que bloquear o cofre durante a derivação permitia à operação atrasada reabrir e sobrescrever o armazenamento. Uma operação também não era cancelada após substituição do cofre ou novo salvamento.

Três testes falharam antes da correção. A função agora captura chave, objeto de estado e fila de gravação antes dos awaits; rejeita contexto diferente antes de continuar e por callback antes do commit final de `restorePortableState`. A falha não é convertida em confirmação de sucesso. A troca legítima continua funcionando, preserva comprovantes e gera backup recuperável com a nova senha; o cofre atual rejeita a senha antiga.

Não houve alteração no schema 2, AES-256-GCM, PBKDF2-SHA256/310.000 iterações, RPC, Auth, RLS, PRO ou ranking. O nome do cache PWA foi atualizado para distribuir a correção quando a branch for publicada. Integração/publicação da correção deve ser confirmada pela PR; passar nos testes locais não muda o aplicativo já instalado.

## Evidências desta rodada

| Caso | Evidência | Resultado local |
| --- | --- | --- |
| JSON exportado/importado entre contextos independentes | `tests/browser-smoke.mjs` compara estado e bytes das imagens | Aprovado |
| Contas, dívidas, metas, histórico e notas | Comparação completa de `expandedImages(data)`, removendo apenas referências IndexedDB específicas do contexto | Aprovado |
| Senha errada, cancelamento, JSON inválido e ciphertext adulterado | Cofre e imagem preexistentes no destino permanecem iguais | Aprovado |
| Comprovante cifrado e vínculo da referência | Registro contém ciphertext; copiar para outra referência causa falha de autenticação AES-GCM | Aprovado |
| Troca legítima de senha e novo backup | Imagem preservada; senha antiga rejeitada no cofre novo; backup novo restaura todos os campos em outro contexto | Aprovado |
| Bloqueio, outro cofre e edição durante troca de senha | Três regressões em `tests/restore-commit.mjs`, reproduzidas antes e aprovadas depois | Aprovado após correção |
| Falha de quota ao gravar restauração | Exceção injetada; estado, chave e armazenamento anteriores preservados | Aprovado |
| Sessões, refresh, restauração e criptografia | 16 testes Node nos três arquivos já executados pela CI | Aprovado |
| Nuvem simulada, revisão e vínculo de conta | `tests/cloud-flow.mjs`; destinatário não tenta upload | Aprovado |
| Layout de 280 a 2560 px | `tests/responsive-layout.mjs` | Aprovado |
| Reabertura offline e ativação de atualização | `tests/pwa-offline.mjs` preserva estado, prova, metadados e caches alheios | Aprovado |
| Sintaxe de oito scripts, auditoria estática e diff | Comandos existentes no workflow e `git diff --check` | Aprovado |

Ambiente local: Node 24.22.0, Playwright 1.56.1 e Chromium. CI usa Node 22/PostgreSQL 16; os checks da PR desta rodada são a evidência remota, sem presumir aprovação antes de terminarem. A porta padrão 8765 estava em uso por outro projeto: o teste básico passou a aceitar `RF_TEST_PORT`; nenhum processo alheio foi encerrado.

Revisão independente do diff: nenhum achado Critical/Important/Minor no escopo; o revisor executou os seis casos de restauração/troca de senha. A bateria de navegador foi executada pelo agente responsável. Não foram reavaliadas concorrência entre abas nem todas as funções preexistentes do aplicativo.

## Verificação física e limites restantes

- O responsável confirmou preservação dos dados antigos e consulta em modo avião no aparelho principal. É relato do responsável, sem captura, modelo ou versão técnica. Nenhuma informação financeira foi solicitada.
- O responsável confirmou disponibilidade de outro aparelho. Preparar/restaurar apenas base fictícia em instalação vazia ou perfil separado; não substituir dados existentes para validar.
- O arquivo fictício para homologação deve ficar fora do repositório, identificado como teste, com valores conhecidos e comprovante sem validade fiscal. A senha desse arquivo é exclusivamente de teste.
- Continuam pendentes até confirmação específica: restauração física no segundo aparelho, visualização da imagem recuperada, gravação offline, instalação e atualização pela interface HTTPS em dispositivos reais.
- Auth/e-mail/antiabuso reais, backups/PITR, exclusão/retenção, termos/privacidade e avaliação LGPD não foram validados nesta rodada. Não usar os resultados para declarar liberação comercial.

## Aceite

As verificações automatizadas acima estão aprovadas na branch. A falha encontrada precisa estar integrada e publicada antes de ser considerada corrigida no app em uso. Homologação física e avaliação especializada permanecem etapas separadas; não marcar essas etapas como concluídas com base em emulação.
