export default function WeightDisplay({
  kg,
  className = '',
  valueClassName = '',
  unitClassName = 'text-base',
  showUnit = true,
}) {
  if (kg == null) {
    return <span className={className}>—</span>
  }

  return (
    <span
      className={[
        'inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap',
        className,
      ].join(' ')}
    >
      <span className={`shrink-0 tabular-nums ${valueClassName}`}>{Number(kg).toFixed(1)}</span>
      {showUnit ? <span className={`font-pirulen shrink-0 ${unitClassName}`}>KG</span> : null}
    </span>
  )
}
