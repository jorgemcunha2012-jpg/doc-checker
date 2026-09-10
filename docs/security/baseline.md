# Baseline de segurança

## Escopo atual

- Documentos originais: bucket privado `process-documents`, removidos após 40 dias.
- Metadados e resultados: permanecem para histórico operacional.
- Acesso: Supabase Auth, troca obrigatória de senha e MFA configurável por perfil.
- Isolamento: organização, administrador da organização e administrador master são avaliados no servidor antes de operações com processos e documentos.
- Fornecedor externo aprovado para extração: Anthropic API (Haiku), somente pelo servidor.
- Kimi e DeepSeek foram removidos da configuração operacional, bloqueados no gateway de saída e não podem ser instanciados como provedores no app.

## Controles implementados neste ciclo

- Produção falha ao iniciar se Supabase, segredo de serviço, cron ou provedor de extração obrigatório estiver ausente.
- Produção não aceita `CONFERIA_AUTH_DISABLED=true`.
- Erros internos e de fornecedores são convertidos em mensagens seguras para a interface.
- As rotas administrativas e de upload cobertas neste ciclo registram códigos técnicos, sem payload documental, nome de arquivo ou mensagem crua de provedor.
- Caminhos de Storage de documentos e páginas renderizadas não carregam o nome original do arquivo.
- CI executa lint, tipagem, testes, build, auditoria de dependências e gera SBOM.
- Login e endpoints de upload possuem limitação básica por IP por janela de tempo; em ambientes serverless ela é local à instância e serve como contenção, não como contador distribuído.
- Segredos usados por rotinas internas são comparados em tempo constante e não são retornados pela aplicação.

## Riscos abertos e próximos controles

- Quarentena e antimalware requerem serviço de análise externo ou infraestrutura dedicada.
- Tokenização textual está ativa. Mascaramento visual antes de chamadas de IA continua pendente porque exige coordenadas confiáveis de OCR; aplicar máscara genérica poderia esconder valores financeiros ou dados do imóvel.
- A Anthropic é um fornecedor internacional: a conformidade depende de aceite comercial do DPA aplicável, registro de transferência e política de privacidade do controlador. Não há alegação de residência de processamento no Brasil.
- A limitação de requisições distribuída ainda depende de Redis/Upstash ou RPC dedicado no Supabase; a proteção atual não deve ser tratada como substituta em escala.
- Logs históricos anteriores à sanitização podem conter dados legados; novos logs operacionais não registram nome de arquivo, payload documental ou erro cru de fornecedor.
- Staging isolado, aprovação de produção, proteção de branch e CODEOWNERS dependem da configuração da organização GitHub e Vercel.
- Pentest e DAST devem ocorrer contra ambiente de homologação com dados sintéticos.
