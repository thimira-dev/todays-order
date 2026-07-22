export default function IsoBellRing({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* motion waves */}
      <path
        d="M5.7 7.2a4.6 4.6 0 0 0 0 6.2M18.3 7.2a4.6 4.6 0 0 1 0 6.2"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {/* knob */}
      <circle cx="12" cy="3.6" r="1.3" fill="#eab308" />
      {/* body - light half */}
      <path
        d="M12 5c-3.2 0-5 2.5-5 5.8v3c0 1.4-.9 2.1-1.6 2.8H12z"
        fill="#fde047"
      />
      {/* body - dark half */}
      <path
        d="M12 5c3.2 0 5 2.5 5 5.8v3c0 1.4.9 2.1 1.6 2.8H12z"
        fill="#facc15"
      />
      {/* rim - light half */}
      <path d="M12 14.5c-3.87 0-7 .94-7 2.1s3.13 2.1 7 2.1z" fill="#facc15" />
      {/* rim - dark half */}
      <path d="M12 14.5c3.87 0 7 .94 7 2.1s-3.13 2.1-7 2.1z" fill="#eab308" />
      {/* clapper */}
      <circle cx="12" cy="19.4" r="1.4" fill="#a16207" />
    </svg>
  )
}
