from __future__ import annotations

import json
from pathlib import Path


def loc(ru: str, en: str | None = None) -> dict[str, str]:
    en = en or ru
    return {"ru": ru, "en": en, "it": en, "fr": en}


def esc(level: str, ru: str, en: str | None = None) -> dict[str, str]:
    en = en or ru
    return {
        "escalate_to": level,
        "reason_ru": ru,
        "reason_en": en,
        "reason_it": en,
        "reason_fr": en,
    }


def rule(
    rule_id: str,
    source_ref: str,
    severity: str,
    title_ru: str,
    desc_ru: str,
    mitigation_ru: str,
    *,
    patterns: list[str] | None = None,
    all_patterns: list[str] | None = None,
    logic_type: str = "pattern_search",
    affected: list[str] | None = None,
    role_escalation: dict[str, dict[str, str]] | None = None,
    legal_basis: str | None = None,
    examples: list[str] | None = None,
    source: str = "clause",
    min_matches: int = 1,
    keywords: list[str] | None = None,
) -> dict[str, object]:
    return {
        "id": rule_id,
        "source_ref": source_ref,
        "keywords": keywords or patterns or [],
        "severity_base": severity,
        "legal_basis": legal_basis or "Договорный баланс интересов и добросовестность сторон",
        "affected_contract_types": affected or [],
        "detection_logic": {
            "type": logic_type,
            "patterns": patterns or [],
            "all_patterns": all_patterns or [],
            "min_matches": min_matches,
            "source": source,
        },
        "role_escalation": role_escalation or {},
        "title": loc(title_ru),
        "description": loc(desc_ru),
        "mitigation": loc(mitigation_ru),
        "examples": examples or [],
    }


def build_contract_types() -> list[dict[str, object]]:
    return [
        {
            "id": "non_contract_legal_form",
            "ru_name": "Иной юридический документ",
            "en_name": "Other legal form",
            "keywords": ["исковое заявление", "уведомление", "протокол", "акт", "претензия", "жалоба"],
            "markers": ["заявитель", "ответчик", "истец", "акт выполненных работ"],
            "legal_framework": "Вне типовой contract taxonomy",
            "characteristic_clauses": ["прошу суд", "акт приема-передачи", "претензия"],
            "high_priority_risks": ["non_contract_document"],
            "legal_notes": "Документ не является самостоятельным договором и требует отдельного сценария разбора.",
        },
        {
            "id": "targeted_education_agreement",
            "ru_name": "Договор о целевом обучении",
            "en_name": "Targeted education agreement",
            "keywords": [
                "договор о целевом обучении",
                "целевом обучении",
                "образовательная программа",
                "гражданин",
                "образовательная организация",
            ],
            "markers": ["меры поддержки", "трудовая деятельность", "после завершения обучения"],
            "legal_framework": "ФЗ об образовании, ГК РФ, локальные акты работодателя",
            "characteristic_clauses": [
                "освоить образовательную программу",
                "обеспечить трудоустройство",
                "возврат мер поддержки",
            ],
            "high_priority_risks": [
                "post_training_employment_obligation",
                "support_reimbursement_after_withdrawal",
            ],
        },
        {
            "id": "labor_contract",
            "ru_name": "Трудовой договор",
            "en_name": "Labor agreement",
            "keywords": ["трудовой договор", "работник", "работодатель", "заработная плата", "рабочее время"],
            "markers": ["должность", "трудовая функция", "испытательный срок"],
            "legal_framework": "ТК РФ",
            "characteristic_clauses": ["оплата труда", "режим рабочего времени", "расторжение договора"],
            "high_priority_risks": [
                "unilateral_termination_no_cause",
                "salary_reduction_unilateral",
                "unlimited_liability",
            ],
        },
        {
            "id": "service_agreement",
            "ru_name": "Договор оказания услуг",
            "en_name": "Service agreement",
            "keywords": ["договор оказания услуг", "оказание услуг", "исполнитель", "заказчик"],
            "markers": ["услуги", "акт оказанных услуг", "стоимость услуг"],
            "legal_framework": "ГК РФ, глава 39",
            "characteristic_clauses": ["порядок оказания услуг", "стоимость услуг", "приемка услуг"],
            "high_priority_risks": ["payment_asymmetry", "undefined_acceptance_criteria", "no_warranty_period"],
        },
        {
            "id": "consulting_agreement",
            "ru_name": "Консалтинговый договор",
            "en_name": "Consulting agreement",
            "keywords": ["консультационные услуги", "аналитический отчет", "консалтинг", "advisory"],
            "markers": ["рекомендации", "отчет", "экспертное заключение"],
            "legal_framework": "ГК РФ, глава 39",
            "characteristic_clauses": ["результат консультации", "конфиденциальность", "интеллектуальные права"],
            "high_priority_risks": [
                "payment_asymmetry",
                "undefined_acceptance_criteria",
                "ip_transfer_without_scope",
            ],
        },
        {
            "id": "purchase_agreement",
            "ru_name": "Договор купли-продажи",
            "en_name": "Purchase agreement",
            "keywords": ["договор купли-продажи", "покупатель", "продавец", "товар"],
            "markers": ["переход права собственности", "цена товара", "поставка товара"],
            "legal_framework": "ГК РФ, глава 30",
            "characteristic_clauses": ["ассортимент товара", "качество товара", "переход риска"],
            "high_priority_risks": ["early_risk_transfer", "payment_asymmetry", "warranty_disclaimer"],
        },
        {
            "id": "supply_agreement",
            "ru_name": "Договор поставки",
            "en_name": "Supply agreement",
            "keywords": ["договор поставки", "поставка", "поставщик", "покупатель"],
            "markers": ["спецификация", "отгрузка", "приемка товара"],
            "legal_framework": "ГК РФ, глава 30",
            "characteristic_clauses": ["партия товара", "график поставки", "товаросопроводительные документы"],
            "high_priority_risks": [
                "payment_asymmetry",
                "strict_deadlines_without_dependency_carveout",
                "silent_acceptance",
            ],
        },
        {
            "id": "lease_agreement",
            "ru_name": "Договор аренды",
            "en_name": "Lease agreement",
            "keywords": ["договор аренды", "арендодатель", "арендатор", "найм"],
            "markers": ["арендная плата", "обеспечительный платеж", "помещение"],
            "legal_framework": "ГК РФ, глава 34",
            "characteristic_clauses": ["коммунальные платежи", "возврат депозита", "досрочное расторжение"],
            "high_priority_risks": [
                "retention_or_deposit_discretion",
                "operating_expenses_shift",
                "broad_access_rights",
            ],
        },
        {
            "id": "construction_contract",
            "ru_name": "Договор подряда / строительства",
            "en_name": "Construction contract",
            "keywords": ["договор подряда", "подрядчик", "строительно", "ремонт", "монтаж"],
            "markers": ["смета", "этап работ", "результат работ", "дефекты"],
            "legal_framework": "ГК РФ, главы 37 и 38",
            "characteristic_clauses": ["гарантийный срок", "устранение дефектов", "приемка этапов"],
            "high_priority_risks": [
                "undefined_acceptance_criteria",
                "unlimited_defect_cure",
                "strict_deadlines_without_dependency_carveout",
            ],
        },
        {
            "id": "agency_agreement",
            "ru_name": "Агентский / комиссионный договор",
            "en_name": "Agency agreement",
            "keywords": ["агентский договор", "комиссионер", "комитент", "агент"],
            "markers": ["агентское вознаграждение", "от своего имени", "в интересах принципала"],
            "legal_framework": "ГК РФ, главы 51 и 52",
            "characteristic_clauses": ["отчет агента", "вознаграждение", "конфиденциальность"],
            "high_priority_risks": [
                "royalty_reduction_unclear",
                "one_sided_penalty",
                "confidentiality_without_exceptions",
            ],
        },
        {
            "id": "loan_security_agreement",
            "ru_name": "Договор займа / залога / гарантии",
            "en_name": "Loan and security agreement",
            "keywords": ["договор займа", "кредитор", "заемщик", "залог", "поручительство", "банковская гарантия"],
            "markers": ["проценты", "обеспечение исполнения", "бенефициар"],
            "legal_framework": "ГК РФ, главы 23, 42, 43",
            "characteristic_clauses": ["все обязательства", "по первому требованию", "предмет залога"],
            "high_priority_risks": ["all_obligations_security", "bank_guarantee_on_demand", "unlimited_liability"],
        },
        {
            "id": "insurance_agreement",
            "ru_name": "Договор страхования",
            "en_name": "Insurance agreement",
            "keywords": ["договор страхования", "страхователь", "страховщик", "страховой случай"],
            "markers": ["страховая премия", "исключения из покрытия"],
            "legal_framework": "ГК РФ, глава 48",
            "characteristic_clauses": ["страховая сумма", "франшиза", "порядок урегулирования убытков"],
            "high_priority_risks": ["vague_material_breach", "favorable_jurisdiction_or_dispute_clause"],
        },
        {
            "id": "ip_agreement",
            "ru_name": "Договор об интеллектуальных правах",
            "en_name": "IP agreement",
            "keywords": ["лицензионный договор", "патент", "исключительное право", "роялти", "ноу-хау"],
            "markers": ["объект интеллектуальной собственности", "право использования", "исключительная лицензия"],
            "legal_framework": "ГК РФ, часть IV",
            "characteristic_clauses": [
                "территория использования",
                "срок лицензии",
                "результаты интеллектуальной деятельности",
            ],
            "high_priority_risks": [
                "ip_transfer_without_scope",
                "royalty_reduction_unclear",
                "confidentiality_without_exceptions",
            ],
        },
        {
            "id": "partnership_agreement",
            "ru_name": "Договор о совместной деятельности",
            "en_name": "Partnership agreement",
            "keywords": ["совместная деятельность", "простое товарищество", "совместно", "доли участия"],
            "markers": ["общие расходы", "распределение прибыли", "вклад сторон"],
            "legal_framework": "ГК РФ, глава 55",
            "characteristic_clauses": ["порядок управления", "совместные расходы", "выход участника"],
            "high_priority_risks": ["conflicting_obligations", "vague_material_breach", "unlimited_liability"],
        },
    ]


