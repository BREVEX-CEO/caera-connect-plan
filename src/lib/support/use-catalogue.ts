/**
 * The Help Center a reader actually gets, as a hook.
 *
 * SOURCE FIRST, ALWAYS. The initial value is the shipped catalogue, so
 * `/support` renders its twenty-one answers on the first paint, before any
 * network call, and on a deployment with no Supabase binding it renders them
 * and stops. The overrides arrive afterwards and change what is on screen only
 * if an editor has actually changed something.
 *
 * That ordering is the whole design. A Help Center that waited for a database
 * before showing anything would be blank exactly when somebody is having the
 * bad day that sent them there.
 *
 * ONE QUERY FOR EVERY SUPPORT SURFACE. `/support`, `/support/$slug`, `/faq` and
 * the search all use this, so an edit cannot be visible on one and not another
 * — and react-query dedupes the read across them, so navigating between the
 * three does not re-ask.
 */
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { SUPPORT_ARTICLES, type SupportArticle } from "./articles";
import { loadArticleOverrides, mergeArticles } from "./catalogue";

/**
 * Five minutes.
 *
 * Help content changes on the order of weeks, and this read happens on a public
 * page that a lot of people open. Asking on every mount would be a query per
 * navigation for an answer that is almost always the same empty list.
 */
const STALE_MS = 5 * 60 * 1000;

export function useSupportCatalogue(): SupportArticle[] {
  const overrides = useQuery({
    queryKey: ["support-article-overrides"],
    staleTime: STALE_MS,
    queryFn: async () => {
      // Asked only where there is something to ask. An unconfigured deployment
      // must not spend a failed request on every Help Center visit.
      if (!getSupabaseBrowserConfiguration().configured) return [];
      return loadArticleOverrides(await loadSupabaseClient());
    },
  });

  if (!overrides.data || overrides.data.length === 0) return [...SUPPORT_ARTICLES];
  return mergeArticles(SUPPORT_ARTICLES, overrides.data);
}
