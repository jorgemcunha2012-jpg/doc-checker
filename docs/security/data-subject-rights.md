# Direitos do titular de dados

## Escopo

O procedimento atende solicitações de confirmação, acesso e eliminação de dados pessoais vinculados a um CPF no ConferIA. A operação é restrita ao administrador master e deve ser executada somente após validação da identidade do solicitante pelo controlador.

## Procedimento

1. Registrar a solicitação recebida pelo canal oficial do controlador.
2. Validar a identidade do titular antes de informar a existência de dados.
3. O administrador master exporta os dados com `GET /api/admin/data-subject?cpf=<CPF>` e entrega o arquivo somente pelo canal seguro definido pelo controlador.
4. Quando houver solicitação válida de eliminação, executar `DELETE /api/admin/data-subject` com o CPF e a confirmação literal `EXCLUIR`.
5. Confirmar a conclusão ao titular e registrar o protocolo interno do controlador. O ConferIA registra o atendimento sem manter o CPF em claro no evento técnico.

## Prazo

O controlador deve fornecer confirmação simplificada imediatamente quando possível ou declaração completa em até 15 dias, conforme o art. 19 da LGPD. A avaliação de exceções legais de retenção, base legal e comunicação ao titular é responsabilidade do encarregado/DPO do controlador.

## Limites

- A exclusão alcança operações em que o CPF esteja presente nos resultados persistidos, seus documentos armazenados, revisões e eventos relacionados.
- Dados necessários para cumprir obrigação legal ou exercício regular de direitos devem ser avaliados pelo jurídico antes da exclusão.
- O evento técnico de atendimento mantém apenas o hash irreversível do CPF para evidência de execução.
