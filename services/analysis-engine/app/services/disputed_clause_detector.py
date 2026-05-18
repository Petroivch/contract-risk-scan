from __future__ import annotations

from dataclasses import dataclass
import re

from app.config.models import DetectionLogicConfig, DisputeMarkerConfig
from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.dto.analysis import DisputedClauseItem, SourceFragmentProvenance, TextOffset
from app.services.clause_segmentation import ClauseSegment
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class PatternHit:
    pattern: str
    start: int
    end: int
    text: str


@dataclass(slots=True)
class MarkerMatch:
    hits: list[PatternHit]
    fragment_start: int
    fragment_end: int
    fragment_text: str
    matched_patterns: list[str]


class DisputedClauseDetector:
    """Config-first heuristic detector for disputed and ambiguous clauses."""

    _FALLBACK_RULE_ID = "fallback_disputed_clause"
    _PROVENANCE_SOURCE = "normalized_document_text"

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._language_behavior = runtime_config.language_behavior
        self._config = runtime_config.risk_scoring

    def detect(self, clauses: list[ClauseSegment], language: str) -> list[DisputedClauseItem]:
        resolved_language = normalize_analysis_language(language)
        disputed: list[DisputedClauseItem] = []
        seen_pairs: set[tuple[str, str]] = set()

        for clause in clauses:
            normalized_clause = normalize_contract_text(clause.text)
            for marker in self._config.dispute_markers:
                match = self._match_marker(marker, normalized_clause)
                if match is None:
                    continue

                dedupe_key = (clause.clause_id, marker.id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)

                disputed.append(
                    DisputedClauseItem(
                        clause_id=clause.clause_id,
                        text=normalized_clause,
                        offset=TextOffset(
                            start=max(clause.offset, 0),
                            end=max(clause.end_offset, clause.offset + len(normalized_clause)),
                        ),
                        rule_id=marker.id,
                        clause_excerpt=self._truncate_intelligently(normalized_clause),
                        dispute_reason=self._ensure_complete_sentence(
                            resolve_localized_text(marker.reason, resolved_language)
                        ),
                        possible_consequence=self._ensure_complete_sentence(
                            resolve_localized_text(marker.consequence, resolved_language)
                        ),
                        confidence=marker.confidence,
                        provenance=SourceFragmentProvenance(
                            source=self._PROVENANCE_SOURCE,
                            source_ref=marker.source_ref,
                            text=match.fragment_text,
                            offset=TextOffset(
                                start=clause.offset + match.fragment_start,
                                end=clause.offset + match.fragment_end,
                            ),
                            matched_patterns=match.matched_patterns,
                        ),
                    )
                )

        if disputed or not clauses:
            return disputed

        first_clause = self._normalize_clause(clauses[0])
        return [
            DisputedClauseItem(
                clause_id=first_clause.clause_id,
                text=first_clause.text,
                offset=TextOffset(
                    start=max(first_clause.offset, 0),
                    end=max(first_clause.end_offset, first_clause.offset + len(first_clause.text)),
                ),
                rule_id=self._FALLBACK_RULE_ID,
                clause_excerpt=self._truncate_intelligently(first_clause.text),
                dispute_reason=resolve_localized_text(self._config.fallback.dispute_reason, resolved_language),
                possible_consequence=resolve_localized_text(
                    self._config.fallback.dispute_consequence,
                    resolved_language,
                ),
                confidence=self._config.fallback_dispute_confidence,
                provenance=SourceFragmentProvenance(
                    source=self._PROVENANCE_SOURCE,
                    source_ref=None,
                    text=first_clause.text,
                    offset=TextOffset(
                        start=max(first_clause.offset, 0),
                        end=max(first_clause.end_offset, first_clause.offset + len(first_clause.text)),
                    ),
                    matched_patterns=[],
                ),
            )
        ]

    def _match_marker(self, marker: DisputeMarkerConfig, clause_text: str) -> MarkerMatch | None:
        logic = marker.detection_logic
        if logic is None:
            patterns = marker.markers
            if not patterns:
                return None
            hits = self._collect_hits(clause_text, patterns)
            if not hits:
                return None
            return self._build_marker_match(clause_text, hits, marker)

        return self._match_logic(clause_text, marker, logic)

    def _match_logic(
        self,
        clause_text: str,
        marker: DisputeMarkerConfig,
        logic: DetectionLogicConfig,
    ) -> MarkerMatch | None:
        patterns = logic.patterns or logic.any_patterns or marker.markers
        all_patterns = logic.all_patterns
        absent_patterns = logic.absent_patterns

        if any(self._contains_pattern(clause_text, pattern) for pattern in absent_patterns):
            return None

        all_hits = self._collect_hits(clause_text, all_patterns) if all_patterns else []
        if all_patterns and len({hit.pattern for hit in all_hits}) < len(all_patterns):
            return None

        pattern_hits = self._collect_hits(clause_text, patterns) if patterns else []
        if patterns and len({hit.pattern for hit in pattern_hits}) < logic.min_matches:
            return None

        selected_hits = pattern_hits or all_hits
        if not selected_hits:
            return None

        return self._build_marker_match(clause_text, [*all_hits, *pattern_hits], marker)

    def _build_marker_match(
        self,
        clause_text: str,
        hits: list[PatternHit],
        marker: DisputeMarkerConfig,
    ) -> MarkerMatch:
        ordered_hits = sorted(hits, key=lambda item: (item.start, item.end, item.pattern))
        unique_patterns: list[str] = []
        seen_patterns: set[str] = set()
        for hit in ordered_hits:
            if hit.pattern in seen_patterns:
                continue
            seen_patterns.add(hit.pattern)
            unique_patterns.append(hit.pattern)

        start = min(hit.start for hit in ordered_hits)
        end = max(hit.end for hit in ordered_hits)
        fragment_start, fragment_end, fragment_text = self._extract_fragment(
            clause_text=clause_text,
            match_start=start,
            match_end=end,
            window=marker.fragment_window_chars,
            max_chars=marker.fragment_max_chars,
        )

        return MarkerMatch(
            hits=ordered_hits,
            fragment_start=fragment_start,
            fragment_end=fragment_end,
            fragment_text=fragment_text,
            matched_patterns=unique_patterns,
        )

    def _extract_fragment(
        self,
        clause_text: str,
        match_start: int,
        match_end: int,
        window: int,
        max_chars: int,
    ) -> tuple[int, int, str]:
        start = max(match_start - window, 0)
        end = min(match_end + window, len(clause_text))

        while end - start > max_chars:
            if start < match_start:
                start += 1
            if end - start <= max_chars:
                break
            if end > match_end:
                end -= 1

        fragment_text = clause_text[start:end].strip()
        if not fragment_text:
            fragment_text = clause_text[match_start:match_end].strip()
            start = match_start
            end = match_end

        leading_trim = len(clause_text[start:end]) - len(clause_text[start:end].lstrip())
        trailing_trim = len(clause_text[start:end]) - len(clause_text[start:end].rstrip())
        start += leading_trim
        end -= trailing_trim
        fragment_text = clause_text[start:end]
        return start, end, fragment_text

    def _collect_hits(self, clause_text: str, patterns: list[str]) -> list[PatternHit]:
        hits: list[PatternHit] = []
        for pattern in patterns:
            hits.extend(self._find_pattern_hits(clause_text, pattern))
        return hits

    def _find_pattern_hits(self, text: str, pattern: str) -> list[PatternHit]:
        try:
            return [
                PatternHit(
                    pattern=pattern,
                    start=match.start(),
                    end=match.end(),
                    text=match.group(0),
                )
                for match in re.finditer(pattern, text, flags=re.IGNORECASE)
            ]
        except re.error:
            lowered_text = text.casefold()
            lowered_pattern = pattern.casefold()
            hits: list[PatternHit] = []
            cursor = 0
            while True:
                start = lowered_text.find(lowered_pattern, cursor)
                if start < 0:
                    break
                end = start + len(lowered_pattern)
                hits.append(
                    PatternHit(
                        pattern=pattern,
                        start=start,
                        end=end,
                        text=text[start:end],
                    )
                )
                cursor = end
            return hits

    def _truncate_intelligently(self, text: str) -> str:
        truncation = self._config.truncation
        if truncation is None:
            max_chars = self._config.max_clause_excerpt_chars
            return text if len(text) <= max_chars else f"{text[:max_chars].rstrip()}..."

        max_chars = truncation.max_chars
        if len(text) <= max_chars:
            return self._ensure_complete_sentence(text)

        truncated = text[:max_chars]
        if truncation.preserve_word_boundary:
            last_space = truncated.rfind(" ")
            if last_space > max_chars * 0.6:
                truncated = truncated[:last_space]

        if truncation.ensure_sentence_end and truncated[-1:] not in ".!?":
            last_sentence_end = max(truncated.rfind("."), truncated.rfind("!"), truncated.rfind("?"))
            if last_sentence_end > len(truncated) * 0.7:
                truncated = truncated[: last_sentence_end + 1]
            else:
                truncated = f"{truncated.rstrip()}{truncation.fallback_ending}"

        return truncated.strip()

    @staticmethod
    def _contains_pattern(text: str, pattern: str) -> bool:
        try:
            return bool(re.search(pattern, text, flags=re.IGNORECASE))
        except re.error:
            return pattern.casefold() in text.casefold()

    @staticmethod
    def _normalize_clause(clause: ClauseSegment) -> ClauseSegment:
        normalized_text = normalize_contract_text(clause.text)
        end_offset = clause.end_offset or clause.offset + len(normalized_text)
        return ClauseSegment(
            clause_id=clause.clause_id,
            text=normalized_text,
            offset=clause.offset,
            end_offset=end_offset,
        )

    @staticmethod
    def _ensure_complete_sentence(text: str) -> str:
        cleaned = normalize_contract_text(text)
        if not cleaned:
            return cleaned
        if cleaned[-1] not in ".!?":
            return f"{cleaned}."
        return cleaned

