import { heyAgent } from './heyAgent';
import { talkingAgent } from './talkingAgent';

// Cast to `any` to satisfy TypeScript until the core types make RealtimeAgent
// assignable to `Agent<unknown>` (current library versions are invariant on
// the context type).
(heyAgent.handoffs as any).push(talkingAgent);
(talkingAgent.handoffs as any).push(heyAgent);

export const heyGpt = [
  heyAgent,
  talkingAgent,
];

// Name of the company represented by this agent set. Used by guardrails
// Sort of hardcoded in the demo so not used here
export const customerServiceRetailCompanyName = 'Snowy Peak Boards';
