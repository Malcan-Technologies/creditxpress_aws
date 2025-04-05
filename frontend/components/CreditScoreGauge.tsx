"use client";

import GaugeComponent from "react-gauge-component";

interface CreditScoreGaugeProps {
	score: number | null;
	size?: number;
}

const scoreRanges = [
	{ min: 300, max: 528, label: "Poor", color: "#FF4B4B" },
	{ min: 529, max: 650, label: "Low", color: "#FF9447" },
	{ min: 651, max: 696, label: "Fair", color: "#FFD700" },
	{ min: 697, max: 717, label: "Good", color: "#90EE90" },
	{ min: 718, max: 743, label: "Very Good", color: "#00C49F" },
	{ min: 744, max: 850, label: "Excellent", color: "#00A07D" },
];

export default function CreditScoreGauge({
	score = null,
	size = 300,
}: CreditScoreGaugeProps) {
	return (
		<div className="flex flex-col items-center">
			<GaugeComponent
				type="semicircle"
				arc={{
					width: 0.4,
					padding: 0.001,
					cornerRadius: 0,
					subArcs:
						score === null
							? [{ limit: 850, color: "#E5E7EB" }]
							: scoreRanges.map((range) => ({
									limit: range.max,
									color: range.color,
									showTick: false,
							  })),
				}}
				pointer={{
					type: "needle",
					length: 0.85,
					width: 10,
					color: "#000000",
					elastic: false,
					hide: score === null,
				}}
				labels={{
					valueLabel: {
						hide: true,
					},
					tickLabels: {
						type: "outer",
						defaultTickValueConfig: {
							formatTextValue: (value: number) =>
								Math.round(value).toString(),
							style: {
								fontSize: "12px",
								fill: "#666666",
								textShadow: "none",
							},
						},
						ticks: [{ value: 300 }, { value: 850 }],
					},
				}}
				value={score ?? 300}
				minValue={300}
				maxValue={850}
				style={{ width: size }}
			/>
			{score && (
				<div className="space-y-1 text-center">
					<div className="text-2xl font-bold text-gray-900">
						{score}
					</div>
					<div className="text-sm text-gray-500">Powered by CTOS</div>
				</div>
			)}
		</div>
	);
}
