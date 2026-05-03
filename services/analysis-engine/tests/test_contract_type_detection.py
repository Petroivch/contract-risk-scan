import pytest

from app.services.contract_analysis import ContractTypeDetector as LegacyContractTypeDetector
from app.services.contract_type_detector import ContractTypeDetector


def test_contract_type_detector_is_reexported_from_contract_analysis() -> None:
    assert LegacyContractTypeDetector is ContractTypeDetector


@pytest.mark.parametrize(
    ("document_name", "document_text", "expected_type_id", "expected_name_fragment", "min_confidence"),
    [
        (
            "services-contract.txt",
            (
                "ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ\n"
                "Исполнитель обязуется оказать услуги по сопровождению системы.\n"
                "Заказчик оплачивает услуги в течение 5 банковских дней."
            ),
            "service_agreement",
            "услуг",
            0.7,
        ),
        (
            "education-contract.pdf",
            (
                "ДОГОВОР О ЦЕЛЕВОМ ОБУЧЕНИИ\n"
                "Гражданин обязуется освоить образовательную программу и осуществить трудовую деятельность.\n"
                "Заказчик обязуется предоставить меры поддержки и обеспечить трудоустройство гражданина."
            ),
            "targeted_education_agreement",
            "обучении",
            0.7,
        ),
        (
            "pledge-contract.doc",
            (
                "ДОГОВОР ЗАЛОГА ДОЛИ\n"
                "Залогодатель передает долю в залог в обеспечение обязательств заемщика.\n"
                "Бенефициар вправе обратить взыскание во внесудебном порядке."
            ),
            "loan_security_agreement",
            "залога",
            0.6,
        ),
        (
            "nda.docx",
            (
                "СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ\n"
                "Раскрывающая сторона передает конфиденциальную информацию принимающей стороне.\n"
                "Срок обязательства о неразглашении составляет три года после возврата носителей информации."
            ),
            "nda_agreement",
            "конфиденциаль",
            0.7,
        ),
        (
            "dpa.docx",
            (
                "ДОГОВОР ПОРУЧЕНИЯ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ\n"
                "Оператор персональных данных поручает обработчику обработку персональных данных.\n"
                "Обработчик применяет меры безопасности и удаляет персональные данные по инструкции оператора."
            ),
            "data_processing_agreement",
            "персональных данных",
            0.7,
        ),
    ],
)
def test_detects_contract_types(
    document_name: str,
    document_text: str,
    expected_type_id: str,
    expected_name_fragment: str,
    min_confidence: float,
) -> None:
    detector = ContractTypeDetector()

    result = detector.detect(document_text, document_name)

    assert result.type_id == expected_type_id
    assert result.confidence >= min_confidence
    assert expected_name_fragment in result.ru_name.casefold()


def test_returns_general_contract_when_no_signal_found() -> None:
    detector = ContractTypeDetector()

    result = detector.detect("Короткий нейтральный текст без маркеров.", "note.txt")

    assert result.type_id == "general_contract"
    assert result.confidence == 0.0
