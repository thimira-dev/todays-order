export default function IsoLock({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* shackle */}
      <path
        d="M9.2 10.2V7.8a2.8 2.8 0 0 1 5.6 0v2.4"
        stroke="#57534e"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* body thickness */}
      <rect x="6.5" y="11.5" width="11" height="9.5" rx="1.5" fill="#a16207" />
      {/* body front */}
      <rect x="6.5" y="10" width="11" height="9.5" rx="1.5" fill="#facc15" />
      {/* keyhole */}
      <circle cx="12" cy="13.6" r="1.3" fill="#78350f" />
      <path d="M11.4 14.5h1.2l0.5 2.8h-2.2z" fill="#78350f" />
    </svg>
  )
}
