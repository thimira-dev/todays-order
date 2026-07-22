export default function IsoCoins({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* stack side */}
      <path d="M5 8v5a4.5 2.2 0 0 0 9 0V8a4.5 2.2 0 0 1-9 0z" fill="#eab308" />
      {/* stack layer lines */}
      <path
        d="M5 10.5a4.5 2.2 0 0 0 9 0M5 13a4.5 2.2 0 0 0 9 0"
        stroke="#ca8a04"
        strokeWidth="0.6"
        fill="none"
      />
      {/* stack top */}
      <ellipse cx="9.5" cy="8" rx="4.5" ry="2.2" fill="#fde047" />
      {/* leaning coin - edge */}
      <circle cx="16.9" cy="13.9" r="4" fill="#ca8a04" />
      {/* leaning coin - face */}
      <circle cx="16.5" cy="13.5" r="4" fill="#facc15" />
      <circle cx="16.5" cy="13.5" r="2.7" fill="none" stroke="#eab308" strokeWidth="0.8" />
    </svg>
  )
}
