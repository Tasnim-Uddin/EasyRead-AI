def test_emergency_curly_apostrophe_and_new_languages():
    from agent.qa import emergency_level
    assert emergency_level("I can\u2019t breathe") == "999"
    assert emergency_level("Nie mogę oddychać") == "999"
    assert emergency_level("مجھے سینے میں درد ہے") == "999"
    assert emergency_level("I think I am having an allergic reaction") == "999"


def test_plain_allergy_question_is_not_999():
    from agent.qa import emergency_level
    assert emergency_level("I am allergic to penicillin, can I use this?") != "999"
