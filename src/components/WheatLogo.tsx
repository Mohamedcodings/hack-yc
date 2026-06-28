import type { CSSProperties } from 'react'

// Demeter brand mark — the arrow/wheat stalk. Vectorized from the source logo.
// Natural artwork is 270 × 878 (tall, narrow). Fill uses currentColor so the
// mark adopts whatever text/icon color its container sets.
const WHEAT_PATH =
  'M135.5 878.0L112.0 856.5L112.0 692.5L82.5 662.0L0.0 748.5L0.0 685.5L48.0 634.5L80.5 602.0L112.0 632.5L112.0 583.5L81.5 553.0L10.0 628.5L0.0 636.5L0.0 578.5L69.0 505.5L81.5 493.0L112.0 524.5L112.0 476.5L81.5 446.0L0.0 529.5L0.0 471.5L81.5 387.0L112.0 418.5L112.0 371.5L81.5 341.0L0.0 423.5L0.0 364.5L81.5 282.0L112.0 313.5L112.0 266.5L81.5 236.0L0.0 317.5L0.0 259.5L81.5 178.0L112.0 207.5L112.0 99.5L1.5 214.0L0.0 143.5L134.5 0.0L270.0 143.5L268.5 214.0L158.0 99.5L158.0 208.5L189.5 178.0L270.0 259.5L269.5 318.0L188.5 236.0L158.0 266.5L158.5 314.0L188.5 282.0L270.0 364.5L269.5 423.0L189.5 341.0L158.0 370.5L158.5 419.0L188.5 387.0L270.0 471.5L269.5 530.0L188.5 446.0L158.0 476.5L158.5 525.0L188.5 493.0L270.0 577.5L270.0 636.5L262.0 630.5L188.5 553.0L158.0 583.5L158.0 632.5L188.5 601.0L226.0 638.5L270.0 685.5L270.0 748.5L187.5 662.0L158.0 691.5L158.0 855.5L135.5 878.0Z'

const ASPECT = 270 / 878

type WheatLogoProps = {
  /** Rendered height in pixels; width follows the natural aspect ratio. */
  size?: number
  className?: string
  style?: CSSProperties
  title?: string
}

export function WheatLogo({ size = 24, className, style, title = 'Demeter' }: WheatLogoProps) {
  return (
    <svg
      width={size * ASPECT}
      height={size}
      viewBox="0 0 270 878"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <path d={WHEAT_PATH} />
    </svg>
  )
}
