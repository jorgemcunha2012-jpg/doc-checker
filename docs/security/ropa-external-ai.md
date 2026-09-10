# Registro operacional - IA externa e LGPD

Este registro descreve o tratamento realizado pelo ConferIA quando a extração é configurada com Anthropic API (Haiku). Ele é um artefato técnico-operacional para revisão do encarregado e jurídico; não substitui contrato, DPA ou parecer jurídico.

## Tratamento

| Item | Registro |
| --- | --- |
| Controlador | Organização cliente que define o envio dos documentos e suas finalidades. |
| Operador da aplicação | ConferIA / fornecedor contratado, conforme contrato comercial. |
| Suboperador externo | Anthropic API (Haiku), somente por chamada servidor a servidor. |
| Finalidade | Extrair campos documentais e evidências curtas para a conferência imobiliária solicitada pelo usuário autorizado. |
| Categorias de dados | Dados de identificação, contato, contratuais, imobiliários e financeiros presentes nos documentos. |
| Minimização | Texto é selecionado por relevância; CPF, e-mail, telefone, RG, nomes narrativos e endereços são tokenizados antes da estruturação textual. O app não envia arquivos ao provedor a partir do navegador. |
| Resultado recebido | Campos estruturados, confiança e trecho curto de evidência. A decisão de conferência continua no motor local da aplicação. |
| Retenção no ConferIA | Arquivos originais privados são removidos após 40 dias; metadados, resultados e auditoria permanecem para o histórico operacional. |
| Transferência internacional | Sim, enquanto Anthropic API estiver em uso. Deve ser registrada com país/região aplicável, mecanismo jurídico e avaliação do controlador. |
| Segurança técnica | Chaves apenas no servidor, gateway HTTPS com allowlist, RLS por organização, logs sanitizados, rate limit, autenticação e MFA configurável. |

## Pendências obrigatórias antes de declarar conformidade contratual

1. O responsável jurídico/encarregado da organização deve confirmar hipótese legal, papéis de controlador e operador e canal de atendimento ao titular.
2. A conta Anthropic usada em produção deve estar sob os termos comerciais aplicáveis e o DPA deve ser arquivado pela organização.
3. A política de privacidade deve informar, em linguagem simples, finalidade, duração, países/regiões aplicáveis, medidas de segurança, direitos dos titulares e canal de contato para a transferência internacional.
4. O controlador deve revisar periodicamente suboperadores, retenção e incidentes; anexar este registro ao inventário corporativo de tratamento.

## Limite de residência de dados

O uso de Haiku reduz a superfície ao concentrar o fornecedor externo aprovado e manter o processamento no backend, mas não torna o processamento nacional. Para não haver transferência internacional, a alternativa é integrar um endpoint de modelo local controlado pelo cliente, após validação de autenticação, capacidade multimodal e retenção desse ambiente.
