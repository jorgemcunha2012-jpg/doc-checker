# Status do plano de segurança

## Item 1 - Dados pessoais e IA externa

### Concluído no branch de segurança

- Kimi e DeepSeek não são provedores operacionais aprovados: configuração de produção, gateway de saída e classes legadas impedem seu uso.
- Anthropic API (Haiku) é o único provedor externo padrão para texto, visão e cadastro de empreendimento.
- Textos de PDF, RTF, DOCX e XLSX passam por seleção de contexto e tokenização de CPF, CNPJ, e-mail, telefone, RG, nome narrativo e endereço antes da estruturação por IA.
- O ROPA técnico está registrado em `docs/security/ropa-external-ai.md`.
- A decisão de conferência, normalização e evidências continua no backend do ConferIA; não é delegada ao modelo externo.

### Pendências para encerramento jurídico-operacional

- Confirmar que a conta Anthropic de produção está sob os termos comerciais e arquivar o DPA aplicável.
- O controlador deve completar o registro de tratamento com base legal, país/região, contato do encarregado e canal ao titular, além de atualizar a política de privacidade sobre transferência internacional.
- Imagens, TIFF e PDFs escaneados ainda podem exigir visão externa e, portanto, não cumprem a regra mais rígida de nunca transferir PII visual em claro. A tentativa de mascaramento por coordenadas OCR não foi incorporada porque não atingiu confiabilidade suficiente para o fluxo produtivo.

### Encerramento futuro

Quando o comprador fornecer o endpoint do modelo local, a visão e a estruturação podem ser encaminhadas à infraestrutura dele. Isso elimina a transferência internacional para esses fluxos, sem alterar o motor de extração determinística ou de conferência.
