// Predefined model bundles for Mercury
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricingPrompt?: string;
  provider?: string;
}

// Model packs — curated templates
export const MODEL_PACKS: Array<{
  id: string;
  name: string;
  description: string;
  emoji: string;
  models: string[];
}> = [
  {
    id: "deep-research",
    name: "Deep Research",
    description: "Best reasoning models for complex research",
    emoji: "🔬",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/o1",
      "google/gemini-pro-1.5",
      "deepseek/deepseek-r1",
      "openai/o3-mini",
    ],
  },
  {
    id: "council",
    name: "Grand Council",
    description: "7 leading models debate your question",
    emoji: "⚖️",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "google/gemini-pro-1.5",
      "deepseek/deepseek-r1",
      "meta-llama/llama-3.1-405b-instruct",
      "mistralai/mistral-large-2411",
      "x-ai/grok-2-1212",
    ],
  },
  {
    id: "open-source",
    name: "Open Source",
    description: "Best open-source models only",
    emoji: "🌐",
    models: [
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.1-405b-instruct",
      "deepseek/deepseek-r1",
      "mistralai/mistral-large-2411",
      "qwen/qwen-max",
    ],
  },
  {
    id: "budget",
    name: "Speed Run",
    description: "Fast & affordable — great for quick research",
    emoji: "⚡",
    models: [
      "anthropic/claude-3.5-haiku-20241022",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-r1-distill-qwen-32b",
    ],
  },
];

// Get provider from model ID
export function getProvider(modelId: string): string {
  if (modelId.startsWith("anthropic/")) return "anthropic";
  if (modelId.startsWith("openai/")) return "openai";
  if (modelId.startsWith("google/")) return "google";
  if (modelId.startsWith("meta-llama/")) return "meta";
  if (modelId.startsWith("mistralai/")) return "mistral";
  if (modelId.startsWith("deepseek/")) return "deepseek";
  if (modelId.startsWith("qwen/")) return "qwen";
  if (modelId.startsWith("x-ai/")) return "xai";
  if (modelId.startsWith("nvidia/")) return "nvidia";
  if (modelId.startsWith("cohere/")) return "cohere";
  return "default";
}

// Get friendly provider name
export function getProviderName(modelId: string): string {
  const p = getProvider(modelId);
  const names: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    meta: "Meta",
    mistral: "Mistral",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    xai: "xAI",
    nvidia: "NVIDIA",
    cohere: "Cohere",
    default: "Other",
  };
  return names[p] ?? p;
}

// Format price per million tokens
export function formatPrice(pricingPrompt: string): string {
  const price = parseFloat(pricingPrompt) * 1_000_000;
  if (price === 0) return "Free";
  if (price < 0.1) return `$${price.toFixed(3)}/M`;
  return `$${price.toFixed(2)}/M`;
}

// Static fallback model list (shown before API key is set)
export const STATIC_MODELS: ModelInfo[] = [
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "openai/o1", name: "o1", provider: "openai" },
  { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", provider: "google" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", provider: "meta" },
  { id: "mistralai/mistral-large-2411", name: "Mistral Large", provider: "mistral" },
  { id: "x-ai/grok-2-1212", name: "Grok 2", provider: "xai" },
  { id: "qwen/qwen-max", name: "Qwen Max", provider: "qwen" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini Flash 2.0", provider: "google" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "meta" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "deepseek" },
  { id: "openai/o3-mini", name: "o3 Mini", provider: "openai" },
  { id: "anthropic/claude-3.5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic" },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "Nemotron 70B", provider: "nvidia" },
];
