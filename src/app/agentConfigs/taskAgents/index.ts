import { Agent } from '@openai/agents';
import { showAgent } from './showAgent';

// You can add more non-realtime agents here and wire handoffs if desired.
export const taskAgents: Agent[] = [
  showAgent,
];

