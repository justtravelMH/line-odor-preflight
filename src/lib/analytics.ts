export const ALLOWED_ANALYTICS_KEYS=new Set(['event_name','user_state','result_code','baseline_count_bucket','post_count_bucket','app_version']);
export function safeAnalyticsProperties(input:Record<string,unknown>){return Object.fromEntries(Object.entries(input).filter(([key])=>ALLOWED_ANALYTICS_KEYS.has(key)))}