def build_risk_rules() -> list[dict[str, object]]:
    return [
        rule(
            "payment_asymmetry",
            "RSK-PAY-001",
            "high",
            "Платежная асимметрия: исполнение до оплаты",
            "Одна сторона обязана начать исполнение раньше, чем получает деньги, что создает кассовый разрыв и риск неоплаты.",
            "Согласуйте аванс, этапные платежи или право приостановить исполнение до поступления оплаты.",
            patterns=[
                r"в течение\s+\d{1,3}\s*(?:рабоч|календар|банков|дн)",
                r"через\s+\d{1,3}\s*(?:рабоч|календар|банков|дн)",
                r"после\s+(?:подписания|поставки|оказания|приемки)",
                r"после\s+окончательной\s+приемки",
                r"предоплат|аванс",
                r"within\s+\d{1,3}\s+days",
                r"after\s+(?:delivery|acceptance|signature|invoice)",
                r"advance payment|prepayment",
            ],
            affected=[
                "service_agreement",
                "consulting_agreement",
                "purchase_agreement",
                "supply_agreement",
                "construction_contract",
            ],
            role_escalation={
                "executor": esc("critical", "Для исполнителя это прямой риск финансировать проект за свой счет."),
                "client": esc("low", "Для заказчика это обычный защитный механизм."),
                "worker": esc("medium", "Для работника подобная логика менее типична, но может смещать баланс."),
                "tenant": esc("medium", "Для арендатора это может создавать разрыв между обязанностями и оплатой."),
            },
            legal_basis="Синхронность встречного исполнения, статья 328 ГК РФ",
            examples=["Исполнитель выполняет работы в 10 дней, а заказчик платит через 45 банковских дней после акта."],
        ),
        rule(
            "long_payment_delay_no_security",
            "RSK-PAY-002",
            "high",
            "Длинная отсрочка платежа без обеспечений",
            "Договор закладывает длительную отсрочку оплаты без аванса, банковской гарантии или права остановить исполнение.",
            "Сократите срок оплаты, добавьте аванс, лимит дебиторки или договорное обеспечение.",
            patterns=[
                r"в течение\s+(30|45|60|90)\s*(?:рабоч|календар|банков|дн)",
                r"через\s+(30|45|60|90)\s*(?:рабоч|календар|банков|дн)",
                r"безусловн.*оплат",
                r"после получения счета",
                r"после\s+окончательной\s+приемки",
            ],
            affected=[
                "service_agreement",
                "consulting_agreement",
                "purchase_agreement",
                "supply_agreement",
                "construction_contract",
            ],
            role_escalation={
                "executor": esc("critical", "Длинная отсрочка оплаты бьет по оборотному капиталу исполнителя."),
                "client": esc("low", "Для заказчика условие выгодно и редко несет самостоятельный риск."),
            },
            legal_basis="Добросовестность сторон и коммерчески разумный баланс риска",
        ),
        rule(
            "payment_conditioned_on_signed_act",
            "RSK-PAY-003",
            "high",
            "Оплата поставлена в зависимость от акта другой стороны",
            "Деньги подлежат выплате только после подписания акта контрагентом, но срок на мотивированный отказ не определен.",
            "Добавьте срок проверки и правило, что молчание считается либо акцептом, либо мотивированный отказ обязателен.",
            patterns=[r"оплат.*после.*подписан.*акт", r"после подписания акта", r"акт.*основани.*оплат"],
            affected=["service_agreement", "consulting_agreement", "construction_contract", "supply_agreement"],
            role_escalation={
                "executor": esc("critical", "Контрагент может бесконечно задерживать оплату, не подписывая акт."),
                "client": esc("low", "Для заказчика условие повышает контроль над приемкой."),
            },
            legal_basis="Порядок сдачи и приемки результата, статьи 720 и 753 ГК РФ",
        ),
        rule(
            "invoice_dependency_for_payment",
            "RSK-PAY-004",
            "medium",
            "Платеж зависит от формальностей по счетам и документам",
            "Обязанность оплатить отложена до выставления счета, счета-фактуры или иного документа без понятного порядка исправления ошибок.",
            "Зафиксируйте исчерпывающий перечень документов и срок на уведомление о недостатках пакета.",
            patterns=["счет-фактур", "счет на оплату", "комплект документов", "после получения .* документов"],
            affected=["service_agreement", "purchase_agreement", "supply_agreement", "agency_agreement"],
            role_escalation={
                "executor": esc("high", "Формальный документооборот может использоваться для затягивания оплаты."),
                "client": esc("low", "Для покупателя это стандартный контрольный барьер."),
            },
            legal_basis="Надлежащее исполнение денежного обязательства",
        ),
        rule(
            "unilateral_price_change",
            "RSK-CHG-001",
            "high",
            "Одностороннее изменение цены",
            "Одна сторона оставила за собой право менять цену без встречного согласия или прозрачной формулы пересчета.",
            "Закрепите закрытый перечень оснований изменения цены и обязанность подписывать дополнительное соглашение.",
            patterns=[
                "вправе изменить цену",
                "односторонн.*измен.*цен",
                "стоимость может быть изменена",
                "unilaterally change the price",
                "price may be changed",
            ],
            affected=["service_agreement", "consulting_agreement", "purchase_agreement", "supply_agreement", "lease_agreement"],
            role_escalation={
                "client": esc("high", "Для заказчика или покупателя это риск роста стоимости без управляемых критериев."),
                "executor": esc("low", "Для исполнителя условие обычно выгодно."),
            },
            legal_basis="Существенные условия и изменение договора по соглашению сторон",
        ),
        rule(
            "unilateral_scope_change",
            "RSK-CHG-002",
            "high",
            "Одностороннее изменение объема или спецификации",
            "Контрагент может менять объем работ, состав услуг или спецификацию товара без соразмерной корректировки цены и сроков.",
            "Добавьте обязательную корректировку бюджета и дедлайнов при изменении объема.",
            patterns=[
                "вправе изменить объем",
                "изменить техническое задание",
                "спецификация может быть изменена",
                "дополнительные работы по требованию",
                "change the scope",
                "change the deadlines",
                "without contractor approval",
            ],
            affected=["service_agreement", "consulting_agreement", "construction_contract", "supply_agreement", "ip_agreement"],
            role_escalation={
                "executor": esc("critical", "Для исполнителя это риск бесконечного расширения объема без доплаты."),
                "client": esc("low", "Для заказчика это управленческий рычаг, а не его риск."),
            },
            legal_basis="Эквивалентность встречного предоставления",
        ),
        rule(
            "one_sided_penalty",
            "RSK-PEN-001",
            "high",
            "Неустойка предусмотрена только для одной стороны",
            "Санкции за нарушение детально описаны только для одной стороны, что создает асимметричный договорный баланс.",
            "Сделайте ответственность зеркальной или обоснуйте, почему санкция односторонняя и ограниченная.",
            patterns=["пеня", "штраф", "неустойк", "penalty", "liquidated damages"],
            affected=["service_agreement", "purchase_agreement", "supply_agreement", "lease_agreement", "construction_contract"],
            role_escalation={
                "executor": esc("high", "Исполнитель несет санкции, не имея симметричных средств давления."),
                "client": esc("medium", "Даже выгодная односторонняя санкция может вызвать спор о соразмерности."),
            },
            legal_basis="Статья 330 ГК РФ и судебная практика о соразмерности неустойки",
        ),
        rule(
            "uncapped_daily_penalty",
            "RSK-PEN-002",
            "critical",
            "Ежедневная пеня без верхнего лимита",
            "Договор содержит ежедневную пеню, но не ограничивает ее общий размер или период начисления.",
            "Установите cap по общей сумме неустойки и предельный период начисления.",
            patterns=["за каждый день просрочки", "ежедневн", "0,1%", "0,5%", "for each day of delay", "per day"],
            affected=["service_agreement", "purchase_agreement", "supply_agreement", "lease_agreement", "construction_contract", "agency_agreement"],
            role_escalation={
                "executor": esc("critical", "Неограниченная пеня быстро превращается в непропорциональную ответственность."),
                "client": esc("low", "Для заказчика это выгодное условие."),
                "tenant": esc("critical", "Для арендатора ежедневная пеня без лимита быстро становится несоразмерной."),
                "landlord": esc("low", "Для арендодателя это защитный механизм, а не его собственный риск."),
            },
            legal_basis="Статьи 330 и 333 ГК РФ",
        ),
        rule(
            "penalty_plus_full_damages",
            "RSK-PEN-003",
            "high",
            "Неустойка плюс полные убытки сверх нее",
            "Помимо неустойки договор позволяет взыскать убытки в полном объеме, что удваивает риск ответственности.",
            "Пропишите, что неустойка зачитывается в счет убытков или установите лимит совокупной ответственности.",
            patterns=["убытки в полном объеме", "сверх неустойки", "штраф .* не освобождает"],
            affected=["service_agreement", "purchase_agreement", "supply_agreement", "construction_contract", "agency_agreement", "ip_agreement"],
            role_escalation={
                "executor": esc("critical", "Одновременное взыскание неустойки и убытков резко повышает размер возможных потерь."),
                "client": esc("low", "Для заказчика это усиление позиции."),
            },
            legal_basis="Статьи 394 и 330 ГК РФ",
        ),
        rule(
            "unlimited_liability",
            "RSK-LIAB-001",
            "critical",
            "Неограниченная имущественная ответственность",
            "Ответственность сформулирована без cap и может покрывать весь спектр убытков и расходов.",
            "Добавьте лимит ответственности: сумма договора, процент от цены или иной измеримый потолок.",
            patterns=["несет полную ответственность", "в полном объеме возмещает", "без ограничения"],
            affected=["labor_contract", "service_agreement", "consulting_agreement", "construction_contract", "loan_security_agreement", "partnership_agreement"],
            role_escalation={
                "worker": esc("critical", "Для работника неограниченная ответственность особенно токсична."),
                "executor": esc("critical", "Для исполнителя это риск несоразмерных потерь."),
                "employer": esc("low", "Для работодателя это защитная формулировка."),
            },
            legal_basis="Общие пределы договорной ответственности и принцип соразмерности",
        ),
        rule(
            "no_liability_cap_for_indirect_losses",
            "RSK-LIAB-002",
            "high",
            "Нет carve-out для косвенных потерь",
            "Договор не отделяет прямые убытки от косвенных потерь, упущенной выгоды и репутационного вреда.",
            "Ограничьте возмещаемые потери прямыми документально подтвержденными убытками.",
            patterns=["упущенн.*выгод", "косвенн.*убыт", "репутационн"],
            affected=["service_agreement", "consulting_agreement", "ip_agreement", "partnership_agreement"],
            role_escalation={
                "executor": esc("high", "Исполнитель рискует отвечать за плохо предсказуемые убытки контрагента."),
                "client": esc("low", "Для заказчика это усиление рычагов, а не его самостоятельный риск."),
            },
            legal_basis="Предсказуемость и ограниченность договорной ответственности",
        ),
        rule(
            "undefined_acceptance_criteria",
            "RSK-ACPT-001",
            "high",
            "Неопределенные критерии приемки",
            "В договоре есть приемка результата, но отсутствуют объективные критерии качества, чек-листы, метрики или ссылка на полное ТЗ.",
            "Опишите, что именно считается готовым результатом и по каким тестам или документам это проверяется.",
            patterns=["приемк", "считается выполненным", "по мнению заказчика", "соответствует требованиям", "acceptance", "accepted if", "in customer opinion"],
            affected=["service_agreement", "consulting_agreement", "construction_contract", "ip_agreement", "targeted_education_agreement", "supply_agreement"],
            role_escalation={
                "executor": esc("critical", "Без критериев приемки исполнитель зависит от субъективного мнения заказчика."),
                "client": esc("medium", "Для заказчика размытая приемка тоже риск спора и потери управляемости."),
            },
            legal_basis="Статьи 720 и 753 ГК РФ",
            examples=["Работа считается принятой, если соответствует требованиям заказчика."],
        ),
        rule(
            "no_acceptance_deadline",
            "RSK-ACPT-002",
            "high",
            "Нет срока на приемку или мотивированный отказ",
            "Контрагент может долго не подтверждать приемку, потому что срок проверки и форма возражений не зафиксированы.",
            "Добавьте 3-5 рабочих дней на приемку и требование мотивированного письменного отказа.",
            patterns=["мотивированн.*отказ", "срок приемки", "подписать акт"],
            logic_type="pattern_with_context",
            min_matches=2,
            affected=["service_agreement", "consulting_agreement", "construction_contract", "supply_agreement"],
            role_escalation={
                "executor": esc("critical", "Без срока приемки оплата и закрытие этапа могут зависнуть на неопределенное время."),
                "client": esc("low", "Для заказчика условие выгодно, но усиливает спорность документа."),
            },
            legal_basis="Разумный срок приемки результата работ и услуг",
        ),
        rule(
            "silent_acceptance",
            "RSK-ACPT-003",
            "medium",
            "Молчаливая или фактическая приемка",
            "Документ допускает признание результата принятым по умолчанию, по пользованию результатом или по истечении срока без замечаний.",
            "Проверьте, не слишком ли короткий срок на возражения, и сохраните право на скрытые дефекты.",
            patterns=["считается принятым", "если в течение .* не направлен", "фактическое использование"],
            affected=["service_agreement", "consulting_agreement", "supply_agreement", "construction_contract"],
            role_escalation={
                "client": esc("high", "Для заказчика молчаливая приемка опасна потерей права на возражения."),
                "executor": esc("low", "Для исполнителя это скорее защитный механизм."),
            },
            legal_basis="Распределение риска приемки результата",
        ),
        rule(
            "no_warranty_period",
            "RSK-WARR-001",
            "medium",
            "Отсутствует гарантийный период",
            "В договоре про результат, дефекты и сопровождение ничего не сказано о гарантийном сроке.",
            "Добавьте гарантийный период и отдельно опишите, что входит в бесплатное исправление дефектов.",
            patterns=["гарант", "гарантийн"],
            logic_type="negative_pattern",
            affected=["service_agreement", "consulting_agreement", "construction_contract", "purchase_agreement", "supply_agreement", "ip_agreement"],
            role_escalation={
                "client": esc("high", "Заказчик рискует остаться без механизма бесплатного устранения дефектов."),
                "executor": esc("low", "Для исполнителя отсутствие гарантии обычно выгодно."),
            },
            legal_basis="Статьи 722 и 724 ГК РФ",
        ),
        rule(
            "unlimited_defect_cure",
            "RSK-WARR-002",
            "high",
            "Исправление дефектов без пределов по сроку и объему",
            "Обязанность устранять дефекты сформулирована широко и не ограничена ни гарантийным сроком, ни числом итераций, ни характером недостатков.",
            "Ограничьте период, перечень покрываемых дефектов и процедуру фиксации замечаний.",
            patterns=["устранить дефекты за свой счет", "устраняет недостатки", "в период гарантийной эксплуатации"],
            affected=["construction_contract", "service_agreement", "consulting_agreement", "ip_agreement"],
            role_escalation={
                "executor": esc("critical", "Исполнитель может нести бесконечные пост-работы без доплаты."),
                "client": esc("low", "Для заказчика это выгодное усиление гарантии."),
            },
            legal_basis="Пределы гарантийных обязательств",
        ),
        rule(
            "strict_deadlines_without_dependency_carveout",
            "RSK-DEAD-001",
            "high",
            "Жесткие сроки без оговорки о зависимостях",
            "Сроки для одной стороны установлены жестко, но не учитывают задержки по исходным данным, доступам, согласованиям и приемке со стороны контрагента.",
            "Пропишите, что сроки автоматически сдвигаются на период задержки зависимых действий другой стороны.",
            patterns=[
                r"(?:оказать|выполнить|поставить|передать)\s+.*в течение\s+\d{1,3}\s*(?:рабоч|календар|банков|дн)",
                r"срок\s+(?:оказания|выполнения|поставки|передачи)",
                r"не позднее",
            ],
            affected=["service_agreement", "consulting_agreement", "construction_contract", "supply_agreement", "targeted_education_agreement"],
            role_escalation={
                "executor": esc("high", "Исполнитель отвечает за сроки, которые частично контролирует контрагент."),
                "worker": esc("high", "Для гражданина или работника жесткие сроки без исключений повышают риск санкций."),
            },
            legal_basis="Причинная связь между просрочкой и действиями сторон",
        ),
        rule(
            "missing_schedule_or_appendix",
            "RSK-DEAD-002",
            "medium",
            "Ключевые сроки вынесены в пустые приложения",
            "Существенные условия зависят от приложений, графиков или спецификаций, которые в тексте не заполнены или не приложены.",
            "Проверьте, что все приложения существуют, подписаны и однозначно связаны с договором.",
            patterns=["согласно приложению", "по графику", "спецификация является неотъемлемой частью"],
            affected=["service_agreement", "construction_contract", "supply_agreement", "partnership_agreement"],
            role_escalation={
                "executor": esc("medium", "Неопределенные приложения создают риск спорить о сроках и объеме."),
                "client": esc("medium", "Заказчик тоже теряет управляемость исполнения."),
            },
            legal_basis="Согласованность существенных условий",
        ),
        rule(
            "unilateral_termination_no_cause",
            "RSK-TERM-001",
            "critical",
            "Одностороннее расторжение без четких оснований",
            "Одна сторона получила право отказаться от договора в одностороннем порядке без перечня существенных нарушений или разумного срока уведомления.",
            "Добавьте закрытый список оснований, срок уведомления и право другой стороны устранить нарушение.",
            patterns=["в одностороннем порядке отказаться", "вправе расторгнуть", "может отказаться от договора", "unilaterally terminate", "terminate the contract at any time", "may terminate the contract"],
            affected=["labor_contract", "service_agreement", "consulting_agreement", "lease_agreement", "agency_agreement", "targeted_education_agreement"],
            role_escalation={
                "worker": esc("critical", "Для работника или гражданина это риск внезапной потери статуса и дохода."),
                "executor": esc("critical", "Исполнитель может потерять проект без компенсации."),
                "client": esc("low", "Для заказчика условие выгодно и не является его риском."),
                "employer": esc("low", "Для работодателя это усиление позиции."),
            },
            legal_basis="Расторжение договора и принцип добросовестности",
        ),
        rule(
            "vague_material_breach",
            "RSK-TERM-002",
            "high",
            "Расторжение привязано к расплывчатому нарушению",
            "Основание для расторжения описано общими словами вроде 'ненадлежащее исполнение' без порога существенности и процедуры фиксации.",
            "Уточните, какие нарушения считаются существенными, и дайте срок на устранение.",
            patterns=["ненадлежащ.*исполн", "существенн.*наруш", "по усмотрению"],
            affected=["service_agreement", "construction_contract", "insurance_agreement", "partnership_agreement", "targeted_education_agreement"],
            role_escalation={
                "executor": esc("high", "Широкое основание позволяет прекратить договор по субъективной оценке."),
                "client": esc("medium", "Даже выгодная расплывчатость потом ухудшает взыскание и судебную перспективу."),
            },
            legal_basis="Определенность основания для отказа от договора",
        ),
        rule(
            "retention_or_deposit_discretion",
            "RSK-SEC-001",
            "high",
            "Удержание депозита или обеспечительного платежа по усмотрению одной стороны",
            "Возврат депозита или обеспечения зависит от односторонней оценки арендодателя, заказчика или принципала.",
            "Опишите исчерпывающие основания удержания, порядок расчета и срок возврата остатка.",
            patterns=["обеспечительн.*платеж", "депозит", "вправе удержать"],
            affected=["lease_agreement", "agency_agreement", "service_agreement"],
            role_escalation={
                "tenant": esc("critical", "Для арендатора удержание депозита напрямую влияет на возврат денег."),
                "executor": esc("high", "Для исполнителя удержание обеспечения ухудшает расчет по договору."),
                "landlord": esc("low", "Для арендодателя это средство защиты."),
            },
            legal_basis="Назначение обеспечительного платежа и пределы его удержания",
        ),
        rule(
            "broad_access_rights",
            "RSK-SEC-002",
            "medium",
            "Широкое право доступа, осмотра или контроля",
            "Одна сторона получает широкое право доступа к помещению, оборудованию, данным или процессам без графика и ограничений.",
            "Ограничьте доступ рабочими часами, целями проверки и требованиями к уведомлению.",
            patterns=["право осмотра", "доступ к помещению", "доступ к оборудованию", "контроль деятельности"],
            affected=["lease_agreement", "service_agreement", "construction_contract", "ip_agreement"],
            role_escalation={
                "tenant": esc("high", "Для арендатора или исполнителя это риск вмешательства в деятельность."),
                "executor": esc("medium", "Доступ без границ может мешать исполнению и безопасности данных."),
            },
            legal_basis="Неприкосновенность владения и разумные пределы контроля",
        ),
        rule(
            "operating_expenses_shift",
            "RSK-LEASE-001",
            "high",
            "Расходы на содержание и ремонт переложены без разграничения",
            "Арендатор или подрядчик принимает на себя коммунальные, эксплуатационные и ремонтные расходы без разделения текущего и капитального ремонта.",
            "Разделите типы расходов и закрепите, какие из них покрываются арендной платой, а какие оплачиваются отдельно.",
            patterns=["коммуналь", "капитальн.*ремонт", "текущ.*ремонт", "эксплуатационн.*расход"],
            affected=["lease_agreement", "construction_contract"],
            role_escalation={
                "tenant": esc("critical", "Для арендатора смешение расходов почти всегда означает переплату."),
                "landlord": esc("low", "Для арендодателя это выгодная модель распределения расходов."),
            },
            legal_basis="Разграничение обязанностей по содержанию имущества",
        ),
        rule(
            "early_risk_transfer",
            "RSK-RISK-001",
            "high",
            "Риск случайной гибели переходит слишком рано",
            "Документ передает риск случайной гибели товара или результата до оплаты либо до полноценной приемки.",
            "Сместите переход риска на момент подписания передаточного документа или фактической приемки.",
            patterns=["риск случайной гибели", "переходит с момента передачи перевозчику", "с момента отгрузки"],
            affected=["purchase_agreement", "supply_agreement", "lease_agreement"],
            role_escalation={
                "client": esc("critical", "Покупатель или арендатор может отвечать за объект до реального контроля над ним."),
                "executor": esc("low", "Для продавца или поставщика условие чаще выгодно."),
            },
            legal_basis="Статья 459 ГК РФ и смежные нормы о переходе риска",
        ),
        rule(
            "uncontrolled_subcontracting",
            "RSK-SUB-001",
            "medium",
            "Субподряд или привлечение третьих лиц описаны неясно",
            "Либо привлечение третьих лиц запрещено без разумных исключений, либо разрешено без контроля, уведомления и ответственности за качество.",
            "Уточните, когда третьи лица допустимы, нужно ли согласие и кто отвечает за их ошибки.",
            patterns=["третьих лиц", "субподряд", "вправе привлекать"],
            affected=["service_agreement", "construction_contract", "consulting_agreement", "agency_agreement"],
            role_escalation={
                "client": esc("medium", "Заказчик рискует потерять контроль над тем, кто реально исполняет договор."),
                "executor": esc("medium", "Полный запрет на субподряд может сделать исполнение нереалистичным."),
            },
            legal_basis="Личное исполнение и ответственность за привлеченных лиц",
        ),
        rule(
            "confidentiality_without_exceptions",
            "RSK-CONF-001",
            "medium",
            "Конфиденциальность без carve-outs и разумных исключений",
            "Обязанность по конфиденциальности сформулирована широко, но не содержит исключений для общедоступной информации, законных запросов и ранее известных данных.",
            "Добавьте стандартные carve-outs и ограничьте ответственность за непредотвратимое раскрытие.",
            patterns=["конфиденц", "не разглаш", "коммерческ.*тайн"],
            affected=["service_agreement", "consulting_agreement", "agency_agreement", "ip_agreement", "partnership_agreement"],
            role_escalation={
                "executor": esc("medium", "Исполнитель рискует нарушить чрезмерно широкую конфиденциальность."),
                "client": esc("medium", "Заказчик тоже может столкнуться с неприменимой или оспоримой оговоркой."),
            },
            legal_basis="Разумные пределы обязательств по конфиденциальности",
        ),
        rule(
            "ip_transfer_without_scope",
            "RSK-IP-001",
            "high",
            "Передача IP без точного объема прав",
            "Договор говорит о передаче результатов, прав или лицензии, но не фиксирует территорию, срок, способ использования или исключительность.",
            "Опишите объект, объем прав, территорию, срок и момент перехода прав отдельными формулировками.",
            patterns=[
                "исключительн.*лиценз",
                "исключительн.*прав",
                "результат интеллектуальной деятельности",
                "права на результаты",
                "переходит.*исключительн.*прав",
            ],
            affected=["consulting_agreement", "ip_agreement", "service_agreement", "construction_contract"],
            role_escalation={
                "executor": esc("high", "Исполнитель может непреднамеренно отдать больше прав, чем планировал."),
                "client": esc("medium", "Покупатель прав тоже рискует получить нечеткий и трудно защищаемый объем."),
            },
            legal_basis="Часть IV ГК РФ",
        ),
        rule(
            "royalty_reduction_unclear",
            "RSK-IP-002",
            "medium",
            "Снижение роялти или вознаграждения по нечетким основаниям",
            "Размер вознаграждения может быть уменьшен по оценочным критериям без прозрачной формулы расчета.",
            "Зафиксируйте формулу расчета, источники данных и период пересмотра вознаграждения.",
            patterns=["роялти", "вознаграждение может быть уменьшено", "по усмотрению правообладателя", "по результатам оценки"],
            affected=["agency_agreement", "ip_agreement", "partnership_agreement"],
            role_escalation={
                "executor": esc("high", "Сторона, ожидающая вознаграждение, теряет предсказуемость дохода."),
                "client": esc("low", "Плательщик вознаграждения обычно выигрывает от такой формулировки."),
            },
            legal_basis="Определенность цены и встречного предоставления",
        ),
        rule(
            "all_obligations_security",
            "RSK-SEC-003",
            "critical",
            "Обеспечение покрывает все обязательства без точных рамок",
            "Залог, поручительство или иное обеспечение распространяется на 'все обязательства' без суммы, срока или перечня покрываемых требований.",
            "Ограничьте обеспечение конкретным долгом, суммой, сроком и набором обязательств.",
            patterns=["все обязательства", "обеспечивает исполнение любых обязательств", "в полном объеме обязательств"],
            affected=["loan_security_agreement", "partnership_agreement"],
            role_escalation={
                "borrower": esc("critical", "Для должника или залогодателя это риск неограниченного охвата обеспечением."),
                "lender": esc("low", "Для кредитора это выгодный защитный механизм."),
            },
            legal_basis="Определенность предмета обеспечения",
        ),
        rule(
            "favorable_jurisdiction_or_dispute_clause",
            "RSK-DISP-001",
            "medium",
            "Подсудность и споры сформулированы в пользу одной стороны",
            "Порядок разрешения споров делает защиту неудобной: удаленная подсудность, сложный претензионный порядок или неопределенный арбитраж.",
            "Проверьте применимое право, подсудность, сроки претензии и выполнимость выбранного способа защиты.",
            patterns=["подсудн", "арбитражн", "претензионн.*поряд", "по месту нахождения"],
            affected=["service_agreement", "purchase_agreement", "supply_agreement", "lease_agreement", "insurance_agreement", "ip_agreement"],
            role_escalation={
                "executor": esc("medium", "Удаленная подсудность повышает стоимость защиты интересов исполнителя."),
                "client": esc("medium", "Покупатель или заказчик тоже может столкнуться с трудновыполнимой процедурой."),
            },
            legal_basis="Процессуальный баланс и исполнимость оговорки о спорах",
        ),
        rule(
            "conflicting_obligations",
            "RSK-CNF-001",
            "medium",
            "В договоре есть конфликтующие или несогласованные обязанности",
            "Разные пункты задают несовместимые сроки, объемы или последствия нарушения, поэтому неясно, какое условие имеет приоритет.",
            "Сведите взаимосвязанные условия в единую таблицу обязательств и определите приоритет документов.",
            patterns=["не позднее", "одновременно", "при этом", "в то же время"],
            logic_type="pattern_with_context",
            min_matches=3,
            affected=["partnership_agreement", "service_agreement", "construction_contract", "targeted_education_agreement"],
            role_escalation={
                "executor": esc("medium", "Исполнитель рискует быть нарушителем при любой трактовке противоречащих пунктов."),
                "worker": esc("medium", "Для гражданина конфликтные обязанности повышают риск санкций."),
            },
            legal_basis="Определенность договорных условий",
        ),
        rule(
            "post_training_employment_obligation",
            "RSK-EDU-001",
            "high",
            "Обязательство отработать после обучения сформулировано жестко",
            "Гражданин обязан отработать после окончания обучения, но условия трудоустройства, место, функция или срок конкретизированы слабо либо односторонне заказчиком.",
            "Проверьте срок обязательной работы, конкретику должности и основания освобождения от отработки.",
            patterns=["осуществить трудовую деятельность", "после завершения освоения", "обеспечить трудоустройство"],
            affected=["targeted_education_agreement"],
            role_escalation={
                "worker": esc("critical", "Для гражданина это ключевой риск ограничения свободы выбора работы."),
                "client": esc("low", "Для заказчика это целевой результат договора."),
            },
            legal_basis="Свобода труда и пределы обязательств по целевому обучению",
        ),
        rule(
            "support_reimbursement_after_withdrawal",
            "RSK-EDU-002",
            "high",
            "Возврат мер поддержки и расходов при нарушении договора",
            "При расторжении или неисполнении обязанностей гражданин может вернуть меры поддержки, обучение и иные расходы без прозрачного расчета и исключений.",
            "Уточните формулу возврата, перечень расходов и случаи, когда возврат не применяется.",
            patterns=["меры поддержки", "возместить расходы", "вернуть средства", "при расторжении договора"],
            affected=["targeted_education_agreement"],
            role_escalation={
                "worker": esc("critical", "Для гражданина возврат затрат может стать существенной финансовой нагрузкой."),
                "client": esc("low", "Для заказчика это способ защитить инвестиции в обучение."),
            },
            legal_basis="Соразмерность санкций и определенность расчета",
        ),
        rule(
            "salary_reduction_unilateral",
            "RSK-LAB-001",
            "critical",
            "Одностороннее уменьшение оплаты труда",
            "Трудовой блок позволяет работодателю менять размер выплат без четкого законного основания и процедуры.",
            "Исключите возможность одностороннего уменьшения оплаты или привяжите ее к предусмотренным законом основаниям.",
            patterns=["заработная плата может быть изменена", "работодатель вправе изменить оклад", "размер оплаты труда определяется работодателем"],
            affected=["labor_contract"],
            role_escalation={
                "worker": esc("critical", "Для работника это прямой риск потери дохода."),
                "employer": esc("low", "Для работодателя это выгодная, но спорная формулировка."),
            },
            legal_basis="ТК РФ",
        ),
        rule(
            "trial_period_abuse",
            "RSK-LAB-002",
            "medium",
            "Испытательный срок описан без защитных границ",
            "Испытательный срок указан, но отсутствуют критерии оценки, порядок уведомления и иные защитные элементы.",
            "Проверьте срок испытания, критерии оценки и соблюдение требований ТК РФ.",
            patterns=["испытательн.*срок", "по результатам испытания"],
            affected=["labor_contract"],
            role_escalation={
                "worker": esc("high", "Размытый испытательный срок облегчает увольнение по субъективным причинам."),
                "employer": esc("low", "Для работодателя это рабочий механизм оценки сотрудника."),
            },
            legal_basis="ТК РФ",
        ),
        rule(
            "bank_guarantee_on_demand",
            "RSK-BANK-001",
            "critical",
            "Банковская гарантия по первому требованию",
            "Гарант обязан платить по письменному требованию бенефициара при минимальном наборе документов, что делает взыскание почти автоматическим.",
            "Проверьте перечень документов, основания требования и лимит суммы гарантии.",
            patterns=["по письменному требованию", "банковская гарантия", "бенефициар"],
            affected=["loan_security_agreement"],
            role_escalation={
                "borrower": esc("critical", "Для принципала или гаранта это максимальный риск быстрой реализации обеспечения."),
                "lender": esc("low", "Для бенефициара это целевой защитный инструмент."),
            },
            legal_basis="Независимая гарантия, глава 23 ГК РФ",
        ),
    ]


