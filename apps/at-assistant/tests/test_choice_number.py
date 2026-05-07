from src.core.engine import Engine
from src.core.result import ActionStatus


def test_parse_choice_number_accepts_vietnamese_spoken_numbers():
    assert Engine._parse_choice_number("số ba") == 3
    assert Engine._parse_choice_number("chọn số ba") == 3
    assert Engine._parse_choice_number("số 3") == 3
    assert Engine._parse_choice_number("chon so muoi hai") == 12


def test_consume_choice_accepts_spoken_number():
    engine = Engine()
    engine.state.last_choices = ["a.txt", "b.txt", "c.txt"]
    engine.state.last_action = "open"

    result = engine._consume_choice("số ba")

    assert result is not None
    assert result.status in {ActionStatus.SUCCESS, ActionStatus.ERROR}
    assert engine.state.last_choices == []
