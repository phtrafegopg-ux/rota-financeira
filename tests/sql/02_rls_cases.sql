-- Executar após o schema de segurança; autenticação JWT simulada em ambiente local.
\set ON_ERROR_STOP on

DO $$
BEGIN
 IF has_function_privilege('anon','public.rf_write_vault(jsonb,bigint)','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: RPC acessível sem login';
 END IF;
 IF has_table_privilege('anon','public.finance_vault','SELECT') THEN
   RAISE EXCEPTION 'FAIL: cofre legível sem login';
 END IF;
 IF has_table_privilege('authenticated','public.finance_vault','INSERT') THEN
   RAISE EXCEPTION 'FAIL: escrita direta no cofre habilitada';
 END IF;
 IF has_table_privilege('authenticated','public.finance_vault','UPDATE') THEN
   RAISE EXCEPTION 'FAIL: update direto no cofre habilitado';
 END IF;
 IF has_table_privilege('authenticated','public.rf_weekly_rankings','INSERT') THEN
   RAISE EXCEPTION 'FAIL: ranking editável pelo cliente';
 END IF;
 IF has_table_privilege('authenticated','public.rf_subscriptions','UPDATE') THEN
   RAISE EXCEPTION 'FAIL: assinatura editável pelo cliente';
 END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT * FROM public.rf_write_vault(
 '{"schema":2,"ciphertext":"cipher-a","salt":"salt-a","iv":"iv-a"}',0);
DO $$
DECLARE r integer;
BEGIN
 SELECT count(*) INTO r FROM public.finance_vault;
 IF r<>1 THEN RAISE EXCEPTION 'FAIL: usuário A não vê próprio cofre'; END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$
DECLARE r integer;
BEGIN
 SELECT count(*) INTO r FROM public.finance_vault;
 IF r<>0 THEN RAISE EXCEPTION 'FAIL: vazamento de A para B'; END IF;
END $$;
SELECT * FROM public.rf_write_vault(
 '{"schema":2,"ciphertext":"cipher-b","salt":"salt-b","iv":"iv-b"}',0);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$
DECLARE r integer;
BEGIN
 SELECT count(*) INTO r FROM public.finance_vault;
 IF r<>1 THEN RAISE EXCEPTION 'FAIL: usuário A vê outros cofres'; END IF;
END $$;

-- Tentativa de sobrescrita com revisão obsoleta deve falhar e preservar dados.
DO $$
BEGIN
 PERFORM * FROM public.rf_write_vault(
  '{"schema":2,"ciphertext":"ATTACK","salt":"x","iv":"x"}',0);
 RAISE EXCEPTION 'FAIL: CAS aceitou revisão 0 para registro existente';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 IF SQLERRM <> 'RF_REVISION_CONFLICT' THEN RAISE; END IF;
END $$;
DO $$
DECLARE stored text;
BEGIN
 SELECT vault->>'ciphertext' INTO stored FROM public.finance_vault;
 IF stored <> 'cipher-a' THEN RAISE EXCEPTION 'FAIL: CAS sobrescreveu dado'; END IF;
END $$;

-- Upgrade com revisão correta funciona uma vez.
SELECT * FROM public.rf_write_vault(
 '{"schema":2,"ciphertext":"cipher-a-v2","salt":"salt-a","iv":"iv-a"}',1);
DO $$
DECLARE currrev bigint;
BEGIN
 SELECT revision INTO currrev FROM public.finance_vault;
 IF currrev <> 2 THEN RAISE EXCEPTION 'FAIL: revisão não incrementou'; END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$
DECLARE paid integer;
BEGIN
 SELECT count(*) INTO paid FROM public.rf_subscriptions;
 IF paid<>0 THEN RAISE EXCEPTION 'FAIL: assinatura de outra conta visível'; END IF;
END $$;
COMMIT;

SELECT 'PASS — isolamento A/B, CAS, e tabelas comerciais em modo leitura' AS resultado;

-- Negative cases must fail with the exact intended error (not our assertion).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
 PERFORM * FROM public.rf_write_vault('{"schema":2,"ciphertext":"x","salt":"x","iv":"x"}',0);
 RAISE EXCEPTION 'FAIL: RPC aceitou sessão sem identidade';
EXCEPTION WHEN SQLSTATE '28000' THEN NULL;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
 PERFORM * FROM public.rf_write_vault('{}',0);
 RAISE EXCEPTION 'FAIL: anon executou RPC';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ BEGIN
 PERFORM * FROM public.rf_write_vault('{"schema":2,"ciphertext":"x","salt":"x","iv":"x"}',-1);
 RAISE EXCEPTION 'FAIL: revisão negativa aceita';
EXCEPTION WHEN SQLSTATE '22023' THEN
 IF SQLERRM <> 'INVALID_REVISION' THEN RAISE; END IF;
END $$;
DO $$ BEGIN
 PERFORM * FROM public.rf_write_vault('{"schema":2}',2);
 RAISE EXCEPTION 'FAIL: envelope inválido aceito';
EXCEPTION WHEN SQLSTATE '22023' THEN
 IF SQLERRM <> 'INVALID_ENCRYPTED_VAULT' THEN RAISE; END IF;
END $$;
DO $$ BEGIN
 PERFORM * FROM public.rf_write_vault('{"schema":2,"ciphertext":"ATTACK","salt":"x","iv":"x","user_id":"22222222-2222-4222-8222-222222222222"}',2);
 IF EXISTS (SELECT 1 FROM public.finance_vault WHERE user_id <> auth.uid()) THEN
  RAISE EXCEPTION 'FAIL: user_id do JSON alterou proprietário';
 END IF;
END $$;
ROLLBACK;
