declare module 'next/script' {
  import type { ComponentType } from 'react'

  export interface ScriptProps {
    src?: string
    strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'
    [key: string]: unknown
  }

  const Script: ComponentType<ScriptProps>
  export default Script
}
