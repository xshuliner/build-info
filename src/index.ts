export {
  DEFAULT_GLOBAL_NAME,
  DEFAULT_JSON_SRC,
  DEFAULT_OUT_DIR,
  DEFAULT_SCRIPT_SRC
} from './constants'
export type { BuildInfo, BuildInfoWithPrint } from './types'
export { renderBuildInfoScript } from './core/render'
export { sanitizeRemoteUrl } from './utils/sanitize'
