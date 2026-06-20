# ConferIA

Plataforma SaaS de conferência documental imobiliária com arquitetura modular para checklists, regras e documentos por tipo de validação.

## MVP

- Seleção entre Conferência de Minuta e Conferência de ITBI.
- Entrada por colagem de print, upload de imagem e upload de PDF/documentos.
- Providers reais configuráveis para Kimi e DeepSeek via API compatível com OpenAI.
- Extração direta de texto de PDF antes de recorrer à visão.
- Comparação determinística após normalização por tipo de campo.
- Processamento assíncrono em fila in-memory com polling no frontend.
- Estrutura multi-tenant inicial com `Organization`, `User` e `organizationId` nos processos.

## Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- App Router
- Arquitetura preparada para SaaS

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Scripts

```bash
npm run lint
npm run build
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
KIMI_API_KEY=
KIMI_API_BASE_URL=
KIMI_MODEL=kimi-k2.6

DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE_URL=
DEEPSEEK_MODEL=deepseek-v4
```

Sem essas chaves, o processo real de extração falhará de forma explícita na tela.

## Auditoria de dependências

O `npm install` reporta 2 vulnerabilidades moderadas em dependências transitivas. Não foi executado `npm audit fix --force` nesta etapa para evitar atualizações com quebra potencial; revisar antes de produção.
