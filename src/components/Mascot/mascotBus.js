// Module-level event bus so any component in the app can trigger mascot
// reactions without prop drilling or a context provider.
let reactionHandler = null

// Called by <Mascot /> on mount; returns an unregister cleanup function.
export function registerMascotReactionHandler(handler) {
  reactionHandler = handler
  return () => {
    if (reactionHandler === handler) reactionHandler = null
  }
}

// Trigger a one-shot mascot reaction from anywhere in the app.
// reactionName — one of 'wave', 'success', 'error' (defined in Mascot config)
// textMessage — optional speech bubble text
// durationMs  — how long before reverting to idle (default 8s fallback)
export function playMascotReaction(reactionName, textMessage, durationMs) {
  reactionHandler?.(reactionName, textMessage, durationMs)
}
