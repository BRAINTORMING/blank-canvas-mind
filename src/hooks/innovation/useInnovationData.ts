import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/externalClient";
import type { ProfileRow, SessionRow } from "@/lib/innovation/metrics";

async function fetchAllPages<T>(
  build: (from: number, to: number) => any,
  pageSize = 1000,
  hardCap = 50000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (from < hardCap) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export function useInnovationData() {
  return useQuery({
    queryKey: ["innovation", "raw"],
    staleTime: 60_000,
    queryFn: async () => {
      if (!externalSupabase) throw new Error("Supabase no configurado");

      const profiles = await fetchAllPages<ProfileRow>((from, to) =>
        externalSupabase
          .from("usuarios_perfiles")
          .select("id,email,permisos,fecha_registro,ultima_conexion,activo,regiones_permitidas")
          .range(from, to),
      );

      const sessions = await fetchAllPages<SessionRow>((from, to) =>
        externalSupabase
          .from("usuarios_sesiones")
          .select("*")
          .order("login_time", { ascending: false })
          .range(from, to),
      );

      return { profiles, sessions };
    },
  });
}
