import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        resp = await client.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": "admin@mizanmail.com", "password": "Mizan@2026!"})
        print(resp.status_code, resp.text)

asyncio.run(test())
