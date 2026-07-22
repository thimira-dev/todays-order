export default function IsoBanknote({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* left face */}
      <path d="M14 13 2 7v4l12 6z" fill="#16a34a" />
      {/* right face */}
      <path d="M14 13l8-4v4l-8 4z" fill="#166534" />
      {/* stack lines */}
      <path d="M13.6 14.6 2.4 8.9M13.6 16.1 2.4 10.4" stroke="#86efac" strokeWidth="0.5" fill="none" />
      <path d="M14.4 14.6 21.6 10.9M14.4 16.1l7.2-3.7" stroke="#22c55e" strokeWidth="0.5" fill="none" />
      {/* top face */}
      <path d="M14 13 22 9l-12-6L2 7z" fill="#4ade80" />
      {/* medallion */}
      <ellipse cx="12" cy="8" rx="2.8" ry="1.4" fill="#f0fdf4" />
    </svg>
  )
}
