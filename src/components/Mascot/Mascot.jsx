import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRive, useStateMachineInput, StateMachineInputType } from '@rive-app/react-canvas'
import { registerMascotReactionHandler } from './mascotBus'
import styles from './Mascot.module.css'

const REACTION_FALLBACK_MS = 8000
const BUBBLE_TRANSITION_MS = 200

// ── Rive asset config ──────────────────────────────────────────────────────
// These values must match your authored .riv file. On first `npm run dev`,
// open the browser console — available state machine and input names will
// be logged so you can adjust any mismatch.
const MASCOT = {
  src: '/assets/mascot/011y.riv',
  stateMachine: 'O11Y-Expressions',
  inputs: {
    wave: 'Check',
    success: 'Happy',
    error: 'Sad',
  },
}
// ────────────────────────────────────────────────────────────────────────────

const Mascot = forwardRef(function Mascot(
  { message, onClick, size = 96 },
  ref,
) {
  const [reaction, setReaction] = useState(null)
  const timeoutRef = useRef(null)
  const activeReactionRef = useRef(null)

  const [renderedMessage, setRenderedMessage] = useState(null)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const bubbleTimeoutRef = useRef(null)

  // ── Rive hooks ───────────────────────────────────────────────────────────
  const { rive, RiveComponent } = useRive({
    src: MASCOT.src,
    stateMachines: MASCOT.stateMachine,
    autoplay: true,
  })

  const waveInput   = useStateMachineInput(rive, MASCOT.stateMachine, MASCOT.inputs.wave)
  const successInput = useStateMachineInput(rive, MASCOT.stateMachine, MASCOT.inputs.success)
  const errorInput  = useStateMachineInput(rive, MASCOT.stateMachine, MASCOT.inputs.error)

  // Keep a render-safe reference to the latest input objects so callbacks
  // (playReaction / clearReaction) never close over stale values.
  const inputsRef = useRef({ wave: null, success: null, error: null })
  inputsRef.current = { wave: waveInput, success: successInput, error: errorInput }

  // ── Debug log on load (dev only) ─────────────────────────────────────────
  useEffect(() => {
    if (!rive) return
    const names = rive.stateMachineNames ?? []
    if (names.length > 0) {
      const desc = names.map((sm) => {
        const inputs = rive.stateMachineInputs(sm) ?? []
        return `"${sm}": [${inputs.map((i) => `${i.name}(${StateMachineInputType[i.type] ?? i.type})`).join(', ')}]`
      })
      console.info('[Mascot] Available state machines:', desc.join(' | '))
    }
  }, [rive])

  // ── Reaction management ──────────────────────────────────────────────────
  const clearReaction = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Reset boolean input for the active reaction so the state machine
    // returns to idle.
    if (activeReactionRef.current) {
      const input = inputsRef.current[activeReactionRef.current]
      if (input?.type === StateMachineInputType.Boolean) input.value = false
      activeReactionRef.current = null
    }

    setReaction(null)
  }, [])

  const playReaction = useCallback(
    (reactionName, textMessage, durationMs) => {
      const triggerName = MASCOT.inputs[reactionName]
      if (!triggerName) {
        console.warn(
          `[Mascot] Unknown reaction "${reactionName}". Available:`,
          Object.keys(MASCOT.inputs).join(', '),
        )
        return
      }

      clearReaction()
      activeReactionRef.current = reactionName

      setReaction({ name: reactionName, message: textMessage ?? null })

      // Fire the state-machine input (trigger → fire(); boolean → true).
      const input = inputsRef.current[reactionName]
      if (input?.type === StateMachineInputType.Trigger) {
        input.fire()
      } else if (input?.type === StateMachineInputType.Boolean) {
        input.value = true
      } else if (!input) {
        console.warn(
          `[Mascot] Input "${triggerName}" not found for "${reactionName}".`,
          'Check MASCOT.inputs config.',
        )
      }

      const ms = durationMs > 0 ? durationMs : REACTION_FALLBACK_MS
      timeoutRef.current = setTimeout(clearReaction, ms)
    },
    [clearReaction],
  )

  useImperativeHandle(ref, () => ({ playReaction, clearReaction }), [playReaction, clearReaction])
  useEffect(() => registerMascotReactionHandler(playReaction), [playReaction])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  // ── Bubble fade in/out ──────────────────────────────────────────────────
  const interactive = typeof onClick === 'function'
  const activeMessage = reaction ? reaction.message : message

  useEffect(() => {
    if (activeMessage) {
      clearTimeout(bubbleTimeoutRef.current)
      setRenderedMessage(activeMessage)
      const raf = requestAnimationFrame(() => setBubbleVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setBubbleVisible(false)
    bubbleTimeoutRef.current = setTimeout(() => setRenderedMessage(null), BUBBLE_TRANSITION_MS)
    return () => clearTimeout(bubbleTimeoutRef.current)
  }, [activeMessage])

  // ── Rendering ────────────────────────────────────────────────────────────
  const handleKeyDown = (event) => {
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(event)
    }
  }

  return (
    <div
      className={`${styles.container} ${interactive ? styles.interactive : ''}`}
      style={{ '--mascot-size': `${size}px` }}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? activeMessage || 'Mascot' : undefined}
    >
      {renderedMessage && (
        <div className={`${styles.bubble} ${bubbleVisible ? styles.bubbleVisible : ''}`}>
          {renderedMessage}
          <span aria-hidden="true" className={styles.tail} />
        </div>
      )}

      <div className={styles.player}>
        <RiveComponent />
      </div>
    </div>
  )
})

export default Mascot
