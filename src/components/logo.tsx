export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* SVG Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className="h-full w-auto aspect-square text-green-500"
        fill="none"
      >
        {/* Background Shield/Shape */}
        <path d="M50 5 L90 20 L80 80 L50 95 L20 80 L10 20 Z" fill="currentColor" fillOpacity="0.15" />
        <path d="M50 5 L90 20 L80 80 L50 95 L20 80 L10 20 Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        
        {/* The 'A' shape inside */}
        <path d="M50 25 L30 70 L42 70 L46 55 L65 55 L58 70 L70 70 Z" fill="currentColor" />
        
        {/* The '1' element slicing through */}
        <path d="M48 20 L58 20 L58 75 L48 75 Z" fill="var(--background)" stroke="currentColor" strokeWidth="2" />
        
        {/* Accent dot */}
        <circle cx="50" cy="40" r="5" fill="var(--foreground)" />
      </svg>
      {/* Brand Text */}
      <div className="flex flex-col justify-center">
        <span className="text-slate-900 dark:text-white font-black text-[18px] leading-tight tracking-tight uppercase">
          A1
        </span>
        <span className="text-green-600 dark:text-green-500 font-extrabold text-[11px] leading-tight tracking-widest uppercase">
          TipsDeck
        </span>
      </div>
    </div>
  );
}
