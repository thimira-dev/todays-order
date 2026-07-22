export default function IsoCheckCircle({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* puck side - light half */}
      <path d="M5 9.5a7 3.5 0 0 0 7 3.5v2.5a7 3.5 0 0 1-7-3.5z" fill="#22c55e" />
      {/* puck side - dark half */}
      <path d="M19 9.5a7 3.5 0 0 1-7 3.5v2.5a7 3.5 0 0 0 7-3.5z" fill="#16a34a" />
      {/* puck top */}
      <ellipse cx="12" cy="9.5" rx="7" ry="3.5" fill="#4ade80" />
      {/* check */}
      <path
        d="M8.5 9.6l2.3 2.3 4.5-4.6"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
