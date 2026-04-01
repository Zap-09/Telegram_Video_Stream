import os
import sys
import asyncio
import dotenv
dotenv.load_dotenv()


from telethon import TelegramClient


async def main():
    api_id = int(os.environ["API_ID"])
    api_hash = os.environ["API_HASH"]
    client = TelegramClient("session", api_id, api_hash)
    await client.start()  # type:ignore
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
