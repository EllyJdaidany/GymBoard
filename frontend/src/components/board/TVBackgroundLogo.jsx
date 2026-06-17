export default function TVBackgroundLogo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 z-0 flex items-center justify-end pr-6"
    >
      <img
        src="/catalyst-logo-mark.png"
        alt=""
        className="h-[810px] w-auto object-contain object-right opacity-[0.05] blur-sm"
      />
    </div>
  )
}