def build_role_matrix() -> dict[str, dict[str, dict[str, dict[str, str]]]]:
    return {
        "service_agreement": {
            "payment_asymmetry": {
                "executor": esc("critical", "Исполнитель вынужден кредитовать заказчика."),
                "client": esc("low", "Для заказчика это выгодное условие."),
            },
            "undefined_acceptance_criteria": {
                "executor": esc("critical", "Исполнитель зависит от субъективной приемки."),
                "client": esc("medium", "Заказчик тоже рискует спором из-за размытых критериев."),
            },
        },
        "labor_contract": {
            "unilateral_termination_no_cause": {
                "worker": esc("critical", "Для работника это потеря дохода и статуса."),
                "employer": esc("low", "Для работодателя это управленческий рычаг."),
            },
            "salary_reduction_unilateral": {
                "worker": esc("critical", "Оплата труда не должна уменьшаться произвольно."),
                "employer": esc("low", "Для работодателя условие выгодно, но спорно."),
            },
        },
        "lease_agreement": {
            "retention_or_deposit_discretion": {
                "tenant": esc("critical", "Арендатор рискует потерять обеспечительный платеж."),
                "landlord": esc("low", "Для арендодателя это защита от неисполнения."),
            },
            "operating_expenses_shift": {
                "tenant": esc("critical", "Арендатор может нести непредсказуемые расходы."),
                "landlord": esc("low", "Для арендодателя это выгодно."),
            },
        },
        "loan_security_agreement": {
            "all_obligations_security": {
                "borrower": esc("critical", "Охват обеспечения слишком широк."),
                "lender": esc("low", "Для кредитора это усиление обеспечения."),
            },
            "bank_guarantee_on_demand": {
                "borrower": esc("critical", "Требование может быть предъявлено быстро и формально."),
                "lender": esc("low", "Для бенефициара это целевой механизм защиты."),
            },
        },
        "targeted_education_agreement": {
            "post_training_employment_obligation": {
                "worker": esc("critical", "Гражданин ограничен в выборе работодателя после обучения."),
                "client": esc("low", "Для заказчика это нормальная экономическая цель договора."),
            },
            "support_reimbursement_after_withdrawal": {
                "worker": esc("critical", "Возврат мер поддержки может быть несоразмерным."),
                "client": esc("low", "Для заказчика это защита инвестиций в обучение."),
            },
        },
    }


