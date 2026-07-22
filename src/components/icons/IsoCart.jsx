export default function IsoCart({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* handle */}
      <path d="M6 7 3.2 4.3" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
      {/* basket front */}
      <path d="M6 7h14l-2.5 6.5h-9z" fill="#93c5fd" />
      {/* basket grid */}
      <path
        d="M10.67 7l0.83 6.5M15.33 7l-0.83 6.5M7.25 10.25h11.5"
        stroke="#3b82f6"
        strokeWidth="0.7"
        fill="none"
      />
      {/* basket bottom slab */}
      <path d="M8.5 13.5h9l-1.25 1.5h-6.5z" fill="#3b82f6" />
      {/* wheels */}
      <circle cx="11" cy="17.3" r="1.6" fill="#1e293b" />
      <circle cx="15" cy="17.3" r="1.6" fill="#1e293b" />
    </svg>
  )
}
