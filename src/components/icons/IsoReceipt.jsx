export default function IsoReceipt({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* thickness */}
      <path
        d="M7 6.5Q12 4 17 6.5V19l-1.25-1.2L14.5 19l-1.25-1.2L12 19l-1.25-1.2L9.5 19l-1.25-1.2L7 19z"
        fill="#94a3b8"
      />
      {/* paper */}
      <path
        d="M7 5Q12 2.5 17 5v12.5l-1.25-1.2-1.25 1.2-1.25-1.2-1.25 1.2-1.25-1.2-1.25 1.2-1.25-1.2L7 17.5z"
        fill="#f8fafc"
      />
      {/* lines */}
      <path
        d="M9.3 7.5h5.4M9.3 10.2h5.4M9.3 12.9h5.4"
        stroke="#cbd5e1"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* total */}
      <path d="M11.8 15.2h2.9" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
