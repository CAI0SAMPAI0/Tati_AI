import asyncio
import edge_tts

async def main():
    voices = await edge_tts.list_voices()
    en_voices = [v for v in voices if v['Locale'].startswith('en-')]
    for v in en_voices:
        print(f"{v['Locale']}: {v['ShortName']} ({v['Gender']})")

if __name__ == '__main__':
    asyncio.run(main())
