export default function TVBackgroundLogo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
    >
      <img
        src="/catalyst-logo-mark.png"
        alt=""
        className="h-[90%] w-[90%] object-contain opacity-[0.05] blur-sm"
      />
    </div>
  )
}
