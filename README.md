# ConferIA

Plataforma SaaS de conferência documental imobiliária com arquitetura modular para checklists, regras e documentos por tipo de validação.

## MVP

- Seleção entre Conferência de Minuta e Conferência de ITBI.
- Entrada por colagem de print, upload de imagem e upload de PDF/documentos.
- Serviços isolados para extração, comparação e geração de checklist.
- Dados mockados para simular OCR/IA enquanto as integrações reais não entram.
- Interfaces preparadas para OpenAI, OCR genérico, Azure Document Intelligence e AWS Textract.

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
