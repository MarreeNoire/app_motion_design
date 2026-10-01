import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export async function validateAgnesKey(apiKey) {
  const { data } = await axios.post(`${API}/agnes/validate`, { api_key: apiKey }, { timeout: 30000 });
  return data; // { valid, message, models? }
}

export async function generateAgnesStoryboard({ apiKey, prompt, duration, aspect, brandName, palette }) {
  const { data } = await axios.post(
    `${API}/agnes/storyboard`,
    {
      api_key: apiKey,
      prompt,
      duration,
      aspect_ratio: aspect,
      brand_name: brandName || null,
      palette: palette ? [palette.primary, palette.secondary, palette.accent] : null,
    },
    { timeout: 120000 }
  );
  return data; // { scenes, duration, ... }
}

export function extractApiError(err) {
  if (err?.response?.data?.detail) return err.response.data.detail;
  if (err?.code === "ECONNABORTED") return "Délai d'attente dépassé. Le serveur Agnes AI met trop de temps à répondre.";
  if (err?.message?.includes("Network")) return "Problème réseau : impossible de contacter le serveur.";
  return err?.message || "Une erreur inattendue est survenue.";
}
