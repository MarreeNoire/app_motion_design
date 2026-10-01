from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Agnes Motion Studio API")
api_router = APIRouter(prefix="/api")

AGNES_BASE = "https://apihub.agnes-ai.com/v1"
LLM_MODEL = "agnes-2.5-flash"


# ----------------------------- Models -----------------------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ValidateKeyRequest(BaseModel):
    api_key: str


class StoryboardRequest(BaseModel):
    api_key: str
    prompt: str
    duration: int = 30
    aspect_ratio: str = "16:9"
    brand_name: Optional[str] = None
    palette: Optional[List[str]] = None


# ----------------------------- Scene skeleton -----------------------------
# role weights define how the total duration is split across scenes.
ROLE_TEMPLATES = {
    30: [("hook", 0.17), ("problem", 0.17), ("solution", 0.33), ("benefits", 0.21), ("cta", 0.12)],
    35: [("hook", 0.16), ("problem", 0.16), ("solution", 0.31), ("benefits", 0.23), ("cta", 0.14)],
    45: [("hook", 0.13), ("problem", 0.14), ("solution", 0.24), ("features", 0.20), ("benefits", 0.16), ("cta", 0.13)],
    60: [("hook", 0.11), ("problem", 0.12), ("solution", 0.19), ("features", 0.18), ("showcase", 0.15),
         ("benefits", 0.13), ("cta", 0.12)],
}

ROLE_LABELS = {
    "hook": "Accroche visuelle / Hook",
    "problem": "Exposition du problème",
    "solution": "Démonstration de la solution",
    "features": "Fonctionnalités clés",
    "showcase": "Mise en situation",
    "benefits": "Avantages & bénéfices",
    "cta": "Call-To-Action & Outro",
}


def build_skeleton(duration: int):
    weights = ROLE_TEMPLATES.get(duration)
    if not weights:
        # pick nearest template
        nearest = min(ROLE_TEMPLATES.keys(), key=lambda k: abs(k - duration))
        weights = ROLE_TEMPLATES[nearest]
    raw = [(role, round(w * duration, 2)) for role, w in weights]
    # normalize so sum == duration
    total = sum(d for _, d in raw)
    diff = round(duration - total, 2)
    raw[-1] = (raw[-1][0], round(raw[-1][1] + diff, 2))
    scenes = []
    t = 0.0
    for i, (role, dur) in enumerate(raw):
        scenes.append({
            "index": i,
            "role": role,
            "label": ROLE_LABELS.get(role, role),
            "start": round(t, 2),
            "end": round(t + dur, 2),
            "duration": round(dur, 2),
        })
        t += dur
    return scenes


# ----------------------------- Agnes error mapping -----------------------------
def map_agnes_error(status: int) -> str:
    if status == 401:
        return "Clé API Agnes AI invalide ou expirée. Vérifiez votre clé sur platform.agnes-ai.com."
    if status == 403:
        return "Accès refusé : votre clé n'a pas la permission d'utiliser ce modèle Agnes AI."
    if status == 429:
        return "Quota Agnes AI dépassé ou trop de requêtes. Réessayez plus tard."
    if status in (500, 502, 503, 504):
        return "Le service Agnes AI est momentanément indisponible. Réessayez dans un instant."
    return f"Erreur Agnes AI (code {status})."


# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Agnes Motion Studio API"}


