from doc_checker import check_document


def test_check_document_accepts_valid_file(tmp_path):
    document = tmp_path / "contrato.pdf"
    document.write_text("conteudo", encoding="utf-8")

    result = check_document(document)

    assert result.ok is True
    assert result.errors == ()
    assert result.size_bytes == len("conteudo")


def test_check_document_rejects_missing_file(tmp_path):
    result = check_document(tmp_path / "ausente.pdf")

    assert result.ok is False
    assert "arquivo_nao_encontrado" in result.errors


def test_check_document_rejects_unknown_extension(tmp_path):
    document = tmp_path / "script.exe"
    document.write_text("conteudo", encoding="utf-8")

    result = check_document(document)

    assert result.ok is False
    assert "extensao_nao_permitida:.exe" in result.errors


def test_check_document_rejects_empty_file(tmp_path):
    document = tmp_path / "vazio.docx"
    document.touch()

    result = check_document(document)

    assert result.ok is False
    assert "arquivo_vazio" in result.errors
