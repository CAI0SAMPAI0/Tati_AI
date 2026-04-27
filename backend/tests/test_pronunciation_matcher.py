from services.pronunciation_matcher import match_pronunciation

def test_match_pronunciation():
    target = "The sky is blue"
    student = "The sky is red"
    result = match_pronunciation(target, student)
    assert result[0]["status"] == "correct" # The
    assert result[1]["status"] == "correct" # sky
    assert result[2]["status"] == "correct" # is
    assert result[3]["status"] == "error"   # blue vs red
