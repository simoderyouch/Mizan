import re
from dataclasses import dataclass


SAFETY_LEVEL_NONE = "none"
SAFETY_LEVEL_HIGH = "high"
SAFETY_ACTION_HUMAN_SUPPORT = "human_support_recommended"


@dataclass(frozen=True)
class SafetyAssessment:
    level: str
    action: str | None = None
    matched_phrase: str | None = None

    @property
    def is_high_risk(self) -> bool:
        return self.level == SAFETY_LEVEL_HIGH


HIGH_RISK_PATTERNS = (
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bsuicid(?:e|al)\b",
    r"\bself[-\s]?harm\b",
    r"\bhurt myself\b",
    r"\bi want to die\b",
    r"\bi do not want to live\b",
    r"\bi don't want to live\b",
    r"\bi can't continue\b",
    r"\bi cannot continue\b",
    r"\bi can't go on\b",
    r"\bi cannot go on\b",
    r"\bpanic attack\b",
    r"\bi am being abused\b",
    r"\bsomeone is abusing me\b",
    r"\bsexual assault\b",
    r"\bdomestic violence\b",
    r"\bje veux mourir\b",
    r"\bme suicider\b",
    r"\bsuicide\b",
    r"\bje ne peux plus\b",
    r"\bje n'en peux plus\b",
    r"\bje veux me faire du mal\b",
    r"\bcrise de panique\b",
    r"\bon m'abuse\b",
    r"\bagression sexuelle\b",
    r"\bviolence domestique\b",
)


SAFE_SUPPORT_RESPONSE = (
    "I am really sorry you are feeling this much pressure. This is important, and you deserve help "
    "from a real person right now. Please contact a trusted person immediately, such as a school "
    "counselor, teacher, family member, or close friend. If you might hurt yourself or you are in "
    "immediate danger, contact local emergency services now. I can stay with you for support, but I "
    "cannot replace urgent human help."
)


def assess_text_safety(text: str | None) -> SafetyAssessment:
    normalized = (text or "").lower()
    if not normalized.strip():
        return SafetyAssessment(level=SAFETY_LEVEL_NONE)

    for pattern in HIGH_RISK_PATTERNS:
        match = re.search(pattern, normalized)
        if match:
            return SafetyAssessment(
                level=SAFETY_LEVEL_HIGH,
                action=SAFETY_ACTION_HUMAN_SUPPORT,
                matched_phrase=match.group(0),
            )

    return SafetyAssessment(level=SAFETY_LEVEL_NONE)


def assess_many_texts(texts: list[str]) -> SafetyAssessment:
    for text in texts:
        assessment = assess_text_safety(text)
        if assessment.is_high_risk:
            return assessment
    return SafetyAssessment(level=SAFETY_LEVEL_NONE)


def safety_metadata(assessment: SafetyAssessment) -> dict:
    payload = {"safety_level": assessment.level}
    if assessment.action:
        payload["safety_action"] = assessment.action
    return payload
