import hashlib
import uuid

def generate_api_key() -> str:
    """Generate a raw UUID-based API key (shown once to user)"""
    return f"vbx_{uuid.uuid4().hex}{uuid.uuid4().hex}"

def hash_api_key(key: str) -> str:
    """Hash API key with SHA-256 for storage"""
    return hashlib.sha256(key.encode()).hexdigest()

def verify_api_key(raw_key: str, stored_hash: str) -> bool:
    """Verify raw key against stored hash"""
    return hashlib.sha256(raw_key.encode()).hexdigest() == stored_hash
