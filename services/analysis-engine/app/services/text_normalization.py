from __future__ import annotations

import re


_KNOWN_GLUE_PAIRS = [
    ("заказчик", "обяз"),
    ("заказчик", "вправе"),
    ("заказчик", "долж"),
    ("исполнитель", "обяз"),
    ("исполнитель", "вправе"),
    ("исполнитель", "долж"),
    ("покупатель", "обяз"),
    ("покупатель", "вправе"),
    ("продавец", "обяз"),
    ("продавец", "вправе"),
    ("гражданин", "обяз"),
    ("гражданин", "вправе"),
    ("работник", "обяз"),
    ("работник", "вправе"),
    ("работодатель", "обяз"),
    ("работодатель", "вправе"),
    ("подрядчик", "обяз"),
    ("подрядчик", "вправе"),
    ("арендатор", "обяз"),
    ("арендатор", "вправе"),
    ("арендодатель", "обяз"),
    ("арендодатель", "вправе"),
]


def normalize_contract_text(text: str) -> str:
    cleaned = text.replace("\xa0", " ").replace("\r", "\n")
    cleaned = re.sub(r"(?<=\w)-\n(?=\w)", "", cleaned)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    for left, right in _KNOWN_GLUE_PAIRS:
        cleaned = re.sub(
            rf"(?i)\b({left})({right}[а-яa-z]*)",
            r"\1 \2",
            cleaned,
        )

    cleaned = re.sub(r"(?<=[.!?:;])(?=[^\s])", " ", cleaned)
    cleaned = re.sub(r"(?<=[а-яa-z])(?=[A-ZА-Я])", " ", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" ?\n ?", "\n", cleaned)
    return cleaned.strip()


def split_into_sentences(text: str) -> list[str]:
    normalized = normalize_contract_text(text)
    if not normalized:
        return []

    prepared = normalized.replace(";", ". ").replace("\n", ". ")
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", prepared)
        if sentence.strip()
    ]
    return sentences

