from django.db import migrations


TOPIC_RESTORATION_MAP = {
    # VPS 30 cards (Family and Relationships, Clothes and Accessories, Daily Routine)
    "13e34206-9ba7-4c1e-bb4c-eedb00fcb34e": "Family and Relationships",
    "332ec25c-b7f1-4818-b3a0-ab463afd36ef": "Clothes and Accessories",
    "e9376ca7-7f8b-47ee-abeb-6e2490f4f547": "Family and Relationships",
    "6d4e5c74-202d-42d9-a364-e480b86d186f": "Daily Routine",
    "d5807b25-7985-4b61-883f-141ea24b38bc": "Family and Relationships",
    "44dbd846-e711-48b3-b76d-576bd904d23c": "Clothes and Accessories",
    "74475ec5-1fcb-4e0c-ad05-aa68b5fa9927": "Daily Routine",
    "8a374286-02db-4c9e-8ab9-e7df32ad90d9": "Family and Relationships",
    "cc8d1c1e-dcd5-419f-af7d-111639421a9d": "Clothes and Accessories",
    "edd63096-159c-4182-b5b1-8df853fab07d": "Daily Routine",
    "496cdc1c-dede-4af6-9711-6e441f9c2a3a": "Daily Routine",
    "8ff3e959-5ba9-49d9-a737-a73e734e75c1": "Family and Relationships",
    "990e2cda-a84a-43b7-b7db-63408ca9208b": "Clothes and Accessories",
    "d149770b-864f-4d3a-afa0-040d26448faf": "Daily Routine",
    "9dabb463-dc12-4fdb-96c2-0049104f81e3": "Clothes and Accessories",
    "88624b0b-5f77-43ca-b7ec-34307af11969": "Family and Relationships",
    "8473b35f-78c6-41bc-979e-e5bcfc6aa63b": "Family and Relationships",
    "0c9fe1e6-4af9-41ba-b91d-6e5b4f9b12d5": "Family and Relationships",
    "b8020558-8be6-4730-bd7d-7f7dd75dc141": "Daily Routine",
    "2e88bdb9-453d-47f0-a20e-adf686544016": "Clothes and Accessories",
    "93f5df11-d3da-4c5e-8f50-8213c66f3aec": "Family and Relationships",
    "d207741a-f50a-402f-92bb-ba7e11b42aa7": "Clothes and Accessories",
    "98fa7233-58e1-4fff-8391-c60b5f8e108e": "Clothes and Accessories",
    "baaa378b-6ab0-4ce0-8432-f4eaac0d16f6": "Daily Routine",
    "aa0229fb-f147-433a-b440-b16b24ba5ad8": "Clothes and Accessories",
    "a8b8d931-d3b8-427f-9147-3e8f746481e9": "Daily Routine",
    "89dc535b-a764-4f02-a69b-3cac9028eb99": "Daily Routine",
    "fc21dcb8-b8cb-4b05-820e-f8d72637af03": "Family and Relationships",
    "d18eaa30-e3aa-4b5c-8d61-712cfdb9c778": "Daily Routine",
    "a51f7789-cd5a-4ee4-9863-6a41d07acc2f": "Clothes and Accessories",
    # Local 36 cards
    "327ba655-3249-482b-843d-62c697e34ec1": "Personal Information",
    "97bf30de-81fb-4a28-8535-3ca8b7c9555a": "Personal Information",
    "b3da04c9-104c-4497-b0bc-fa21c566034b": "Personal Information",
    "f02a24a6-1ee8-4b7a-82b8-b95774b00fb1": "Personal Information",
    "64fc7e22-7abc-405c-85d1-b61181a0250b": "Personal Information",
    "484d3035-9376-4449-b850-c9126fa799b9": "Personal Information",
    "f1915f40-f075-4880-a5ed-38261c3fd32b": "Personal Information",
    "c6315caa-2d02-404a-8c42-7257d9ce5fa0": "Personal Information",
    "fc7e83aa-21ef-4601-a66e-458090423059": "Personal Information",
    "eac9d204-4cb8-422c-a919-ada76e647e24": "Daily Routines",
    "7a38954b-add0-4d45-9ea8-1ca1fed6c63e": "Daily Routines",
    "406a05a6-bfca-471e-af1c-c88145356b37": "Daily Routines",
    "64fa9154-2696-4f95-8c89-fc61163f43b6": "Daily Routines",
    "876da472-9362-40df-9f69-dc699fffe803": "Daily Routines",
    "8c00557c-bb34-420e-a743-f13c431bd6ac": "Talking about health and lifestyle",
    "2d5eabf8-9ff4-4a05-a82c-f46f7e2bad91": "Talking about health and lifestyle",
    "1c5e0c0e-2026-4db9-86f7-249bbbb713c8": "Talking about health and lifestyle",
    "a778de94-b5aa-46ad-a4c0-f527de3e98c9": "Talking about health and lifestyle",
    "3f55912e-8c06-4e55-8b8e-aff73ccbbb10": "Talking about health and lifestyle",
    "e9728126-301d-49ca-823c-252865a7fa74": "Personal Information",
    "f2df710e-0a3a-4bba-9758-e10ef1eda0b9": "Personal Information",
    "857ac82f-5d8b-49db-8809-dec2f7101ed9": "Personal Information",
    "e94f361d-05e8-434e-98eb-f40dc41b168e": "Personal Information",
    "dcdaab90-20de-4299-91d1-bd1ad5e7e2c6": "Personal Information",
    "1f35e8df-f383-460a-8c2b-bb3bce8013e1": "Daily Routines",
    "6a325bfc-353d-41b6-8186-f1d0268ca06a": "Daily Routines",
    "7209f073-82d0-444a-b3d9-05a78ba86ba0": "Making requests and ordering in cafés or restaurants",
    "a94e1eba-f322-4c29-8316-46cc10f342ac": "Making requests and ordering in cafés or restaurants",
    "cd5373c1-7ec7-4306-9860-756a5b0e23f3": "Making requests and ordering in cafés or restaurants",
    "1ffb8073-37e9-43df-bc58-2e93297020e8": "Making requests and ordering in cafés or restaurants",
    "d49d5edb-6dbd-42b3-9f8a-60386aee0a69": "Making requests and ordering in cafés or restaurants",
    "17bc4049-38b0-4258-bfe6-9920059c67a1": "Daily Routines and Responsibilities",
    "bf87f9f6-f633-4f30-8e4e-d5a5ca6c015d": "Daily Routines and Responsibilities",
    "d553da0e-c898-4c16-9765-1c69e7641d09": "Daily Routines and Responsibilities",
    "2db20f72-c2d3-4b56-9a8a-ad331499e959": "Daily Routines and Responsibilities",
    "284c6f12-c099-48a1-a0fe-3c3c4a68fe14": "Daily Routines and Responsibilities",
}


def restore_topics_and_set_all_flashcards_draft(apps, schema_editor):
    Flashcard = apps.get_model("activities", "Flashcard")
    Module = apps.get_model("activities", "Module")

    for card_id, original_topic in TOPIC_RESTORATION_MAP.items():
        try:
            Flashcard.objects.filter(id=card_id, topic="Novo Baralho").update(
                topic=original_topic
            )
        except Exception:
            pass

    try:
        Flashcard.objects.all().update(is_published=False)
    except Exception:
        pass

    try:
        Module.objects.all().update(is_published=False)
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0005_fix_user_flashcard_progress_columns"),
    ]

    operations = [
        migrations.RunPython(
            restore_topics_and_set_all_flashcards_draft,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
