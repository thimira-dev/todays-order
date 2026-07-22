export default function IsoUndo({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* arrowhead */}
      <path d="M6.2 7 2.8 10.6 6.2 14.2z" fill="#64748b" />
      {/* shaft + hook */}
      <path
        d="M5.8 9.4H14a5.6 5.6 0 0 1 0 11.2v-2.8a3.2 3.2 0 0 0 0-6.4H5.8z"
        fill="#64748b"
      />
    </svg>
  )
}
