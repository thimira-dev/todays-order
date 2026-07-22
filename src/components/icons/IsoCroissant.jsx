export default function IsoCroissant({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* thickness (side face) */}
      <path
        d="M13.9 6.3a7.5 7.5 0 1 0 0 13.4 6.8 6.8 0 0 1 0-13.4z"
        fill="#b45309"
      />
      {/* top face */}
      <path
        d="M13.9 4.3a7.5 7.5 0 1 0 0 13.4 6.8 6.8 0 0 1 0-13.4z"
        fill="#fbbf24"
      />
      {/* segment ridges */}
      <path
        d="M5.2 5.7l4.11 1.9M3 11h5.4M5.2 16.3l4.11-1.9"
        stroke="#d97706"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