@api_router.post("/agnes/validate")
async def validate_key(req: ValidateKeyRequest):
    key = (req.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Clé API manquante.")
    headers = {"Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            # Try the lightweight models listing first.
            r = await hc.get(f"{AGNES_BASE}/models", headers=headers)
            if r.status_code == 200:
                models = []
                try:
                    data = r.json()
                    models = [m.get("id") for m in data.get("data", []) if isinstance(m, dict)]
                except Exception:
                    pass
                return {"valid": True, "message": "Clé API Agnes AI validée avec succès.", "models": models}
            if r.status_code == 404:
                # models endpoint not available -> fall back to a tiny chat call
                cr = await hc.post(
                    f"{AGNES_BASE}/chat/completions",
                    headers=headers,
                    json={"model": LLM_MODEL, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                )
                if cr.status_code == 200:
                    return {"valid": True, "message": "Clé API Agnes AI validée avec succès."}
                return {"valid": False, "message": map_agnes_error(cr.status_code)}
            return {"valid": False, "message": map_agnes_error(r.status_code)}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Délai dépassé en contactant Agnes AI. Vérifiez votre réseau.")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Problème réseau lors de la connexion à Agnes AI.")


def _extract_json(text: str):
    if not text:
        return None
    # strip code fences
    text = re.sub(r"^```(?:json)?", "", text.strip())
    text = re.sub(r"```$", "", text.strip())
    # find first [ ... ] or { ... }
    for opener, closer in (("[", "]"), ("{", "}")):
        s = text.find(opener)
        e = text.rfind(closer)
        if s != -1 and e != -1 and e > s:
            try:
                return json.loads(text[s:e + 1])
            except Exception:
                continue
    try:
        return json.loads(text)
    except Exception:
        return None


@api_router.post("/agnes/storyboard")
async def generate_storyboard(req: StoryboardRequest):
    key = (req.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Clé API manquante.")
    if not (req.prompt or "").strip():
        raise HTTPException(status_code=400, detail="Le prompt est vide.")

    skeleton = build_skeleton(req.duration)
    scene_specs = "\n".join(
        f'- Scène {s["index"]+1} ({s["start"]:.0f}s-{s["end"]:.0f}s, rôle="{s["role"]}" : {s["label"]})'
        for s in skeleton
    )

    system_prompt = (
        "Tu es un directeur artistique et copywriter expert en motion design publicitaire. "
        "Tu écris des textes courts, percutants et cinétiques (typographie animée). "
        "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour."
    )
    user_prompt = (
        f"Brief créatif de l'utilisateur : \"{req.prompt.strip()}\"\n\n"
        f"Durée totale de la vidéo : {req.duration} secondes.\n"
        f"Format : {req.aspect_ratio}.\n"
        f"Marque : {req.brand_name or 'déduis un nom court et crédible depuis le brief'}.\n\n"
        f"Découpe le brief en exactement {len(skeleton)} scènes correspondant à ce storyboard :\n"
        f"{scene_specs}\n\n"
        "Pour CHAQUE scène, fournis un objet JSON avec EXACTEMENT ces clés :\n"
        '  "index" (entier, 0-based),\n'
        '  "headline" (titre principal très court, 2 à 5 mots, MAJUSCULES impactantes),\n'
        '  "subtext" (sous-titre court, max 8 mots, ou chaîne vide),\n'
        '  "keywords" (tableau de 2 à 4 mots-clés très courts à afficher en typographie animée).\n\n'
        "Le texte doit être en français, orienté bénéfices, rythmé, et cohérent avec le rôle de chaque scène "
        "(accroche -> problème -> solution -> bénéfices -> call to action final). "
        f"Retourne un tableau JSON de {len(skeleton)} objets, ordonnés par index."
    )

    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.8,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as hc:
            r = await hc.post(f"{AGNES_BASE}/chat/completions", headers=headers, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Délai dépassé pendant la génération Agnes AI.")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Problème réseau avec Agnes AI pendant la génération.")

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=map_agnes_error(r.status_code))

    try:
        content = r.json()["choices"][0]["message"]["content"]
    except Exception:
        raise HTTPException(status_code=502, detail="Réponse Agnes AI inattendue.")

    parsed = _extract_json(content)
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="Agnes AI n'a pas renvoyé un storyboard exploitable.")

    by_index = {}
    for item in parsed:
        if isinstance(item, dict) and "index" in item:
            try:
                by_index[int(item["index"])] = item
            except Exception:
                continue
    # If indices missing, fall back to positional mapping
    if not by_index:
        for i, item in enumerate(parsed):
            if isinstance(item, dict):
                by_index[i] = item

    scenes = []
    for s in skeleton:
        item = by_index.get(s["index"], {})
        kw = item.get("keywords") or []
        if not isinstance(kw, list):
            kw = [str(kw)]
        scenes.append({
            **s,
            "headline": str(item.get("headline") or s["label"]).strip(),
            "subtext": str(item.get("subtext") or "").strip(),
            "keywords": [str(k).strip() for k in kw if str(k).strip()][:4],
        })

    return {
        "duration": req.duration,
        "aspect_ratio": req.aspect_ratio,
        "scene_count": len(scenes),
        "scenes": scenes,
        "source": "agnes-ai",
        "model": LLM_MODEL,
    }


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
