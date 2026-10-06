import type { Flavor } from '../domain/menu'

interface FlavorCardProps {
  flavor: Flavor
  cups: number
  disabled?: boolean
  onChange: (cups: number) => void
}

export function FlavorCard({
  flavor,
  cups,
  disabled = false,
  onChange,
}: FlavorCardProps) {
  return (
    <article className={`flavor-card flavor-${flavor.tone}`}>
      <div className="flavor-card__identity">
        <span className="flavor-card__emoji" aria-hidden="true">
          {flavor.emoji}
        </span>
        <h3>{flavor.name}</h3>
      </div>
      <div className="stepper" aria-label={`${flavor.name}のカップ数`}>
        <button
          type="button"
          className="stepper__button"
          aria-label={`${flavor.name}を1カップ減らす`}
          disabled={disabled || cups === 0}
          onClick={() => onChange(Math.max(0, cups - 1))}
        >
          −
        </button>
        <output className="stepper__value" aria-live="polite">
          <strong>{cups}</strong>
          <span>カップ</span>
        </output>
        <button
          type="button"
          className="stepper__button stepper__button--plus"
          aria-label={`${flavor.name}を1カップ増やす`}
          disabled={disabled}
          onClick={() => onChange(cups + 1)}
        >
          ＋
        </button>
      </div>
    </article>
  )
}
