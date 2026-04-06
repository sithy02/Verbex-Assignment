import httpx
import asyncio

async def fire_webhook(webhook_url: str, agent_id: str, conversation_id: str):
    """Fire webhook without blocking — errors silently ignored"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                webhook_url,
                json={"agentId": agent_id, "conversationId": conversation_id},
                headers={"Content-Type": "application/json"},
            )
    except Exception as e:
        print(f"[Webhook] Failed to fire {webhook_url}: {e}")

def schedule_webhook(webhook_url: str, agent_id: str, conversation_id: str):
    """Schedule fire-and-forget webhook via asyncio task"""
    if webhook_url:
        asyncio.create_task(fire_webhook(webhook_url, agent_id, conversation_id))