def build_dispute_markers() -> list[dict[str, object]]:
    return [
        {
            "id": "dispute_marker_future_agreement",
            "source_ref": "DSP-001",
            "markers": ["по соглашению сторон", "по дополнительному согласованию", "при необходимости"],
            "reason": loc("Формулировка зависит от будущего согласования и не содержит исполнимого критерия."),
            "consequence": loc("При исполнении может возникнуть спор о том, что именно стороны должны были согласовать."),
            "confidence": 0.79,
        },
        {
            "id": "dispute_marker_discretionary_right",
            "source_ref": "DSP-002",
            "markers": ["вправе", "по усмотрению", "может по своему усмотрению"],
            "reason": loc("Одна из сторон получила дискреционное право без достаточных ограничителей."),
            "consequence": loc("Это может привести к одностороннему применению условия и спору о пределах такого права."),
            "confidence": 0.76,
        },
        {
            "id": "dispute_marker_reasonable_time",
            "source_ref": "DSP-003",
            "markers": ["разумный срок", "в кратчайший срок", "незамедлительно"],
            "reason": loc("Срок задан оценочно и может толковаться сторонами по-разному."),
            "consequence": loc("Стороны могут спорить о моменте надлежащего исполнения и начале просрочки."),
            "confidence": 0.77,
        },
        {
            "id": "dispute_marker_appendix_dependency",
            "source_ref": "DSP-004",
            "markers": ["согласно приложению", "по графику", "в соответствии со спецификацией"],
            "reason": loc("Существенное условие вынесено в приложение или график, который может быть не заполнен."),
            "consequence": loc("Если приложение отсутствует или неполно, стороны будут спорить о содержании обязательства."),
            "confidence": 0.8,
        },
        {
            "id": "dispute_marker_subjective_quality",
            "source_ref": "DSP-005",
            "markers": ["по мнению заказчика", "по оценке заказчика", "достаточное качество"],
            "reason": loc("Качество или готовность результата завязаны на субъективную оценку."),
            "consequence": loc("Это увеличивает риск отказа в приемке без проверяемых критериев."),
            "confidence": 0.83,
        },
        {
            "id": "dispute_marker_conflict",
            "source_ref": "DSP-006",
            "markers": ["при этом", "одновременно", "в то же время"],
            "reason": loc("Маркер указывает на возможный конфликт между несколькими обязанностями или сроками."),
            "consequence": loc("При исполнении может оказаться, что условия невозможно соблюсти одновременно."),
            "confidence": 0.66,
        },
    ]


