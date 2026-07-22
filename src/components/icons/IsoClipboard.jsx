export default function IsoClipboard({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* board thickness */}
      <rect x="5.5" y="4.5" width="13" height="18" rx="1.5" fill="#92400e" />
      {/* board front */}
      <rect x="5.5" y="3" width="13" height="18" rx="1.5" fill="#b45309" />
      {/* paper */}
      <rect x="7.5" y="5.5" width="9" height="13.5" rx="0.5" fill="#ffffff" />
      {/* clip */}
      <rect x="10" y="2" width="4" height="2.5" rx="1" fill="#78716c" />
      {/* lines */}
      <path
        d="M10.8 8.5h4.2M10.8 12h4.2M10.8 15.5h4.2"
        stroke="#cbd5e1"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* checks */}
      <path
        d="M7.9 8.4l0.9 1 1.3-1.6M7.9 11.9l0.9 1 1.3-1.6"
        stroke="#16a34a"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
