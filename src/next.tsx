import React from 'react'
import Script from 'next/script'
import { DEFAULT_SCRIPT_SRC } from './constants'

export interface BuildInfoScriptProps {
  src?: string
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'
}

export function BuildInfoScript({
  src = DEFAULT_SCRIPT_SRC,
  strategy = 'beforeInteractive'
}: BuildInfoScriptProps): React.ReactElement {
  return <Script src={src} strategy={strategy} />
}