def main() -> None:
    path = Path(__file__).resolve().parents[1] / "app" / "config" / "analysis_config.json"
    config = json.loads(path.read_text(encoding="utf-8-sig"))

    config["meta"]["config_version"] = "2.0.0"
    config["service_metadata"]["version"] = "0.5.0"
    config["service_metadata"]["description"] = (
        "Role-aware legal analysis service for contract and legal-form risk extraction."
    )
    config["pipeline"]["ingestion"]["extractors_enabled"] = {
        "docx_mammoth": True,
        "docx_python_docx": True,
        "pdf_pdfplumber": True,
        "doc_word_com": True,
        "doc_soffice": True,
        "doc_antiword": True,
        "doc_catdoc": True,
        "doc_textract": False,
    }
    config["pipeline"]["ingestion"]["extraction_timeout_seconds"] = 25
    config["pipeline"]["ingestion"]["fallback_to_server_assist"] = True
    config["contract_types"] = build_contract_types()
    config["risk_scoring"]["max_clause_excerpt_chars"] = 500
    config["risk_scoring"]["truncation"] = {
        "max_chars": 500,
        "preserve_word_boundary": True,
        "ensure_sentence_end": True,
        "fallback_ending": "...",
    }
    config["risk_scoring"]["risk_rules"] = build_risk_rules()
    config["risk_scoring"]["role_escalation_matrix"] = build_role_matrix()
    config["risk_scoring"]["dispute_markers"] = build_dispute_markers()
    config["risk_scoring"]["fallback"]["risk_title"] = loc(
        "Низкий риск: явные критические маркеры не обнаружены",
        "Low risk: no explicit critical markers found",
    )
    config["risk_scoring"]["fallback"]["risk_description"] = loc(
        "Система не нашла явных высокорисковых паттернов, но скрытые правовые риски все равно требуют проверки по контексту договора.",
        "The system did not detect explicit high-risk patterns, but hidden legal risks may still depend on the full context.",
    )
    config["risk_scoring"]["fallback"]["role_relevance"] = loc(
        "Базовый вывод для роли '{role}'.",
        "Baseline output for role '{role}'.",
    )
    config["risk_scoring"]["fallback"]["mitigation"] = loc(
        "Проверьте предмет договора, порядок оплаты, приемку, ответственность и основания расторжения вручную.",
        "Review the scope, payment flow, acceptance criteria, liability and termination rights manually.",
    )
    config["summary_generation"]["max_items_per_section"] = 6
    config["summary_generation"]["max_line_length"] = 420
    config["summary_generation"]["markers"] = {
        "must_do": [
            "обязан",
            "должен",
            "обязуется",
            "обеспечить",
            "предоставить",
            "освоить",
            "must",
            "shall",
            "undertakes",
        ],
        "should_review": ["вправе", "может", "по усмотрению", "при необходимости", "may", "entitled"],
        "payment_terms": [
            "оплат",
            "аванс",
            "предоплат",
            "счет",
            "счет-фактур",
            "вознагражден",
            "pay",
            "paid",
            "price",
            "payment",
            "invoice",
            "fee",
        ],
        "deadlines": ["срок", "в течение", "дней", "рабочих дней", "банковских дней", "deadline", "days"],
        "penalties": ["штраф", "неустойк", "пеня", "санкц", "penalty", "liquidated damages"],
    }
    config["summary_generation"]["overview_templates"] = loc(
        "Договор содержит {clauses_count} пунктов и {risks_count} выявленных рисков. Краткий вывод сфокусирован на роли '{role}'.",
        "The contract contains {clauses_count} clauses and {risks_count} detected risks. The short summary is focused on role '{role}'.",
    )
    config["templates"]["contract_brief"] = loc(
        "Договор '{document_name}' обработан обновленным rule engine. Обнаружено {clauses_count} пунктов. Фокус анализа по роли '{role}'.",
        "Contract '{document_name}' was processed by the upgraded rule engine. {clauses_count} clauses were detected. Analysis is focused on role '{role}'.",
    )
    config["templates"]["contract_brief_sections"]["intro"] = loc(
        "Договор '{document_name}' разобран на {clauses_count} пунктов. Ниже показано, что действительно важно для роли '{role}'.",
        "Contract '{document_name}' was split into {clauses_count} clauses. Below is what matters most for role '{role}'.",
    )

    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()
