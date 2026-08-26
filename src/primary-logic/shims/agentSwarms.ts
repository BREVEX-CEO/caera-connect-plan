/**
 * The donor could fan a task out to a swarm of peer agents over its remote
 * bridge. OCADE runs one agent on the user's own device, so the capability is
 * off and the prompt text that describes it is never emitted.
 */
export function isAgentSwarmsEnabled(): boolean {
  return false;
}
