# Concessão de administrador master

## Objetivo

O acesso master pertence exclusivamente ao comprador. Nenhuma conta do fornecedor deve permanecer ativa ou receber privilégios por e-mail, domínio ou migration.

## Procedimento de entrega

1. Criar o administrador do comprador pelo fluxo normal de usuários, com domínio corporativo e MFA obrigatório.
2. Aplicar a migration `202609100002_revoke_vendor_master_access.sql`.
3. Executar, em ambiente controlado e usando a service role do comprador:

```bash
node --env-file=.env.local scripts/grant-master-admin.mjs admin@empresa.com
```

4. Conferir o evento `MASTER_ACCESS_GRANTED` no histórico de auditoria.
5. Rotacionar a service role e remover qualquer credencial operacional do fornecedor.

O script só concede o papel a um administrador ativo e registra um hash do e-mail alvo, não o e-mail em texto aberto.
