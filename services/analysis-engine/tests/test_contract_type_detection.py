from app.services.contract_analysis import ContractTypeDetector


def test_detects_service_agreement() -> None:
    detector = ContractTypeDetector()
    text = (
        "ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ\n"
        "Исполнитель обязуется оказать услуги по сопровождению системы.\n"
        "Заказчик оплачивает услуги в течение 5 банковских дней."
    )

    result = detector.detect(text, "services-contract.txt")

    assert result.type_id == "service_agreement"
    assert result.confidence >= 0.7
    assert "услуг" in result.ru_name.casefold()


def test_detects_targeted_education_agreement() -> None:
    detector = ContractTypeDetector()
    text = (
        "ДОГОВОР О ЦЕЛЕВОМ ОБУЧЕНИИ\n"
        "Гражданин обязуется освоить образовательную программу и осуществить трудовую деятельность.\n"
        "Заказчик обязуется предоставить меры поддержки и обеспечить трудоустройство гражданина."
    )

    result = detector.detect(text, "education-contract.pdf")

    assert result.type_id == "targeted_education_agreement"
    assert result.confidence >= 0.7
    assert "обучении" in result.ru_name.casefold()


def test_detects_loan_security_agreement() -> None:
    detector = ContractTypeDetector()
    text = (
        "ДОГОВОР ЗАЛОГА ДОЛИ\n"
        "Залогодатель передает долю в залог в обеспечение обязательств заемщика.\n"
        "Бенефициар вправе обратить взыскание во внесудебном порядке."
    )

    result = detector.detect(text, "pledge-contract.doc")

    assert result.type_id == "loan_security_agreement"
    assert result.confidence >= 0.6
    assert "залога" in result.ru_name.casefold()


def test_returns_general_contract_when_no_signal_found() -> None:
    detector = ContractTypeDetector()

    result = detector.detect("Короткий нейтральный текст без маркеров.", "note.txt")

    assert result.type_id == "general_contract"
    assert result.confidence == 0.0
