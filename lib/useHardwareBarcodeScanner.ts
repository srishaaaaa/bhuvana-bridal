'use client'

import { useEffect, useRef } from 'react'
import { normalizeBarcode } from '@/lib/barcode'

interface UseHardwareBarcodeScannerOptions {
  /** Listen only while true (the billing screen has its own listener in BarcodeScannerInput). */
  enabled: boolean
  onScan: (barcode: string) => void
}

/** Detects a USB/Bluetooth barcode scanner (fast keystroke burst ending in Enter). */
export function useHardwareBarcodeScanner({ enabled, onScan }: UseHardwareBarcodeScannerOptions) {

  const bufferRef = useRef<{
    code: string
    lastTime: number
    targetInput: HTMLInputElement | HTMLTextAreaElement | null
  }>({
    code: '',
    lastTime: 0,
    targetInput: null,
  })

  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      const diff = now - bufferRef.current.lastTime
      const target = e.target as HTMLElement
      const isInputField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // Hardware scanners end with 'Enter'
      if (e.key === 'Enter') {
        const buffered = bufferRef.current.code.trim()

        // Verify if rapid keystrokes (< 50ms average) accumulated >= 4 characters
        if (buffered.length >= 4 && diff < 150) {
          e.preventDefault()
          e.stopPropagation()

          // If focused inside an input field, remove the injected scanner string from the input
          if (isInputField && bufferRef.current.targetInput) {
            const inputEl = bufferRef.current.targetInput
            if (inputEl.value && inputEl.value.endsWith(buffered)) {
              inputEl.value = inputEl.value.slice(0, -buffered.length)
              inputEl.dispatchEvent(new Event('input', { bubbles: true }))
            }
          }

          bufferRef.current = { code: '', lastTime: 0, targetInput: null }

          onScan(normalizeBarcode(buffered))
          return
        }

        bufferRef.current = { code: '', lastTime: 0, targetInput: null }
        return
      }

      // Printable single character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (diff > 45) {
          // Slow typing cadence (human typing): reset buffer
          bufferRef.current = {
            code: e.key,
            lastTime: now,
            targetInput: isInputField ? (target as HTMLInputElement | HTMLTextAreaElement) : null,
          }
        } else {
          // Rapid typing cadence (< 45ms): hardware barcode burst
          bufferRef.current.code += e.key
          bufferRef.current.lastTime = now
          if (isInputField) {
            bufferRef.current.targetInput = target as HTMLInputElement | HTMLTextAreaElement
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [enabled, onScan])
}
