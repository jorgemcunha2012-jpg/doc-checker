# doc-checker

Ferramenta inicial para validar arquivos de documentos pela linha de comando.

Nesta primeira versão, o `doc-checker` verifica:

- se o arquivo existe;
- se a extensão é permitida;
- se o arquivo está vazio;
- se o arquivo ultrapassa um tamanho máximo configurável.

## Requisitos

- Python 3.9+

## Instalação para desenvolvimento

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Uso

```bash
doc-checker contrato.pdf proposta.docx
```

Também é possível ajustar as regras:

```bash
doc-checker arquivo.pdf --allowed-extension .pdf --max-size-mb 5
```

Para saída em JSON:

```bash
doc-checker arquivo.pdf --json
```

## Testes

```bash
pytest
```
