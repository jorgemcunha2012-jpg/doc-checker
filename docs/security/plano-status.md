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

## Item 3 - Retenção e criptografia dos dados extraídos

### Concluído no branch de segurança

- `validation_processes.result`, `validation_processes.summary` e `validation_results.values_by_source` passam a usar AES-256-GCM com uma chave exclusiva (`CONFERIA_FIELD_ENCRYPTION_KEY`) antes da persistência.
- A leitura é decifrada somente no backend, depois da autorização já aplicada para a operação e a organização.
- Dados existentes sem envelope criptográfico continuam legíveis durante a transição; novos dados de produção exigem a chave configurada.
- O job de retenção mantém o descarte dos arquivos originais após 40 dias e agora também elimina páginas renderizadas de matrículas que tenham ficado órfãs no Storage, gerando eventos de auditoria de sucesso ou falha.

### Evidências verificadas

- Teste controlado no Supabase em 10/09/2026: um processo temporário com CPF e e-mail sintéticos foi gravado e lido diretamente com `result` e `summary` em envelope AES-GCM; a serialização retornada não continha nenhum dos valores em claro. O processo foi removido após a verificação.
- Suíte automatizada: criptografia, compatibilidade com dados legados, configuração obrigatória de produção e cálculo da retenção foram executados sem falhas, além de lint e typecheck de toda a aplicação.

### Decisão contratual registrada

Por definição do produto, após 40 dias são removidos os arquivos originais e páginas renderizadas; resultados, metadados e auditoria permanecem para histórico operacional. Isso diverge da sugestão inicial de anonimizar os resultados no mesmo prazo e deve constar na matriz de retenção e no contrato com o comprador.

## Item 4 - Direitos do titular

### Concluído no branch de segurança

- Rota exclusiva do administrador master para exportar os dados relacionados a um CPF e atender a solicitação de exclusão.
- A exportação inclui processos, resultados decifrados no backend, revisões, metadados documentais e eventos correlatos.
- A exclusão remove arquivos do Storage, processos e registros dependentes, além dos eventos ligados ao processo. O evento de atendimento da solicitação é preservado com hash do CPF, nunca o CPF em claro.
- O procedimento operacional e o prazo de resposta estão em `docs/security/data-subject-rights.md`.

## Item 5 - Administrador master do comprador

### Concluído no branch de segurança

- Removidas as atribuições de master ligadas a `jorge@conferia.local` nas migrations e o atalho de login que completava usuários com `@conferia.local`.
- Nova migration revoga e desativa contas internas `@conferia.local` em instalações existentes.
- A concessão do master passa a ocorrer por procedimento operacional com service role do comprador, auditoria e sem e-mail em texto aberto. Consulte `docs/security/master-admin-handover.md`.

## Item 6 - Content Security Policy

### Concluído no branch de segurança

- CSP por requisição com nonce criptograficamente aleatório, `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'` e conexão limitada ao Supabase configurado.
- Pré-visualização de documentos continua autorizada somente por `blob:` e o worker PDF pelo host necessário do CDN.
- Adicionado `Cross-Origin-Opener-Policy: same-origin` aos cabeçalhos de resposta.

### Validação pendente de homologação

- Testes unitários, lint e typecheck passaram. Antes de mesclar em produção, validar login e pré-visualização de PDF em uma prévia do branch, pois CSP com nonce é aplicada em tempo de requisição pelo Next.js.

## Itens 7 e 8 - Validação de entrada e relatórios

### Concluído no branch de segurança

- Leitor JSON com limite de 1 MB, schemas Zod e limites de arrays aplicado às rotas de usuários, senha, revisão, empreendimentos, relatórios e extração de matrícula.
- A extração de matrícula aceita JSON apenas com metadados, texto limitado e caminhos de páginas já enviadas ao Storage; imagens não trafegam mais dentro do JSON.
- O relatório recebe somente `processId` e filtro; o resultado é carregado do banco após autorização do usuário.

## Item 9 - Proteção contra ZIP bomb

### Concluído no branch de segurança

- DOCX e XLSX são inspecionados pelo diretório central antes de serem abertos pelo JSZip.
- Arquivos com mais de 500 entradas, mais de 50 MB descompactados, diretório inválido ou ZIP64 são recusados antes da extração.
