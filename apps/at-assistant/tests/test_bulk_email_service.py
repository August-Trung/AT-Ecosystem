from __future__ import annotations

from src.plugins.bulk_email_service import BulkEmailService


class _FakeHyperlink:
    def __init__(self, target: str | None = None, location: str | None = None) -> None:
        self.target = target
        self.location = location


class _FakeCell:
    def __init__(self, value=None, hyperlink: _FakeHyperlink | None = None) -> None:
        self.value = value
        self.hyperlink = hyperlink


def test_extract_attachment_payload_decodes_percent_encoding_from_hyperlink() -> None:
    service = BulkEmailService()
    cell = _FakeCell(
        value="DNTU_THUC HIEN KHOA LUAN TOT NGHIEP.pdf",
        hyperlink=_FakeHyperlink(target="DNTU_THUC%20HIEN%20KHOA%20LUAN%20TOT%20NGHIEP.pdf"),
    )

    payload = service._extract_cell_payload(cell, "attachment_ref")

    assert payload == "DNTU_THUC HIEN KHOA LUAN TOT NGHIEP.pdf"


def test_extract_attachment_payload_supports_hyperlink_formula_semicolon_separator() -> None:
    service = BulkEmailService()
    cell = _FakeCell(value='=HYPERLINK("CVs/Thong%20Tin.pdf";"Thong Tin")', hyperlink=None)

    payload = service._extract_cell_payload(cell, "attachment_ref")

    assert payload == "CVs/Thong Tin.pdf"


def test_extract_attachment_payload_decodes_file_uri() -> None:
    service = BulkEmailService()
    cell = _FakeCell(
        value="",
        hyperlink=_FakeHyperlink(target="file:///C:/Users/lenhu/OneDrive/M%C3%A1y%20t%C3%ADnh/CVs/ThongTin.pdf"),
    )

    payload = service._extract_cell_payload(cell, "attachment_ref")

    assert payload == "C:/Users/lenhu/OneDrive/Máy tính/CVs/ThongTin.pdf"
