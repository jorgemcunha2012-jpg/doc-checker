# Baseline de segurança

## Escopo atual

- Documentos originais: bucket privado `process-documents`, removidos após 40 dias.
- Metadados e resultados: permanecem para histórico operacional.
- Acesso: Supabase Auth, troca obrigatória de senha e MFA configurável por perfil.
- Isolamento: organização, administrador da organização e administrador master são avaliados no servidor antes de operações com processos e documentos.
- Fornecedores externos: DeepSeek, Kimi e Haiku somente pelos serviços de extração no servidor.

## Controles implementados neste ciclo

- Produção falha ao iniciar se Supabase, segredo de serviço, cron ou provedor de extração obrigatório estiver ausente.
- Produção não aceita `CONFERIA_AUTH_DISABLED=true`.
- Erros internos e de fornecedores são convertidos em mensagens seguras para a interface.
- As rotas administrativas e de upload cobertas neste ciclo registram códigos técnicos, sem payload documental, nome de arquivo ou mensagem crua de provedor.
- Caminhos de Storage de documentos e páginas renderizadas não carregam o nome original do arquivo.
- CI executa lint, tipagem, testes, build, auditoria de dependências e gera SBOM.

## Riscos abertos e próximos controles

- Quarentena e antimalware requerem serviço de análise externo ou infraestrutura dedicada.
- Tokenização e mascaramento visual antes de chamadas de IA dependem de decisão formal sobre fornecedores e política de dados.
- O serviço de extração ainda possui logs históricos com nome de arquivo; sua sanitização será feita em uma alteração isolada de observabilidade, sem mudar OCR, prompts ou regras de conferência.
- Staging isolado, aprovação de produção, proteção de branch e CODEOWNERS dependem da configuração da organização GitHub e Vercel.
- Pentest e DAST devem ocorrer contra ambiente de homologação com dados sintéticos.
