'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChefHat, Loader2, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// F89: Voice sous-chef — hands-free Q&A layered on top of cooking mode. Nothing here
// persists (max 5 exchanges, client state only) — this is a scratch conversation about
// "where am I right now", not a saved chat history.
const MAX_EXCHANGES = 5

interface Exchange {
  id: number
  question: string
  answer: string
  status: 'streaming' | 'done' | 'error'
}

interface Props {
  recipeId: string
  currentStepIndex: number
  totalSteps: number
}

const TIMEOUT_FAILURE_COPY = "I couldn't answer that in time — check the step below."
const GENERIC_FAILURE_COPY = "I couldn't answer that — check the step below."
const RATE_LIMIT_COPY = "I'm getting a lot of questions right now — check the step below and try again in a moment."

export function SousChef({ recipeId, currentStepIndex, totalSteps }: Props) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  // Default true so the mic renders on first paint on supported browsers; the
  // feature-detect effect below flips it off before the user could ever click a
  // dead button — same pattern as kitchen-panel.tsx's F55 voice input.
  const [voiceSupported, setVoiceSupported] = useState(true)
  // F89: speak-aloud toggle, default ON per spec — hands-free means the answer
  // should be heard, not just displayed, unless the user opts out.
  const [speakEnabled, setSpeakEnabled] = useState(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setVoiceSupported(false)
    }
  }, [])

  const cancelSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!speakEnabled) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel() // never let two answers talk over each other
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }, [speakEnabled])

  const updateExchange = useCallback((id: number, patch: Partial<Exchange>) => {
    setExchanges(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const ask = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim()
    if (!question || isSubmitting) return

    cancelSpeech() // a new question in flight preempts any answer still being read aloud
    setIsSubmitting(true)
    setInputValue('')

    const id = Date.now()
    const newExchange: Exchange = { id, question, answer: '', status: 'streaming' }
    setExchanges(prev => [...prev, newExchange].slice(-MAX_EXCHANGES))

    // Client-side backstop above the broker's own 15s interactive-lane fail-fast —
    // guards against a hang that never surfaces as an HTTP error at all.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 17_000)

    try {
      const res = await fetch(`/api/recipes/${recipeId}/sous-chef`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, currentStepIndex }),
        signal: controller.signal,
      })

      if (res.status === 429) {
        updateExchange(id, { status: 'error', answer: RATE_LIMIT_COPY })
        return
      }
      if (!res.ok || !res.body) {
        updateExchange(id, { status: 'error', answer: GENERIC_FAILURE_COPY })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let sawError: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) {
              sawError = parsed.error
            } else if (typeof parsed.text === 'string') {
              accumulated += parsed.text
              updateExchange(id, { answer: accumulated, status: 'streaming' })
            }
          } catch {
            // Incomplete line straddling a chunk boundary — wait for more data.
          }
        }
      }

      // Honest failure, never confident filler: a broker 429 or an empty
      // completion both surface as plain "couldn't answer" copy, never a
      // fabricated cooking instruction.
      if (sawError || !accumulated.trim()) {
        updateExchange(id, {
          status: 'error',
          answer: sawError === 'rate-limited' ? RATE_LIMIT_COPY : GENERIC_FAILURE_COPY,
        })
        return
      }

      updateExchange(id, { status: 'done', answer: accumulated })
      speak(accumulated)
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      updateExchange(id, { status: 'error', answer: isAbort ? TIMEOUT_FAILURE_COPY : GENERIC_FAILURE_COPY })
    } finally {
      clearTimeout(timeoutId)
      setIsSubmitting(false)
    }
  }, [cancelSpeech, currentStepIndex, isSubmitting, recipeId, speak, updateExchange])

  // F89: mic reuses the SpeechRecognition pattern from kitchen-panel.tsx (F55) —
  // window cast to any (not in the default TS lib), webkitSpeechRecognition
  // fallback for Safari/older WebKit. A recognized transcript auto-submits, since
  // the whole point of voice here is not touching the screen.
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return // graceful no-op; button is already hidden when !voiceSupported

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      ask(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [ask, isListening])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      cancelSpeech()
      recognitionRef.current?.stop()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the sous-chef"
        data-testid="sous-chef-trigger"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChefHat className="h-6 w-6" />
        <span className="sr-only">Ask the sous-chef</span>
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85vh] flex-col gap-4 border-white/10 bg-neutral-950 px-5 pb-6 pt-5 text-white dark:bg-neutral-950 sm:px-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <ChefHat className="h-5 w-5 text-primary" />
              Sous-chef
            </SheetTitle>
            <SheetDescription className="text-white/60">
              Step {currentStepIndex + 1}{totalSteps ? ` of ${totalSteps}` : ''} · ask anything about where you are right now
            </SheetDescription>
          </SheetHeader>

          <button
            type="button"
            onClick={() => setSpeakEnabled(v => !v)}
            aria-pressed={speakEnabled}
            data-testid="sous-chef-speak-toggle"
            className={cn(
              'inline-flex h-9 w-fit items-center gap-1.5 self-start rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              speakEnabled
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-white/15 bg-white/5 text-white/60 hover:text-white',
            )}
          >
            {speakEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {speakEnabled ? 'Reading answers aloud' : 'Answers muted'}
          </button>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto -mx-1 px-1" aria-live="polite">
            {exchanges.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">
                Ask about substitutions, timing, or technique for this step — hands-free.
              </p>
            ) : (
              exchanges.map((ex, i) => {
                const isLatest = i === exchanges.length - 1
                return (
                  <div key={ex.id} className="space-y-1.5">
                    <p className="text-sm font-medium text-white/70">{ex.question}</p>
                    <p
                      {...(isLatest ? { 'data-testid': 'sous-chef-answer' } : {})}
                      className={cn(
                        'text-base leading-snug',
                        ex.status === 'error' ? 'text-[hsl(var(--color-warning-fg))]' : 'text-white',
                      )}
                    >
                      {ex.answer || (ex.status === 'streaming' ? '…' : '')}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(inputValue) }}
            className="flex items-center gap-2 pt-1"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Ask the sous-chef a question"
              data-testid="sous-chef-input"
              disabled={isSubmitting}
              className="h-12 flex-1 border-white/15 bg-white/5 text-base text-white placeholder:text-white/40 focus-visible:ring-ring"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isSubmitting}
                aria-label={isListening ? 'Stop recording' : 'Ask by voice'}
                data-testid="sous-chef-mic"
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40',
                  isListening
                    ? 'animate-pulse border-destructive/60 bg-destructive/20 text-destructive'
                    : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white',
                )}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !inputValue.trim()}
              aria-label="Send question"
              data-testid="sous-chef-submit"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
