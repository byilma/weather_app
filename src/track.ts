// Private tap counting: how many people open the app, open Plans, and tap which
// partner. This is the evidence partners ask for ("active users", "clicks").
//
// Off until you paste a PostHog project key below (free tier is plenty to start;
// posthog.com → new project → copy the project API key). Until then, events are
// only printed in the dev console.
//
// What is sent: the event name, a few labels (which plan, which partner), and a
// random anonymous id. Never the person's location, coordinates, or contacts.

import { anonymousId } from './storage';

const POSTHOG_KEY = ''; // e.g. 'phc_...'
const POSTHOG_HOST = 'https://us.i.posthog.com';

export type EventName =
  | 'app_open'
  | 'city_swipe'
  | 'city_add'
  | 'vibe_reveal'
  | 'plans_open'
  | 'plan_tap'
  | 'plans_search'
  | 'share_open'
  | 'share_sent';

let idPromise: Promise<string> | null = null;

export function track(event: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!POSTHOG_KEY) {
    if (__DEV__) console.log('[track]', event, props);
    return;
  }
  idPromise ??= anonymousId();
  idPromise
    .then((id) =>
      fetch(`${POSTHOG_HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          event,
          properties: { distinct_id: id, $process_person_profile: false, ...props },
          timestamp: new Date().toISOString(),
        }),
      }),
    )
    .catch(() => {}); // counting must never break the app
}
