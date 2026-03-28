import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProvider, getProviderName, formatPrice, MODEL_PACKS, STATIC_MODELS, type ModelInfo } from "@/lib/models";
import { Badge } from "@/components/ui/badge";

interface ModelSelectorProps {
  selected: string[];
  onChange: (models: string[]) => void;
}

const PROVIDERS = ["All", "Anthropic", "OpenAI", "Google", "Meta", "Mistral", "DeepSeek", "Qwen", "Other"];

export default function ModelSelector({ selected, onChange }: ModelSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeProvider, setActiveProvider] = useState("All");
  const [packExpanded, setPackExpanded] = useState(false);

  const { data: apiModels } = useQuery<ModelInfo[]>({
    queryKey: ["/api/models"],
    retry: false,
  });

  const models: ModelInfo[] = apiModels ?? STATIC_MODELS;

  const filtered = useMemo(() => {
    return models.filter((m) => {
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase());
      const matchProvider = activeProvider === "All" || getProviderName(m.id) === activeProvider;
      return matchSearch && matchProvider;
    });
  }, [models, search, activeProvider]);

  function toggleModel(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function applyPack(packId: string) {
    const pack = MODEL_PACKS.find((p) => p.id === packId);
    if (pack) onChange(pack.models);
  }

  function getModelBadgeClass(modelId: string) {
    const p = getProvider(modelId);
    const map: Record<string, string> = {
      anthropic: "model-anthropic",
      openai: "model-openai",
      google: "model-google",
      meta: "model-meta",
      mistral: "model-mistral",
      deepseek: "model-deepseek",
      qwen: "model-qwen",
    };
    return map[p] ?? "model-default";
  }

  return (
    <div className="space-y-4">
      {/* Packs */}
      <div>
        <button
          onClick={() => setPackExpanded(!packExpanded)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Quick Packs
          <ChevronDown className={cn("w-3 h-3 transition-transform", packExpanded && "rotate-180")} />
        </button>

        {packExpanded && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {MODEL_PACKS.map((pack) => (
              <button
                key={pack.id}
                data-testid={`pack-${pack.id}`}
                onClick={() => applyPack(pack.id)}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/80 border border-border hover:border-primary/30 transition-all text-left"
              >
                <span className="text-base leading-none mt-0.5">{pack.emoji}</span>
                <div>
                  <div className="text-xs font-semibold text-foreground">{pack.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{pack.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected models */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const model = models.find((m) => m.id === id);
            const name = model?.name ?? id.split("/").pop() ?? id;
            return (
              <span
                key={id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border font-medium",
                  getModelBadgeClass(id)
                )}
              >
                {name}
                <button
                  onClick={() => toggleModel(id)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search + filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            data-testid="input-model-search"
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 flex-wrap">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setActiveProvider(p)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                activeProvider === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Model grid */}
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No models found
          </div>
        )}
        {filtered.map((model) => {
          const isSelected = selected.includes(model.id);
          return (
            <button
              key={model.id}
              data-testid={`model-item-${model.id}`}
              onClick={() => toggleModel(model.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
                isSelected
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "bg-secondary/20 border-transparent hover:bg-secondary/60 text-foreground"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all",
                isSelected ? "bg-primary" : "bg-secondary border border-border"
              )}>
                {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{model.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {getProviderName(model.id)}
                  {model.contextLength && ` · ${(model.contextLength / 1000).toFixed(0)}K ctx`}
                </div>
              </div>

              {model.pricingPrompt !== undefined && (
                <div className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatPrice(model.pricingPrompt)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground text-right">
        {selected.length} model{selected.length !== 1 ? "s" : ""} selected
      </div>
    </div>
  );
}
