interface PieChartProps {
	borrowed: number;
	repaid: number;
	size?: number;
}

export default function PieChart({
	borrowed,
	repaid,
	size = 80,
}: PieChartProps) {
	const percentage = (repaid / borrowed) * 100;
	const radius = size / 2;
	const circumference = 2 * Math.PI * radius;
	const strokeDasharray = `${circumference} ${circumference}`;
	const strokeDashoffset = circumference - (percentage / 100) * circumference;

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg className="w-full h-full" viewBox={`0 0 ${size} ${size}`}>
				{/* Background circle */}
				<circle
					cx={radius}
					cy={radius}
					r={radius - 2}
					className="fill-none stroke-gray-200"
					strokeWidth="4"
				/>
				{/* Progress circle */}
				<circle
					cx={radius}
					cy={radius}
					r={radius - 2}
					className="fill-none stroke-indigo-600"
					strokeWidth="4"
					strokeDasharray={strokeDasharray}
					strokeDashoffset={strokeDashoffset}
					transform={`rotate(-90 ${radius} ${radius})`}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="text-sm font-medium text-gray-900">
					{Math.round(percentage)}%
				</span>
			</div>
		</div>
	);
}
