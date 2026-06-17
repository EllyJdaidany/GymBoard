export default function Loading({ label = 'Loading...', className = 'text-slate-400' }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      {label}
    </div>
  )
}
