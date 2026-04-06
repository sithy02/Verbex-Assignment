# from openai import AsyncOpenAI
# from app.config import settings

# client = AsyncOpenAI(
#     api_key=settings.OPENROUTER_API_KEY,
#     base_url="https://openrouter.ai/api/v1",
#     default_headers={
#         "HTTP-Referer": "http://localhost:3000",
#         "X-Title": "Verbex AI Agent Platform",
#     },
# )

# # Verified working free models on OpenRouter (in fallback order)
# FALLBACK_MODELS = [
#     "mistralai/mistral-7b-instruct:free",
#     "meta-llama/llama-3.1-8b-instruct:free",
#     "google/gemma-3-12b-it:free",
# ]

# async def generate_reply(messages: list[dict], model: str, temperature: float) -> str:
#     """
#     Generate AI response via OpenRouter.
#     Falls back through verified models if primary fails.
#     """
#     models_to_try = [model] + [m for m in FALLBACK_MODELS if m != model]

#     for attempt_model in models_to_try:
#         try:
#             response = await client.chat.completions.create(
#                 model=attempt_model,
#                 messages=messages,
#                 temperature=float(temperature),
#                 max_tokens=1024,
#             )
#             content = response.choices[0].message.content
#             if content and content.strip():
#                 return content.strip()
#         except Exception as e:
#             # Log and try next model
#             print(f"[LLM] Model {attempt_model} failed: {e}")
#             continue

#     return "I'm temporarily unavailable. Please try again in a moment."


from openai import AsyncOpenAI
from app.config import settings
import httpx

# Try OpenRouter first
client = AsyncOpenAI(
    api_key=settings.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Verbex AI Agent Platform",
    },
)

# Models to try on OpenRouter (includes models that don't require credits)
OPENROUTER_MODELS = [
    "meta-llama/llama-2-7b-chat",
    "mistralai/mixtral-8x7b-instruct",
    "gpt-3.5-turbo",
    "claude-3-haiku",
]

async def try_openrouter(messages: list[dict], model: str, temperature: float) -> str | None:
    """Try to get a response from OpenRouter."""
    models_to_try = []
    if model not in OPENROUTER_MODELS:
        models_to_try.append(model)
    models_to_try.extend(OPENROUTER_MODELS)
    
    for attempt_model in models_to_try:
        try:
            print(f"[LLM] Attempting OpenRouter model: {attempt_model}", flush=True)
            response = await client.chat.completions.create(
                model=attempt_model,
                messages=messages,
                temperature=float(temperature),
                max_tokens=1024,
            )
            content = response.choices[0].message.content
            if content and content.strip():
                print(f"[LLM] Success with OpenRouter model: {attempt_model}", flush=True)
                return content.strip()
        except Exception as e:
            print(f"[LLM] OpenRouter {attempt_model} failed: {type(e).__name__}: {str(e)[:100]}", flush=True)
            continue
    
    return None

async def try_ollama(messages: list[dict], temperature: float) -> str | None:
    """Try to get a response from local Ollama instance if available."""
    try:
        print("[LLM] Attempting local Ollama...", flush=True)
        async with httpx.AsyncClient(timeout=10) as client:
            # First, check if Ollama is running
            health = await client.get("http://localhost:11434/api/tags")
            if health.status_code != 200:
                return None
            
            # Try to use available models
            models_response = await client.get("http://localhost:11434/api/tags")
            available_models = models_response.json().get("models", [])
            
            if not available_models:
                print("[LLM] No models available in Ollama", flush=True)
                return None
            
            # Use the first available model
            model_name = available_models[0]["name"]
            print(f"[LLM] Using Ollama model: {model_name}", flush=True)
            
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": float(temperature),
                    "stream": False,
                },
            )
            
            if response.status_code == 200:
                content = response.json().get("message", {}).get("content", "")
                if content and content.strip():
                    print(f"[LLM] Success with Ollama model: {model_name}", flush=True)
                    return content.strip()
    except Exception as e:
        print(f"[LLM] Ollama attempt failed: {type(e).__name__}", flush=True)
    
    return None

async def generate_reply(messages: list[dict], model: str, temperature: float) -> str:
    """Generate AI reply using available LLM services."""
    
    # Try OpenRouter first
    print("[LLM] Trying OpenRouter service...", flush=True)
    reply = await try_openrouter(messages, model, temperature)
    if reply:
        return reply
    
    # Try local Ollama as fallback
    print("[LLM] Trying local Ollama as fallback...", flush=True)
    reply = await try_ollama(messages, temperature)
    if reply:
        return reply
    
    # All services failed
    error_msg = (
        "I'm temporarily unavailable. "
        "Please check that:\n"
        "1. Your OpenRouter API key is valid and has credits, OR\n"
        "2. Ollama is running locally at http://localhost:11434"
    )
    print(f"[LLM] All services exhausted. {error_msg}", flush=True)
    return "I'm temporarily unavailable. Please try again in a moment."


async def generate_reply_stream(messages: list[dict], model: str, temperature: float):
    """Generate AI reply with streaming support - yields chunks of text."""
    
    models_to_try = []
    if model not in OPENROUTER_MODELS:
        models_to_try.append(model)
    models_to_try.extend(OPENROUTER_MODELS)
    
    for attempt_model in models_to_try:
        try:
            print(f"[LLM] Attempting OpenRouter model (streaming): {attempt_model}", flush=True)
            stream = await client.chat.completions.create(
                model=attempt_model,
                messages=messages,
                temperature=float(temperature),
                max_tokens=1024,
                stream=True,
            )
            
            full_response = ""
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    full_response += text
                    yield text
            
            if full_response.strip():
                print(f"[LLM] Success with OpenRouter model (streaming): {attempt_model}", flush=True)
                return
        except Exception as e:
            print(f"[LLM] OpenRouter {attempt_model} (streaming) failed: {type(e).__name__}: {str(e)[:100]}", flush=True)
            continue
    
    # Fallback if all models fail
    error_msg = "I'm temporarily unavailable. Please try again in a moment."
    print(f"[LLM] All models exhausted (streaming). Using default message.", flush=True)
    yield error_msg
