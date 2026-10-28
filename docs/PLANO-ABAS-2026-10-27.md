# Proteção entre abas — plano e evidências

## Problema reproduzido

Base: `5186a2423f006d2c1f632c1d618beecfeb5b6e4e`. Duas abas do mesmo perfil puderam desbloquear o mesmo cofre. Uma alteração da primeira foi substituída pela cópia antiga da segunda; o teste falhou com resultado `saved` na aba obsoleta. Nenhum dado real foi usado.

## Decisão de implementação

Permitir apenas um cofre desbloqueado por vez no mesmo perfil/origem, usando Web Locks com o nome da chave local. É uma escolha do agente para evitar tratar separadamente gravações do cofre, imagens e sincronização de duas cópias divergentes. A alternativa de CAS por gravação exigiria coordenar também exclusão de imagens, importação, mudança de senha e nuvem.

O bloqueio fica reservado enquanto a aba está desbloqueada. Ao bloquear o cofre, a reserva só é liberada depois da fila de salvamento; fechar a aba libera a reserva pelo navegador. Senha incorreta e falha na criação devem liberar a reserva. A primeira criação revalida se outra aba já criou o cofre, sem sobrescrever nada.

Compatibilidade: Web Locks requer navegador atualizado e contexto seguro. Se a API não estiver disponível, informar a necessidade de atualização, sem abrir edição desprotegida ou modificar o cofre. Essa restrição deve ficar explícita; não simular exclusão mútua com uma flag em localStorage. Não há nova dependência nem alteração do formato criptográfico.

As outras abas podem continuar abertas na tela de acesso; para usá-las, bloquear ou fechar a aba que mantém o cofre aberto. Todas as abas precisam executar a versão atualizada; código antigo, extensões ou scripts com controle da origem não são um limite de segurança oferecido por esta proteção.

## Tarefas

- [x] Reproduzir gravação obsoleta em duas abas reais do mesmo contexto Chromium.
- [x] Acrescentar a reserva de edição na criação/desbloqueio e liberar após a fila ao bloquear.
- [x] Validar segunda aba bloqueada, liberação por bloqueio/fechamento, senha errada, fila pendente, criação concorrente e navegador sem API.
- [x] Rodar suites existentes, integrar `node tests/multi-tab.mjs` na CI e revisar o diff de forma independente.
- [x] Registrar a confirmação relatada pelo usuário: restauração no segundo aparelho e comprovante aberto; modelo e navegador não informados.
- [ ] Entregar PR com evidências, sem assumir autorização de publicação para alterações novas.

## Revisão e correções relacionadas

A revisão independente confirmou dois achados importantes no fluxo de transferência, ambos reproduzidos também pelo executor:

1. Bloquear durante a gravação de um comprovante fazia a conferência usar a chave global já limpa; o catch apagava uma imagem cuja referência já estava persistida. O anexo agora captura chave/estado, valida o contexto antes de anexar, verifica o snapshot devolvido por `save(true)` com a chave capturada e nunca apaga imagens após a gravação confirmada. Respostas tardias não renderizam o cofre bloqueado. O teste reproduziu “Imagem não encontrada” antes e recuperou os mesmos bytes na segunda aba depois da correção.
2. A segunda aba carregada antes da edição não recuperava o indicador de backup pendente. A camada segura agora relê o marcador persistido ao desbloquear e ao autenticar. O teste falhou com `dirty:false` apesar do marcador existente; depois passou com `dirty:true`.

Não houve novo formato de cofre, alteração de RLS/CAS, ativação de PRO, pagamento ou leitura de dados reais. Ao atualizar, guardar backup e fechar/reabrir todas as abas antigas do aplicativo; abas ainda executando código anterior não participam da proteção nova.

O responsável confirmou em conversa que o cofre fictício foi restaurado no segundo aparelho e o comprovante abriu. A confirmação foi registrada nos documentos de homologação sem inventar modelo ou versão do navegador.

Verificação final local: sintaxe dos oito scripts, auditoria estática, 16 testes Node e cinco suites Chromium/Playwright 1.56.1 aprovados. O revisor reproduziu os dois achados; o executor aplicou as correções e confirmou regressões e suite completa. Node local 24.22.0; os checks do commit da PR confirmam Node 22 e PostgreSQL 16, sem antecipar seu resultado.

Referência técnica: [Web Locks — W3C](https://www.w3.org/TR/web-locks/). Os locks exclusivos de um mesmo nome são coordenados entre contextos da mesma origem e liberados ao concluir a callback.
