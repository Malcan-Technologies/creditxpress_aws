"use client";

import { useState, useEffect } from "react";
import { Bell, Trash2, Check, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";

interface Notification {
	id: string;
	title: string;
	message: string;
	link?: string | null;
	type: "SYSTEM" | "MARKETING";
	priority: "LOW" | "MEDIUM" | "HIGH";
	isRead: boolean;
	createdAt: string;
}

export function NotificationsDropdown() {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState(false);
	const { toast } = useToast();
	const router = useRouter();

	useEffect(() => {
		fetchNotifications();
	}, []);

	const fetchNotifications = async () => {
		// If we already encountered an error, don't keep trying
		if (error) return;

		setLoading(true);
		try {
			// Check if we have an access token first
			const token = TokenStorage.getAccessToken();
			if (!token) {
				console.log("No access token available for notifications");
				setError(true);
				setLoading(false);
				return;
			}

			// Use fetchWithTokenRefresh for automatic token handling
			const data = await fetchWithTokenRefresh<{
				notifications: Notification[];
			}>("/api/notifications?limit=10");

			console.log("Raw notifications response:", data);
			setNotifications(data.notifications || []);
			setUnreadCount(
				(data.notifications || []).filter(
					(n: Notification) => !n.isRead
				).length
			);
			setError(false);
		} catch (error) {
			console.error("Error fetching notifications:", error);
			setError(true);
			// Don't show toast for auth errors to avoid spam
			if (
				!(
					error instanceof Error &&
					error.message.includes("access token")
				)
			) {
				toast({
					title: "Error",
					description: "Failed to fetch notifications",
					variant: "destructive",
				});
			}
		} finally {
			setLoading(false);
		}
	};

	const markAsRead = async (notificationIds: string[]) => {
		try {
			const headers = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
			};

			const response = await fetch("/api/notifications", {
				method: "PATCH",
				headers,
				body: JSON.stringify({ notificationIds }),
			});

			if (!response.ok)
				throw new Error("Failed to mark notifications as read");

			setNotifications(
				notifications.map((notification) =>
					notificationIds.includes(notification.id)
						? { ...notification, isRead: true }
						: notification
				)
			);
			setUnreadCount((prev) =>
				Math.max(0, prev - notificationIds.length)
			);
		} catch (error) {
			console.error("Error marking as read:", error);
			toast({
				title: "Error",
				description: "Failed to mark notifications as read",
				variant: "destructive",
			});
		}
	};

	const deleteNotification = async (id: string) => {
		try {
			const headers = {
				Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
			};

			const response = await fetch(`/api/notifications/${id}`, {
				method: "DELETE",
				headers,
			});

			if (!response.ok) throw new Error("Failed to delete notification");

			setNotifications(notifications.filter((n) => n.id !== id));
			if (!notifications.find((n) => n.id === id)?.isRead) {
				setUnreadCount((prev) => Math.max(0, prev - 1));
			}

			toast({
				title: "Success",
				description: "Notification deleted",
			});
		} catch (error) {
			console.error("Error deleting notification:", error);
			toast({
				title: "Error",
				description: "Failed to delete notification",
				variant: "destructive",
			});
		}
	};

	const handleNotificationClick = async (notification: Notification) => {
		try {
			console.log("Notification clicked:", notification);
			console.log("Link value:", notification.link);

			if (!notification.link) {
				console.log("No link found, marking as read only");
				if (!notification.isRead) {
					await markAsRead([notification.id]);
				}
				return;
			}

			setOpen(false);
			console.log("Navigating to:", notification.link);

			if (notification.link.startsWith("http")) {
				console.log("External link detected, using window.location");
				window.location.href = notification.link;
			} else {
				console.log("Internal link detected, using router.push");
				router.push(notification.link);
			}

			if (!notification.isRead) {
				console.log("Marking as read in background");
				await markAsRead([notification.id]).catch(console.error);
			}

			return;
		} catch (error) {
			console.error("Error handling notification click:", error);
			return;
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "HIGH":
				return "bg-red-500/80";
			case "MEDIUM":
				return "bg-yellow-500/80";
			default:
				return "bg-blue-500/80";
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative bg-gray-800 hover:bg-gray-700 text-gray-100 hover:text-white transition-colors"
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-80 bg-gray-800/95 backdrop-blur-lg border-gray-700"
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-600">
					<h2 className="font-semibold text-gray-100">
						Notifications
					</h2>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								markAsRead(
									notifications
										.filter((n) => !n.isRead)
										.map((n) => n.id)
								)
							}
							className="text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-700"
						>
							Mark all as read
						</Button>
					)}
				</div>
				<ScrollArea className="h-[400px]">
					{loading ? (
						Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="p-4 border-b border-gray-600"
							>
								<Skeleton className="h-4 w-3/4 mb-2 bg-gray-700" />
								<Skeleton className="h-3 w-full bg-gray-700" />
							</div>
						))
					) : error ? (
						<div className="p-4 text-center text-gray-400">
							Unable to load notifications
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={fetchNotifications}
									className="text-xs bg-gray-700 hover:bg-gray-600 border-gray-600"
								>
									Retry
								</Button>
							</div>
						</div>
					) : notifications.length === 0 ? (
						<div className="p-4 text-center text-gray-400">
							No notifications
						</div>
					) : (
						notifications.map((notification) => (
							<div
								key={notification.id}
								className={`group p-4 border-b border-gray-600 hover:bg-gray-700/50 transition-colors ${
									!notification.isRead ? "bg-gray-700/30" : ""
								} ${notification.link ? "cursor-pointer" : ""}`}
								onClick={(e) => {
									e.preventDefault();
									handleNotificationClick(notification);
								}}
							>
								<div className="flex items-start gap-2">
									<div
										className={`w-2 h-2 rounded-full mt-2 ${getPriorityColor(
											notification.priority
										)}`}
									/>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-gray-100 flex items-center gap-2">
											{notification.title}
											{notification.link && (
												<ExternalLink className="h-3 w-3 text-gray-400" />
											)}
										</div>
										<p className="text-sm text-gray-300">
											{notification.message}
										</p>
										<div className="flex items-center justify-between mt-2">
											<span className="text-xs text-gray-400">
												{format(
													new Date(
														notification.createdAt
													),
													"MMM d, h:mm a"
												)}
											</span>
											<div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
												{!notification.isRead && (
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-gray-400 hover:text-blue-400"
														onClick={(e) => {
															e.stopPropagation();
															markAsRead([
																notification.id,
															]);
														}}
														title="Mark as read"
													>
														<Check className="h-3 w-3" />
													</Button>
												)}
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-gray-400 hover:text-red-400"
													onClick={(e) => {
														e.stopPropagation();
														deleteNotification(
															notification.id
														);
													}}
													title="Delete"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						))
					)}
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
