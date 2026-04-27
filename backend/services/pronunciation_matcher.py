import difflib
import re

def clean_text(text: str) -> str:
    return re.sub(r'[^\w\s]', '', text.lower()).strip()

def match_pronunciation(target: str, student_input: str) -> list[dict]:
    target_words = target.split()
    student_words = clean_text(student_input).split()
    
    matcher = difflib.SequenceMatcher(None, [clean_text(w) for w in target_words], student_words)
    
    result = []
    for i, word in enumerate(target_words):
        # Default to error
        status = "error"
        # Check if word exists in student input roughly in the same position
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal' and i1 <= i < i2:
                status = "correct"
                break
        result.append({"word": word, "status": status})
    
    return result
