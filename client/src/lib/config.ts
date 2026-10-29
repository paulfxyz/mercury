import { useQuery } from "@tanstack/react-query";

export interface AppConfig {
  demo: boolean;
  limits: { maxModels: number; maxRounds: number };
  quickModel: string;
}

/** Server-side deployment settings (public demo mode, limits). */
export function useAppConfig(): AppConfig | undefined {
  const { data } = useQuery<AppConfig>({ queryKey: ["/api/config"] });
  return data;
}
