export default function IsoCreditCard({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* left face */}
      <path d="M14.5 13.75 1.5 7.75v1.2l13 6z" fill="#2563eb" />
      {/* right face */}
      <path d="M14.5 13.75l8-4v1.2l-8 4z" fill="#1d4ed8" />
      {/* top face */}
      <path d="M14.5 13.75 22.5 9.75 9.5 3.25 1.5 7.75z" fill="#3b82f6" />
      {/* chip */}
      <path d="M8.7 9.75l1.8-0.9-2.8-1.4-1.8 0.9z" fill="#fde047" />
      {/* number dots */}
      <ellipse cx="15" cy="11.3" rx="0.9" ry="0.45" fill="#dbeafe" />
      <ellipse cx="17.4" cy="10.1" rx="0.9" ry="0.45" fill="#dbeafe" />
    </svg>
  )
}
