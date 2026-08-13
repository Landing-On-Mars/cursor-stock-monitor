export function MarketChart() {
  return (
    <div className="chart-wrap" aria-label="组合收益曲线演示图">
      <svg viewBox="0 0 800 190" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4c8c6c" stopOpacity=".24" />
            <stop offset="100%" stopColor="#4c8c6c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          <line x1="0" y1="35" x2="800" y2="35" />
          <line x1="0" y1="80" x2="800" y2="80" />
          <line x1="0" y1="125" x2="800" y2="125" />
          <line x1="0" y1="170" x2="800" y2="170" />
        </g>
        <path
          d="M0,151 C36,153 48,139 78,143 C108,147 125,127 151,132 C180,137 196,119 222,123 C252,127 265,111 294,116 C326,122 337,93 367,99 C393,104 408,88 436,91 C466,95 478,70 506,75 C539,81 549,58 579,67 C608,76 623,47 650,53 C679,59 693,38 722,45 C752,52 766,25 800,30 L800,190 L0,190 Z"
          fill="url(#chartFill)"
        />
        <path
          d="M0,151 C36,153 48,139 78,143 C108,147 125,127 151,132 C180,137 196,119 222,123 C252,127 265,111 294,116 C326,122 337,93 367,99 C393,104 408,88 436,91 C466,95 478,70 506,75 C539,81 549,58 579,67 C608,76 623,47 650,53 C679,59 693,38 722,45 C752,52 766,25 800,30"
          fill="none"
          stroke="#347052"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <circle cx="800" cy="30" fill="#347052" r="4" />
      </svg>
    </div>
  );
}
