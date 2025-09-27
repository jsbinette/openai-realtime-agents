import { simpleHandoffScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';
import { heyGpt } from './heyGpt';

import type { RealtimeAgent } from '@openai/agents/realtime';
import type { Agent } from '@openai/agents';
import { taskAgents } from './taskAgents';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  heyGpt: heyGpt,
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

export const defaultAgentSetKey = 'heyGpt';

// Parallel map for non-realtime (runs-based) agents
export const allRunAgentSets: Record<string, Agent[]> = {
  taskAgents,
};
