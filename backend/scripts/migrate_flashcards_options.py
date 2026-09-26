import os
import sys
import json
import logging
import random
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings.development')
sys.path.insert(0, os.path.abspath('backend'))
django.setup()

from apps.activities.models import Flashcard, Module
from apps.activities.generator import CEFRGeneratorService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MigrateFlashcards")

def generate_distractors_with_groq(cards_batch, level, topic, client):
    """
    Generates 3 distractors for each card in cards_batch using Groq.
    """
    if not client or not cards_batch:
        return {}
    
    prompt = f"""You are an expert English teacher. For each of the following target vocabulary items for CEFR Level {level} (Topic: {topic}), generate EXACTLY 3 plausible, realistic incorrect distractors in English (same part of speech or topic).
Items:
{json.dumps([c['front'] for c in cards_batch])}

Return ONLY a JSON object in this format:
{{
  "results": [
    {{
      "front": "target word",
      "distractors": ["distractor 1", "distractor 2", "distractor 3"]
    }}
  ]
}}
All distractors must be in English and appropriate for level {level}.
"""
    try:
        res = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        data = json.loads(res.choices[0].message.content)
        mapping = {}
        for item in data.get("results", []):
            front = item.get("front", "").strip().lower()
            dists = [d.strip() for d in item.get("distractors", []) if d.strip()]
            if front and dists:
                mapping[front] = dists[:3]
        return mapping
    except Exception as e:
        logger.warning(f"Groq error: {e}")
        return {}

def migrate_cefr_flashcards():
    client = CEFRGeneratorService._get_groq_client()
    cards = list(Flashcard.objects.all())
    logger.info(f"Total CEFR Flashcards: {len(cards)}")
    
    # Group by level and topic
    groups = {}
    for c in cards:
        key = (c.level or "A1", c.topic or "General")
        groups.setdefault(key, []).append(c)

    updated_count = 0
    for (lvl, topic), group_cards in groups.items():
        needed = [c for c in group_cards if not c.options or len(c.options) < 4]
        if not needed:
            continue
        
        logger.info(f"Processing group ({lvl}, {topic}): {len(needed)} cards needing options...")
        
        # Process in batches of 8
        for i in range(0, len(needed), 8):
            batch = needed[i:i+8]
            batch_data = [{"front": c.front} for c in batch]
            dist_map = generate_distractors_with_groq(batch_data, lvl, topic, client)
            
            all_fronts_in_deck = [c.front for c in group_cards]
            for c in batch:
                front_key = c.front.strip().lower()
                distractors = dist_map.get(front_key, [])
                
                # If LLM didn't return 3, pick from other cards in the same deck
                if len(distractors) < 3:
                    for sibling in all_fronts_in_deck:
                        if sibling.strip().lower() != front_key and sibling not in distractors:
                            distractors.append(sibling.strip())
                        if len(distractors) >= 3:
                            break
                
                # Fallback generic words
                generic_pool = [
                    "Breakfast", "Library", "Traveler", "Appointment", "Weather",
                    "Computer", "Schedule", "Exercise", "Holiday", "Meeting",
                    "Journey", "Question", "Answer", "Decision", "Message"
                ]
                random.shuffle(generic_pool)
                for gen in generic_pool:
                    if len(distractors) >= 3:
                        break
                    if gen.lower() != front_key and gen not in distractors:
                        distractors.append(gen)
                
                options = [c.front.strip()] + distractors[:3]
                # Ensure exactly 4 unique options
                options = list(dict.fromkeys(options))
                while len(options) < 4:
                    options.append(f"Option {len(options)+1}")
                
                # Save to database
                c.options = options
                c.save(update_fields=["options"])
                updated_count += 1
                
    logger.info(f"CEFR Flashcards updated: {updated_count}")

def migrate_module_flashcards():
    client = CEFRGeneratorService._get_groq_client()
    modules = list(Module.objects.filter(flashcards__isnull=False))
    logger.info(f"Total Modules with flashcards: {len(modules)}")
    
    updated_modules = 0
    for m in modules:
        if not isinstance(m.flashcards, list) or len(m.flashcards) == 0:
            continue
        
        needs_update = False
        new_fc_list = []
        all_fronts = [c.get("front", "") for c in m.flashcards if isinstance(c, dict)]
        
        cards_needing_distractors = []
        for c in m.flashcards:
            if not isinstance(c, dict):
                continue
            opts = c.get("options")
            if not opts or len(opts) < 4:
                needs_update = True
                cards_needing_distractors.append(c)

        dist_map = {}
        if needs_update and cards_needing_distractors:
            for i in range(0, len(cards_needing_distractors), 8):
                batch = cards_needing_distractors[i:i+8]
                b_map = generate_distractors_with_groq(batch, m.level or "A1", m.title, client)
                dist_map.update(b_map)

        for c in m.flashcards:
            if not isinstance(c, dict):
                continue
            front = c.get("front", "").strip()
            opts = c.get("options", [])
            if not opts or len(opts) < 4:
                dists = dist_map.get(front.lower(), [])
                if len(dists) < 3:
                    for sib in all_fronts:
                        if sib.lower() != front.lower() and sib not in dists:
                            dists.append(sib)
                        if len(dists) >= 3:
                            break
                while len(dists) < 3:
                    dists.append(f"Word {len(dists)+1}")
                final_opts = [front] + dists[:3]
                c["options"] = list(dict.fromkeys(final_opts))[:4]
            new_fc_list.append(c)

        if needs_update:
            m.flashcards = new_fc_list
            m.save(update_fields=["flashcards"])
            updated_modules += 1

    logger.info(f"Modules updated: {updated_modules}")

if __name__ == "__main__":
    migrate_cefr_flashcards()
    migrate_module_flashcards()
    print("Migration completed successfully!")
